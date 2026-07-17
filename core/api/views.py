import json
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Activity, ActivitySection, ActivityPrompt, SectionLink,
    GradeLevel, Standard, Concept, Classroom, Module, ModuleActivity,
    TeacherProfile, StudentResponse, TeacherFeedback, ActivityFile,
    ClassroomSectionPoints, StudentSectionScore, LessonFeedback, TeachSTEMProfile, TeachSTEMTask,
    TeachSTEMTaskCompletion, ProjectTopicSubmission, TStemSurveyResponse, TeacherSurveyResponse,
    ThreeTwoOneAssignment, ThreeTwoOneResponse,
)
from core.views import _is_teacher, _save_sections_and_standards, _activity_completed_by
from .serializers import (
    UserSerializer, ActivityListSerializer, ActivityDetailSerializer,
    GradeLevelSerializer, StandardSerializer, ClassroomListSerializer,
    ClassroomDetailSerializer, ModuleSerializer, StudentResponseSerializer,
    TeacherStudentResponseSerializer, TeacherFeedbackSerializer,
    LessonFeedbackSerializer, TeachSTEMProfileSerializer, TeachSTEMTaskSerializer,
    ProjectTopicSubmissionSerializer, TStemSurveyResponseSerializer,
    ThreeTwoOneAssignmentSerializer, ThreeTwoOneResponseSerializer,
    TeacherSurveyResponseSerializer,
)


def _teacher_required(request):
    return _is_teacher(request.user)


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


# ── Auth ──────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    user = authenticate(username=username, password=password)
    if not user:
        return Response({'error': 'Invalid username or password.'}, status=400)
    tokens = _tokens_for_user(user)
    return Response({**tokens, 'user': UserSerializer(user).data})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_register_teacher(request):
    first = request.data.get('first_name', '').strip()
    last = request.data.get('last_name', '').strip()
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    if not (first and last and username and password):
        return Response({'error': 'All fields are required.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken.'}, status=400)
    user = User.objects.create_user(
        username=username, password=password,
        first_name=first, last_name=last,
    )
    is_teach_stem = request.data.get('is_teach_stem', False)
    TeacherProfile.objects.create(user=user, is_approved=False, is_teach_stem=bool(is_teach_stem))
    return Response({'message': 'Account created. Awaiting admin approval.'}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def api_register_student(request):
    first = request.data.get('first_name', '').strip()
    last = request.data.get('last_name', '').strip()
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    classroom_code = request.data.get('classroom_code', '').strip().upper()
    if not (first and last and username and password):
        return Response({'error': 'All fields are required.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken.'}, status=400)
    classroom = None
    if classroom_code:
        try:
            classroom = Classroom.objects.get(code=classroom_code)
        except Classroom.DoesNotExist:
            return Response({'error': 'Invalid classroom code.'}, status=400)
    user = User.objects.create_user(
        username=username, password=password,
        first_name=first, last_name=last,
    )
    if classroom:
        classroom.students.add(user)
    tokens = _tokens_for_user(user)
    return Response({**tokens, 'user': UserSerializer(user).data}, status=201)


@api_view(['GET'])
def api_me(request):
    return Response(UserSerializer(request.user).data)


# ── Activities ────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def api_activity_list(request):
    q = request.query_params.get('q', '').strip()
    grade = request.query_params.get('grade', '')
    activity_type = request.query_params.get('type', '')
    standard = request.query_params.get('standard', '')

    qs = Activity.objects.filter(status='approved', is_restricted=False).prefetch_related('grade_levels', 'standards')

    if q:
        qs = qs.filter(
            Q(title__icontains=q) |
            Q(description__icontains=q) |
            Q(standards__code__icontains=q) |
            Q(concepts__name__icontains=q)
        ).distinct()
    if grade:
        qs = qs.filter(grade_levels__id=grade)
    if activity_type:
        qs = qs.filter(activity_type=activity_type)
    if standard:
        qs = qs.filter(standards__code__icontains=standard)

    return Response(ActivityListSerializer(qs, many=True).data)


@api_view(['GET'])
def api_activity_detail(request, pk):
    try:
        activity = Activity.objects.prefetch_related(
            'grade_levels', 'standards', 'concepts',
            'sections__prompts', 'sections__links',
        ).get(pk=pk)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    is_admin = request.user.is_staff or request.user.is_superuser
    is_assigned = activity.restricted_teachers.filter(pk=request.user.pk).exists()
    if not (activity.status == 'approved' or
            activity.created_by == request.user or
            is_admin or is_assigned):
        return Response({'error': 'Not found.'}, status=404)

    return Response(ActivityDetailSerializer(activity).data)


@api_view(['GET'])
def api_my_activities(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    qs = Activity.objects.filter(created_by=request.user).prefetch_related('grade_levels', 'standards')
    return Response(ActivityListSerializer(qs, many=True).data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_activity_create(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'Title is required.'}, status=400)

    activity = Activity.objects.create(
        title=title,
        description=request.data.get('description', ''),
        materials=request.data.get('materials', ''),
        activity_type=request.data.get('activity_type', 'challenge'),
        duration_minutes=int(request.data.get('duration_minutes', 0) or 0),
        video_url=request.data.get('video_url', ''),
        is_restricted=request.data.get('is_restricted', 'false').lower() == 'true',
        created_by=request.user,
        status='draft',
    )

    grade_ids = request.data.getlist('grade_levels') if hasattr(request.data, 'getlist') else request.data.get('grade_levels', [])
    if isinstance(grade_ids, str):
        grade_ids = [grade_ids]
    activity.grade_levels.set(grade_ids)

    restricted_raw = request.data.get('restricted_teacher_ids', '[]')
    try:
        restricted_ids = json.loads(restricted_raw) if isinstance(restricted_raw, str) else (restricted_raw if isinstance(restricted_raw, list) else [])
    except Exception:
        restricted_ids = []
    activity.restricted_teachers.set(restricted_ids)

    if request.FILES.get('instructions_pdf'):
        activity.instructions_pdf = request.FILES['instructions_pdf']
        activity.save()

    sections_json = request.data.get('sections_json', '[]')
    try:
        sections_data = json.loads(sections_json) if isinstance(sections_json, str) else sections_json
    except json.JSONDecodeError:
        sections_data = []
    _save_sections_from_json(activity, sections_data)

    _save_handout_files(activity, request)

    return Response(ActivityDetailSerializer(activity).data, status=201)


@api_view(['PUT', 'PATCH'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_activity_edit(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)

    is_admin = request.user.is_staff or request.user.is_superuser
    try:
        activity = Activity.objects.get(pk=pk) if is_admin else Activity.objects.get(pk=pk, created_by=request.user)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if not is_admin and activity.status not in ('draft', 'rejected'):
        return Response({'error': 'Cannot edit an approved activity.'}, status=403)

    activity.title = request.data.get('title', activity.title).strip() or activity.title
    activity.description = request.data.get('description', activity.description)
    activity.materials = request.data.get('materials', activity.materials)
    activity.activity_type = request.data.get('activity_type', activity.activity_type)
    activity.duration_minutes = int(request.data.get('duration_minutes', activity.duration_minutes) or 0)
    activity.video_url = request.data.get('video_url', activity.video_url)
    if 'is_restricted' in request.data:
        activity.is_restricted = request.data.get('is_restricted', 'false').lower() == 'true'

    grade_ids = request.data.getlist('grade_levels') if hasattr(request.data, 'getlist') else request.data.get('grade_levels', [])
    if isinstance(grade_ids, str):
        grade_ids = [grade_ids]
    if grade_ids:
        activity.grade_levels.set(grade_ids)

    if request.FILES.get('instructions_pdf'):
        activity.instructions_pdf = request.FILES['instructions_pdf']
    elif request.data.get('clear_instructions_pdf'):
        if activity.instructions_pdf:
            activity.instructions_pdf.delete(save=False)
            activity.instructions_pdf = None

    activity.save()

    if 'restricted_teacher_ids' in request.data:
        restricted_raw = request.data.get('restricted_teacher_ids', '[]')
        try:
            restricted_ids = json.loads(restricted_raw) if isinstance(restricted_raw, str) else (restricted_raw if isinstance(restricted_raw, list) else [])
        except Exception:
            restricted_ids = []
        activity.restricted_teachers.set(restricted_ids)

    sections_json = request.data.get('sections_json')
    if sections_json is not None:
        try:
            sections_data = json.loads(sections_json) if isinstance(sections_json, str) else sections_json
        except json.JSONDecodeError:
            sections_data = []
        _save_sections_from_json(activity, sections_data)

    _save_handout_files(activity, request)

    return Response(ActivityDetailSerializer(activity).data)


def _save_handout_files(activity, request):
    """Keep existing files the teacher chose to keep; append any newly uploaded files."""
    keep_ids_raw = request.data.get('keep_file_ids', '[]')
    try:
        keep_ids = json.loads(keep_ids_raw) if isinstance(keep_ids_raw, str) else list(keep_ids_raw)
    except Exception:
        keep_ids = []
    keep_ids = [int(k) for k in keep_ids if str(k).isdigit()]
    activity.handout_files.exclude(pk__in=keep_ids).delete()

    new_files    = request.FILES.getlist('handout_files')
    labels       = request.data.getlist('handout_labels')
    descriptions = request.data.getlist('handout_descriptions')
    base_order   = activity.handout_files.count()
    for i, f in enumerate(new_files):
        ActivityFile.objects.create(
            activity=activity, file=f,
            label=labels[i] if i < len(labels) else '',
            description=descriptions[i] if i < len(descriptions) else '',
            order=base_order + i,
        )


def _save_sections_from_json(activity, sections_data):
    """Save sections/prompts/links from a JSON structure sent by the React builder."""
    activity.sections.all().delete()
    for i, sec in enumerate(sections_data):
        section = ActivitySection.objects.create(
            activity=activity, title=sec.get('title', ''), order=i
        )
        for j, p in enumerate(sec.get('prompts', [])):
            prompt_text = p.get('text', '').strip()
            prompt_type = p.get('prompt_type', 'student')
            response_type = p.get('response_type', 'text')
            video_url = p.get('video_url', '').strip() if isinstance(p.get('video_url'), str) else ''
            if prompt_text or response_type == 'table' or prompt_type == 'video_embed':
                try:
                    table_headers = p.get('table_headers', []) or []
                    if isinstance(table_headers, str):
                        table_headers = json.loads(table_headers)
                except Exception:
                    table_headers = []
                ActivityPrompt.objects.create(
                    section=section,
                    text=prompt_text,
                    prompt_type=prompt_type,
                    response_type=response_type,
                    table_headers=table_headers,
                    video_url=video_url,
                    order=j,
                )
        for k, lnk in enumerate(sec.get('links', [])):
            url = lnk.get('url', '').strip()
            if url:
                SectionLink.objects.create(
                    section=section, url=url,
                    label=lnk.get('label', ''), order=k,
                )
        # Save standard codes
        standard_codes = sec.get('standard_codes', [])
        for code in standard_codes:
            try:
                std = Standard.objects.get(code=code.strip())
                activity.standards.add(std)
            except Standard.DoesNotExist:
                pass


@api_view(['POST'])
def api_activity_submit(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        activity = Activity.objects.get(pk=pk, created_by=request.user)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if activity.status == 'draft':
        activity.status = 'pending'
        activity.save()
    return Response({'status': activity.status})


@api_view(['DELETE'])
def api_activity_delete(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        activity = Activity.objects.get(pk=pk, created_by=request.user)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if activity.status != 'draft':
        return Response({'error': 'Only draft activities can be deleted.'}, status=400)
    activity.delete()
    return Response({'ok': True})


# ── Grade levels & metadata ───────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def api_grade_levels(request):
    return Response(GradeLevelSerializer(GradeLevel.objects.all(), many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_activity_types(request):
    return Response([{'value': v, 'label': l} for v, l in Activity.TYPE_CHOICES])


# ── Classrooms ────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_classrooms(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    if request.method == 'GET':
        qs = Classroom.objects.filter(teacher=request.user).prefetch_related('students', 'assigned_activities', 'assigned_modules')
        return Response(ClassroomListSerializer(qs, many=True).data)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'Name is required.'}, status=400)
    classroom = Classroom.objects.create(name=name, teacher=request.user)
    return Response(ClassroomListSerializer(classroom).data, status=201)


@api_view(['GET', 'DELETE'])
def api_classroom_detail(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teacher=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if request.method == 'DELETE':
        classroom.delete()
        return Response(status=204)
    return Response(ClassroomDetailSerializer(classroom).data)


@api_view(['POST'])
def api_classroom_assign_activities(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teacher=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    activity_ids = request.data.get('activity_ids', [])
    classroom.assigned_activities.set(activity_ids)
    return Response({'ok': True})


@api_view(['POST'])
def api_classroom_assign_modules(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teacher=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    module_ids = request.data.get('module_ids', [])
    classroom.assigned_modules.set(module_ids)
    return Response({'ok': True})


@api_view(['POST'])
def api_join_classroom(request):
    code = request.data.get('code', '').strip().upper()
    try:
        classroom = Classroom.objects.get(code=code)
        classroom.students.add(request.user)
        return Response({'classroom': classroom.name})
    except Classroom.DoesNotExist:
        return Response({'error': 'Invalid classroom code.'}, status=400)


@api_view(['GET'])
def api_student_classrooms(request):
    qs = request.user.enrolled_classrooms.prefetch_related(
        'assigned_activities__grade_levels',
        'assigned_modules__module_activities__activity__grade_levels',
        'teacher',
    ).all()
    result = []
    for classroom in qs:
        modules_data = []
        for module in classroom.assigned_modules.all():
            ordered = list(module.module_activities.select_related('activity').order_by('order'))
            prev_complete = True
            activities_data = []
            for ma in ordered:
                is_locked = not prev_complete
                is_complete = (not is_locked) and _activity_completed_by(ma.activity, request.user)
                activities_data.append({
                    'id': ma.activity.pk,
                    'title': ma.activity.title,
                    'activity_type': ma.activity.get_activity_type_display(),
                    'duration_minutes': ma.activity.duration_minutes,
                    'description': ma.activity.description,
                    'grade_levels': [g.name for g in ma.activity.grade_levels.all()],
                    'is_locked': is_locked,
                    'is_complete': is_complete,
                })
                prev_complete = is_complete
            modules_data.append({
                'id': module.pk,
                'title': module.title,
                'description': module.description,
                'activities': activities_data,
            })
        result.append({
            'id': classroom.pk,
            'name': classroom.name,
            'teacher': classroom.teacher.get_full_name() or classroom.teacher.username,
            'assigned_activities': ActivityListSerializer(classroom.assigned_activities.all(), many=True).data,
            'assigned_modules': modules_data,
        })
    return Response(result)


# ── Modules ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_modules(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    if request.method == 'GET':
        is_admin = request.user.is_staff or request.user.is_superuser
        qs = Module.objects.all() if is_admin else Module.objects.filter(created_by=request.user)
        qs = qs.prefetch_related('module_activities')
        return Response(ModuleSerializer(qs, many=True).data)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'Title is required.'}, status=400)
    module = Module.objects.create(
        title=title,
        description=request.data.get('description', ''),
        created_by=request.user,
    )
    activity_ids = request.data.get('activity_ids', [])
    for i, aid in enumerate(activity_ids):
        try:
            activity = Activity.objects.get(pk=int(aid), status='approved')
            ModuleActivity.objects.create(module=module, activity=activity, order=i)
        except (Activity.DoesNotExist, ValueError):
            pass
    return Response(ModuleSerializer(module).data, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
def api_module_detail(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    is_admin = request.user.is_staff or request.user.is_superuser
    try:
        module = Module.objects.get(pk=pk) if is_admin else Module.objects.get(pk=pk, created_by=request.user)
    except Module.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        module.delete()
        return Response(status=204)
    if request.method == 'PUT':
        module.title = request.data.get('title', module.title).strip() or module.title
        module.description = request.data.get('description', module.description)
        module.save()
        module.module_activities.all().delete()
        activity_ids = request.data.get('activity_ids', [])
        for i, aid in enumerate(activity_ids):
            try:
                activity = Activity.objects.get(pk=int(aid), status='approved')
                ModuleActivity.objects.create(module=module, activity=activity, order=i)
            except (Activity.DoesNotExist, ValueError):
                pass

    return Response(ModuleSerializer(module).data)


@api_view(['GET'])
def api_module_view(request, pk):
    """Student view of a module with lock/complete state per activity."""
    module = Module.objects.get(pk=pk) if Module.objects.filter(pk=pk).exists() else None
    if not module:
        return Response({'error': 'Not found.'}, status=404)
    is_teacher = _is_teacher(request.user)
    if not is_teacher:
        if not request.user.enrolled_classrooms.filter(assigned_modules=module).exists():
            return Response({'error': 'Not assigned to your classroom.'}, status=403)

    ordered = list(module.module_activities.select_related('activity').prefetch_related('activity__grade_levels').order_by('order'))
    prev_complete = True
    activities_data = []
    for ma in ordered:
        if is_teacher:
            is_locked = False
            is_complete = False
        else:
            is_locked = not prev_complete
            is_complete = (not is_locked) and _activity_completed_by(ma.activity, request.user)
        activities_data.append({
            'id': ma.activity.pk,
            'title': ma.activity.title,
            'activity_type': ma.activity.get_activity_type_display(),
            'duration_minutes': ma.activity.duration_minutes,
            'description': ma.activity.description,
            'grade_levels': [g.name for g in ma.activity.grade_levels.all()],
            'instructions_pdf': ma.activity.instructions_pdf.url if ma.activity.instructions_pdf else None,
            'is_locked': is_locked,
            'is_complete': is_complete,
        })
        prev_complete = is_complete

    return Response({
        'id': module.pk,
        'title': module.title,
        'description': module.description,
        'activities': activities_data,
    })


# ── Student responses ─────────────────────────────────────────────────────────

@api_view(['GET'])
def api_student_responses(request, activity_pk):
    """Get this student's responses for an activity."""
    responses = StudentResponse.objects.filter(
        student=request.user,
        prompt__section__activity_id=activity_pk,
    ).select_related('prompt', 'feedback')
    data = {r.prompt_id: StudentResponseSerializer(r).data for r in responses}
    return Response(data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_save_response(request, prompt_pk):
    try:
        prompt = ActivityPrompt.objects.get(pk=prompt_pk)
    except ActivityPrompt.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if prompt.response_type == 'video':
        video_file = request.FILES.get('response_video')
        if video_file:
            obj, _ = StudentResponse.objects.update_or_create(
                student=request.user, prompt=prompt,
                defaults={'response_video': video_file, 'response_text': ''},
            )
            return Response(StudentResponseSerializer(obj).data)
    elif prompt.response_type == 'table':
        table_data = request.data.get('response_table')
        if isinstance(table_data, str):
            try:
                table_data = json.loads(table_data)
            except Exception:
                table_data = None
        if table_data is not None:
            obj, _ = StudentResponse.objects.update_or_create(
                student=request.user, prompt=prompt,
                defaults={'response_table': table_data},
            )
            return Response(StudentResponseSerializer(obj).data)
    else:
        text = request.data.get('response_text', '')
        obj, _ = StudentResponse.objects.update_or_create(
            student=request.user, prompt=prompt,
            defaults={'response_text': text},
        )
        return Response(StudentResponseSerializer(obj).data)

    return Response({'ok': True})


# ── Teacher responses ─────────────────────────────────────────────────────────

@api_view(['GET'])
def api_teacher_responses(request, activity_pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        activity = Activity.objects.prefetch_related('sections__prompts').get(pk=activity_pk)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    direct_classrooms = Classroom.objects.filter(teacher=request.user, assigned_activities=activity)
    module_classrooms = Classroom.objects.filter(
        teacher=request.user,
        assigned_modules__module_activities__activity=activity,
    )
    all_classrooms = list((direct_classrooms | module_classrooms).distinct())

    classroom_id = request.query_params.get('classroom')
    active_classroom = None
    if classroom_id:
        try:
            active_classroom = next(c for c in all_classrooms if c.id == int(classroom_id))
        except (StopIteration, ValueError):
            pass
    if active_classroom is None and all_classrooms:
        active_classroom = all_classrooms[0]

    if active_classroom:
        students = User.objects.filter(enrolled_classrooms=active_classroom).distinct()
    else:
        students = User.objects.filter(enrolled_classrooms__in=all_classrooms).distinct()

    responses = StudentResponse.objects.filter(
        prompt__section__activity=activity,
        student__in=students,
    ).select_related('student', 'prompt', 'feedback')

    resp_map = {}
    for r in responses:
        resp_map.setdefault(r.student_id, {})[r.prompt_id] = TeacherStudentResponseSerializer(r).data

    # Section point values configured for this classroom
    section_points = {}
    if active_classroom:
        for sp in ClassroomSectionPoints.objects.filter(
            classroom=active_classroom, section__activity=activity
        ):
            section_points[sp.section_id] = sp.max_points

    # Student section scores for this classroom
    scores_map = {}
    if active_classroom:
        for sc in StudentSectionScore.objects.filter(
            section__activity=activity,
            student__in=students,
            classroom=active_classroom,
        ):
            scores_map.setdefault(sc.student_id, {})[sc.section_id] = sc.points_earned

    from .serializers import ActivityDetailSerializer
    return Response({
        'activity': ActivityDetailSerializer(activity).data,
        'classrooms': [{'id': c.id, 'name': c.name} for c in all_classrooms],
        'active_classroom_id': active_classroom.id if active_classroom else None,
        'section_points': {str(k): v for k, v in section_points.items()},
        'students': [
            {
                'id': s.id,
                'name': s.get_full_name() or s.username,
                'username': s.username,
                'responses': resp_map.get(s.id, {}),
                'section_scores': {str(k): v for k, v in scores_map.get(s.id, {}).items()},
            }
            for s in students
        ],
    })


@api_view(['GET', 'POST'])
def api_classroom_activity_points(request, classroom_pk, activity_pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=classroom_pk, teacher=request.user)
        activity = Activity.objects.prefetch_related('sections').get(pk=activity_pk)
    except (Classroom.DoesNotExist, Activity.DoesNotExist):
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        pts = ClassroomSectionPoints.objects.filter(
            classroom=classroom, section__activity=activity
        )
        return Response({str(p.section_id): p.max_points for p in pts})

    for section_id_str, max_pts in request.data.items():
        try:
            section = ActivitySection.objects.get(pk=int(section_id_str), activity=activity)
            ClassroomSectionPoints.objects.update_or_create(
                classroom=classroom, section=section,
                defaults={'max_points': int(max_pts) if str(max_pts).strip() else 0},
            )
        except (ValueError, ActivitySection.DoesNotExist):
            pass
    return Response({'ok': True})


@api_view(['POST'])
def api_save_section_score(request, section_pk, student_pk, classroom_pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        section = ActivitySection.objects.get(pk=section_pk)
        student = User.objects.get(pk=student_pk)
        classroom = Classroom.objects.get(pk=classroom_pk, teacher=request.user)
    except (ActivitySection.DoesNotExist, User.DoesNotExist, Classroom.DoesNotExist):
        return Response({'error': 'Not found.'}, status=404)

    raw = request.data.get('points_earned', '')
    if raw is None or str(raw).strip() == '':
        StudentSectionScore.objects.filter(
            student=student, classroom=classroom, section=section
        ).delete()
        return Response({'ok': True})

    try:
        pts = int(raw)
    except (ValueError, TypeError):
        return Response({'error': 'Invalid points value.'}, status=400)

    StudentSectionScore.objects.update_or_create(
        student=student, classroom=classroom, section=section,
        defaults={'points_earned': pts, 'graded_by': request.user},
    )
    return Response({'ok': True})


@api_view(['POST'])
def api_save_feedback(request, response_pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        response = StudentResponse.objects.get(pk=response_pk)
    except StudentResponse.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    text = request.data.get('text', '').strip()
    if text:
        TeacherFeedback.objects.update_or_create(
            response=response, defaults={'teacher': request.user, 'text': text}
        )
    return Response({'ok': True})


# ── Admin ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def api_admin_dashboard(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    pending_teachers = TeacherProfile.objects.filter(is_approved=False).select_related('user')
    pending_teach_stem = TeacherProfile.objects.filter(
        is_approved=True, is_teach_stem=True, teach_stem_approved=False
    ).select_related('user')
    pending_activities = Activity.objects.filter(status='pending').select_related('created_by').prefetch_related('grade_levels')
    return Response({
        'pending_teachers': [
            {'id': tp.user.id, 'name': tp.user.get_full_name() or tp.user.username,
             'username': tp.user.username, 'email': tp.user.email,
             'is_teach_stem': tp.is_teach_stem}
            for tp in pending_teachers
        ],
        'pending_teach_stem': [
            {'id': tp.user.id, 'name': tp.user.get_full_name() or tp.user.username,
             'username': tp.user.username, 'email': tp.user.email}
            for tp in pending_teach_stem
        ],
        'pending_activities': ActivityListSerializer(pending_activities, many=True).data,
    })


@api_view(['POST'])
def api_admin_action(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    action = request.data.get('action')
    if action == 'approve_teacher':
        try:
            tp = TeacherProfile.objects.get(user_id=request.data.get('user_id'))
            tp.is_approved = True
            tp.save()
            return Response({'ok': True})
        except TeacherProfile.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
    elif action in ('approve_teach_stem', 'reject_teach_stem'):
        try:
            tp = TeacherProfile.objects.get(user_id=request.data.get('user_id'))
            tp.teach_stem_approved = (action == 'approve_teach_stem')
            tp.save()
            return Response({'ok': True})
        except TeacherProfile.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
    elif action in ('approve_activity', 'reject_activity'):
        try:
            activity = Activity.objects.get(pk=request.data.get('activity_id'))
            activity.status = 'approved' if action == 'approve_activity' else 'rejected'
            activity.save()
            return Response({'ok': True})
        except Activity.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
    return Response({'error': 'Unknown action.'}, status=400)


# ── Teach STEM ────────────────────────────────────────────────────────────────

def _teach_stem_required(request):
    if not request.user.is_authenticated:
        return False
    if request.user.is_staff or request.user.is_superuser:
        return True
    return hasattr(request.user, 'teacher_profile') and request.user.teacher_profile.teach_stem_approved


@api_view(['GET', 'POST'])
def api_lesson_feedback(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    if request.method == 'POST':
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        serializer = LessonFeedbackSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(teacher=request.user)
        return Response(serializer.data, status=201)

    submissions = LessonFeedback.objects.filter(teacher=request.user).select_related(
        'activity', 'grade_level', 'classroom'
    )
    return Response(LessonFeedbackSerializer(submissions, many=True).data)


@api_view(['GET', 'POST'])
def api_teach_stem_profile(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    profile, _ = TeachSTEMProfile.objects.get_or_create(teacher=request.user)

    if request.method == 'GET':
        return Response(TeachSTEMProfileSerializer(profile).data)

    serializer = TeachSTEMProfileSerializer(profile, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
def api_teach_stem_tasks(request):
    is_admin = request.user.is_staff or request.user.is_superuser

    if request.method == 'GET':
        if not (_teach_stem_required(request) or is_admin):
            return Response({'error': 'Access required.'}, status=403)
        tasks = TeachSTEMTask.objects.prefetch_related('completions').all()
        return Response(TeachSTEMTaskSerializer(tasks, many=True, context={'request': request}).data)

    if not is_admin:
        return Response({'error': 'Admin access required.'}, status=403)
    serializer = TeachSTEMTaskSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(created_by=request.user)
    return Response(serializer.data, status=201)


@api_view(['PUT', 'DELETE'])
def api_teach_stem_task_detail(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        task = TeachSTEMTask.objects.get(pk=pk)
    except TeachSTEMTask.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        task.delete()
        return Response({'ok': True})

    serializer = TeachSTEMTaskSerializer(task, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def api_teach_stem_task_complete(request, pk):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    try:
        task = TeachSTEMTask.objects.get(pk=pk)
    except TeachSTEMTask.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    completion, created = TeachSTEMTaskCompletion.objects.get_or_create(
        teacher=request.user, task=task
    )
    if not created:
        completion.delete()
        return Response({'completed': False})
    return Response({'completed': True})


@api_view(['GET', 'POST'])
def api_project_topics(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    if request.method == 'GET':
        submissions = ProjectTopicSubmission.objects.filter(teacher=request.user)
        return Response(ProjectTopicSubmissionSerializer(submissions, many=True).data)

    serializer = ProjectTopicSubmissionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(teacher=request.user)
    return Response(serializer.data, status=201)


@api_view(['POST'])
def api_project_topic_submit(request, pk):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    try:
        sub = ProjectTopicSubmission.objects.get(pk=pk, teacher=request.user)
    except ProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if sub.status != 'draft':
        return Response({'error': 'Already submitted.'}, status=400)
    questions = [q for q in (sub.research_questions or []) if q.strip()]
    if len(questions) < 3:
        return Response({'error': 'At least 3 research questions are required.'}, status=400)
    sub.status = 'submitted'
    sub.save()
    return Response(ProjectTopicSubmissionSerializer(sub).data)


@api_view(['GET'])
def api_admin_project_topics(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    subs = ProjectTopicSubmission.objects.filter(status__in=['submitted', 'reviewed']).select_related('teacher', 'reviewed_by')
    return Response(ProjectTopicSubmissionSerializer(subs, many=True).data)


@api_view(['POST'])
def api_admin_project_topic_feedback(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        sub = ProjectTopicSubmission.objects.get(pk=pk)
    except ProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    from django.utils import timezone
    sub.admin_feedback = request.data.get('feedback', '').strip()
    sub.reviewed_by = request.user
    sub.reviewed_at = timezone.now()
    sub.status = 'reviewed'
    sub.save()
    return Response(ProjectTopicSubmissionSerializer(sub).data)


@api_view(['GET'])
def api_admin_teach_stem_teachers(request):
    """Return all approved Teach STEM teachers for the restricted-activity assignment UI."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    from django.contrib.auth import get_user_model
    User = get_user_model()
    teachers = User.objects.filter(
        teacher_profile__is_approved=True,
        teacher_profile__teach_stem_approved=True,
    ).order_by('last_name', 'first_name')
    return Response([
        {'id': t.id, 'name': t.get_full_name() or t.username, 'email': t.email}
        for t in teachers
    ])


@api_view(['GET'])
def api_admin_all_teachers(request):
    """Search all approved teacher accounts."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    q = request.GET.get('q', '').strip()
    from django.db.models import Q
    qs = TeacherProfile.objects.filter(is_approved=True).select_related('user')
    if q:
        qs = qs.filter(
            Q(user__first_name__icontains=q) |
            Q(user__last_name__icontains=q) |
            Q(user__username__icontains=q) |
            Q(user__email__icontains=q)
        )
    return Response([
        {
            'id': tp.user.id,
            'name': tp.user.get_full_name() or tp.user.username,
            'username': tp.user.username,
            'email': tp.user.email,
            'teach_stem_approved': tp.teach_stem_approved,
        }
        for tp in qs.order_by('user__last_name', 'user__first_name')
    ])


@api_view(['POST'])
def api_admin_toggle_teach_stem(request, user_id):
    """Toggle a teacher's Teach STEM approved status."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        tp = TeacherProfile.objects.get(user_id=user_id)
        tp.teach_stem_approved = not tp.teach_stem_approved
        tp.save()
        return Response({'teach_stem_approved': tp.teach_stem_approved})
    except TeacherProfile.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)


@api_view(['GET'])
def api_admin_tstem_survey_results(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    results = TStemSurveyResponse.objects.order_by('-completed', 'id')
    return Response([
        {
            'completed': r.completed,
            'responses': r.responses,
        }
        for r in results
    ])


@api_view(['GET'])
def api_admin_teacher_survey_results(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    results = TeacherSurveyResponse.objects.order_by('-completed', 'id')
    return Response([
        {
            'completed': r.completed,
            'responses': r.responses,
        }
        for r in results
    ])


@api_view(['GET'])
def api_teach_stem_assigned_activities(request):
    """Return restricted activities that have been assigned to the current Teach STEM teacher."""
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    activities = Activity.objects.filter(
        status='approved',
        is_restricted=True,
        restricted_teachers=request.user,
    ).prefetch_related('grade_levels', 'standards')
    return Response(ActivityListSerializer(activities, many=True).data)


@api_view(['GET', 'POST'])
def api_tstem_survey(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    survey, _ = TStemSurveyResponse.objects.get_or_create(teacher=request.user)

    if request.method == 'GET':
        return Response(TStemSurveyResponseSerializer(survey).data)

    from django.utils import timezone
    responses = request.data.get('responses', survey.responses)
    completed = request.data.get('completed', False)
    survey.responses = responses
    if completed and not survey.completed:
        survey.completed = True
        survey.completed_at = timezone.now()
    survey.save()
    return Response(TStemSurveyResponseSerializer(survey).data)


@api_view(['GET', 'POST'])
def api_teacher_survey(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)

    survey, _ = TeacherSurveyResponse.objects.get_or_create(teacher=request.user)

    if request.method == 'GET':
        return Response(TeacherSurveyResponseSerializer(survey).data)

    from django.utils import timezone
    responses = request.data.get('responses', survey.responses)
    completed = request.data.get('completed', False)
    survey.responses = responses
    if completed and not survey.completed:
        survey.completed = True
        survey.completed_at = timezone.now()
    survey.save()
    return Response(TeacherSurveyResponseSerializer(survey).data)


# --- 3-2-1 Formative Assessment ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_321_assignments(request):
    if request.method == 'GET':
        if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Access denied.'}, status=403)
        if request.user.is_staff or request.user.is_superuser:
            qs = ThreeTwoOneAssignment.objects.prefetch_related('classrooms', 'responses')
        else:
            qs = ThreeTwoOneAssignment.objects.filter(
                created_by=request.user
            ).prefetch_related('classrooms', 'responses')
        return Response(ThreeTwoOneAssignmentSerializer(qs, many=True, context={'request': request}).data)

    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    classroom_ids = request.data.get('classrooms', [])
    activity_id = request.data.get('activity')
    title = request.data.get('title', '')
    response_type = request.data.get('response_type', 'written')
    if response_type not in ('written', 'video'):
        response_type = 'written'

    assignment = ThreeTwoOneAssignment.objects.create(
        title=title,
        created_by=request.user,
        activity_id=activity_id if activity_id else None,
        response_type=response_type,
    )
    if classroom_ids:
        assignment.classrooms.set(Classroom.objects.filter(id__in=classroom_ids))

    return Response(
        ThreeTwoOneAssignmentSerializer(assignment, context={'request': request}).data,
        status=201,
    )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def api_321_assignment_detail(request, pk):
    if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Access denied.'}, status=403)
    try:
        assignment = ThreeTwoOneAssignment.objects.get(pk=pk)
    except ThreeTwoOneAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if not (request.user.is_staff or request.user.is_superuser) and assignment.created_by != request.user:
        return Response({'error': 'Permission denied.'}, status=403)

    if request.method == 'DELETE':
        assignment.delete()
        return Response(status=204)

    if 'is_open' in request.data:
        assignment.is_open = request.data['is_open']
    if 'title' in request.data:
        assignment.title = request.data['title']
    if 'classrooms' in request.data:
        assignment.classrooms.set(Classroom.objects.filter(id__in=request.data['classrooms']))
    if 'response_type' in request.data and request.data['response_type'] in ('written', 'video'):
        assignment.response_type = request.data['response_type']
    assignment.save()
    return Response(ThreeTwoOneAssignmentSerializer(assignment, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_321_responses(request, pk):
    if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Access denied.'}, status=403)
    try:
        assignment = ThreeTwoOneAssignment.objects.get(pk=pk)
    except ThreeTwoOneAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if not (request.user.is_staff or request.user.is_superuser) and assignment.created_by != request.user:
        return Response({'error': 'Permission denied.'}, status=403)

    responses = assignment.responses.select_related('student').all()
    return Response(ThreeTwoOneResponseSerializer(responses, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_321_student_list(request):
    enrolled_classroom_ids = request.user.enrolled_classrooms.values_list('id', flat=True)
    assignments = ThreeTwoOneAssignment.objects.filter(
        classrooms__id__in=enrolled_classroom_ids,
        is_open=True,
    ).prefetch_related('classrooms', 'responses').distinct()
    return Response(ThreeTwoOneAssignmentSerializer(assignments, many=True, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_321_student_respond(request, pk):
    try:
        assignment = ThreeTwoOneAssignment.objects.get(pk=pk)
    except ThreeTwoOneAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        try:
            resp = ThreeTwoOneResponse.objects.get(assignment=assignment, student=request.user)
            return Response(ThreeTwoOneResponseSerializer(resp, context={'request': request}).data)
        except ThreeTwoOneResponse.DoesNotExist:
            return Response({})

    if not assignment.is_open:
        return Response({'error': 'This assignment is closed.'}, status=400)

    if ThreeTwoOneResponse.objects.filter(assignment=assignment, student=request.user).exists():
        return Response({'error': 'You have already submitted a response.'}, status=400)

    d = request.data

    if assignment.response_type == 'video':
        video_file = request.FILES.get('response_video')
        if not video_file:
            return Response({'error': 'A video file is required.'}, status=400)
        resp = ThreeTwoOneResponse.objects.create(
            assignment=assignment,
            student=request.user,
            response_video=video_file,
        )
    else:
        required = ['learned_1', 'learned_2', 'learned_3', 'question_1', 'question_2', 'most_interesting']
        for field in required:
            if not d.get(field, '').strip():
                return Response({'error': f'{field} is required.'}, status=400)
        resp = ThreeTwoOneResponse.objects.create(
            assignment=assignment,
            student=request.user,
            learned_1=d['learned_1'].strip(),
            learned_2=d['learned_2'].strip(),
            learned_3=d['learned_3'].strip(),
            question_1=d['question_1'].strip(),
            question_2=d['question_2'].strip(),
            most_interesting=d['most_interesting'].strip(),
        )

    return Response(ThreeTwoOneResponseSerializer(resp, context={'request': request}).data, status=201)
