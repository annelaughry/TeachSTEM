import json
import os
from django.contrib.auth import authenticate
from django.core.files.base import ContentFile
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import HttpResponse
from django.utils.text import slugify
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
    ClassroomSectionPoints, StudentSectionScore, TeacherProjectReflection, ReflectionFile,
    TeachSTEMProfile, TeachSTEMTask,
    TeachSTEMTaskCompletion, ProjectTopicSubmission, ProjectStarter, TopicSuggestion, TStemSurveyResponse, TeacherSurveyResponse,
    ForumThread, ForumReply,
    ThreeTwoOneAssignment, ThreeTwoOneResponse,
    StudentReflectionAssignment, StudentReflectionResponse,
    StaffProfile, StaffTask, StaffTaskCompletion, StaffProjectTopicSubmission, StaffProjectStarter,
    StaffProjectReflection, StaffReflectionFile,
)
from core.views import _is_teacher, _save_sections_and_standards, _activity_completed_by
from .pdf import render_activity_pdf
from .serializers import (
    UserSerializer, ActivityListSerializer, ActivityDetailSerializer, ActivitySectionSerializer,
    GradeLevelSerializer, StandardSerializer, ClassroomListSerializer,
    ClassroomDetailSerializer, ModuleSerializer, StudentResponseSerializer,
    TeacherStudentResponseSerializer, TeacherFeedbackSerializer,
    TeacherProjectReflectionSerializer, TeachSTEMProfileSerializer, TeachSTEMTaskSerializer,
    ProjectTopicSubmissionSerializer, ProjectStarterSerializer, TopicSuggestionSerializer, TStemSurveyResponseSerializer,
    ForumThreadListSerializer, ForumThreadDetailSerializer, ForumReplySerializer,
    ThreeTwoOneAssignmentSerializer, ThreeTwoOneResponseSerializer,
    StudentReflectionAssignmentSerializer, StudentReflectionResponseSerializer,
    TeacherSurveyResponseSerializer,
    StaffProfileSerializer, StaffTaskSerializer, StaffProjectTopicSubmissionSerializer,
    StaffProjectStarterSerializer, StaffProjectReflectionSerializer,
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
    is_program_staff = request.data.get('is_program_staff', False)
    TeacherProfile.objects.create(
        user=user, is_approved=False,
        is_teach_stem=bool(is_teach_stem), is_program_staff=bool(is_program_staff),
    )
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


def _get_visible_activity_or_none(request, pk):
    """Same visibility rule as api_activity_detail: approved, owned, admin, or assigned-restricted."""
    try:
        activity = Activity.objects.prefetch_related(
            'grade_levels', 'standards', 'concepts',
            'sections__prompts', 'sections__links',
        ).get(pk=pk)
    except Activity.DoesNotExist:
        return None

    is_admin = request.user.is_staff or request.user.is_superuser
    is_assigned = activity.restricted_teachers.filter(pk=request.user.pk).exists()
    if not (activity.status == 'approved' or
            activity.created_by == request.user or
            is_admin or is_assigned):
        return None
    return activity


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
def api_activity_pdf_teacher(request, pk):
    activity = _get_visible_activity_or_none(request, pk)
    if activity is None:
        return Response({'error': 'Not found.'}, status=404)
    if activity.status != 'approved':
        return Response({'error': 'This lesson must be approved before a PDF can be downloaded.'}, status=403)

    sections = []
    for section in activity.sections.all():
        prompts = []
        for p in section.prompts.all():
            prompts.append({
                'kind': p.prompt_type,
                'text': p.text,
                'video_url': p.video_url,
                'response_type_display': p.get_response_type_display(),
                'table_headers': p.table_headers,
                'table_row_labels': p.table_row_labels,
            })
        sections.append({
            'title': section.title,
            'links': list(section.links.all()),
            'prompts': prompts,
        })

    context = {
        'activity': activity,
        'grade_levels': activity.grade_levels.all(),
        'standards': activity.standards.all(),
        'materials_lines': [line for line in activity.materials.split('\n') if line],
        'sections': sections,
    }
    pdf_bytes = render_activity_pdf('pdf/teacher.html', context)
    return _pdf_response(pdf_bytes, f'{slugify(activity.title)}-teacher.pdf')


@api_view(['GET'])
def api_activity_pdf_student(request, pk):
    activity = _get_visible_activity_or_none(request, pk)
    if activity is None:
        return Response({'error': 'Not found.'}, status=404)
    if activity.status != 'approved':
        return Response({'error': 'This lesson must be approved before a PDF can be downloaded.'}, status=403)

    sections = []
    for section in activity.sections.all():
        blocks = []
        for p in section.prompts.all():
            if p.prompt_type == 'instruction':
                blocks.append({'type': 'instruction', 'text': p.text})
            elif p.prompt_type == 'video_embed':
                blocks.append({'type': 'video', 'text': p.text, 'url': p.video_url})
            elif p.prompt_type == 'student':
                if p.response_type == 'table':
                    blocks.append({'type': 'table_prompt', 'text': p.text, 'headers': p.table_headers, 'row_labels': p.table_row_labels})
                elif p.response_type == 'video':
                    blocks.append({'type': 'video_prompt', 'text': p.text})
                else:
                    blocks.append({'type': 'text_prompt', 'text': p.text})
            # 'teacher' notes are intentionally excluded from the student handout.
        if blocks:
            sections.append({'title': section.title, 'blocks': blocks})

    context = {
        'activity': activity,
        'grade_levels': activity.grade_levels.all(),
        'sections': sections,
    }
    pdf_bytes = render_activity_pdf('pdf/student.html', context)
    return _pdf_response(pdf_bytes, f'{slugify(activity.title)}-student-handout.pdf')


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


@api_view(['POST'])
def api_activity_copy(request, pk):
    """Deep-clone an activity (sections/prompts/links/files) into a new draft owned by the
    requesting teacher, so they can customize it for their class without touching the original."""
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        source = Activity.objects.get(pk=pk)
    except Activity.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    clone = Activity.objects.create(
        title=f"{source.title} (Copy)",
        description=source.description,
        materials=source.materials,
        activity_type=source.activity_type,
        duration_minutes=source.duration_minutes,
        video_url=source.video_url,
        is_restricted=False,
        created_by=request.user,
        status='draft',
        source_activity=source,
    )
    clone.grade_levels.set(source.grade_levels.all())
    clone.standards.set(source.standards.all())
    clone.concepts.set(source.concepts.all())

    if source.instructions_pdf:
        clone.instructions_pdf.save(
            os.path.basename(source.instructions_pdf.name),
            ContentFile(source.instructions_pdf.read()),
            save=True,
        )

    sections_data = ActivitySectionSerializer(source.sections.all(), many=True).data
    _save_sections_from_json(clone, sections_data)

    for f in source.handout_files.all():
        new_file = ActivityFile(activity=clone, label=f.label, description=f.description, order=f.order)
        new_file.file.save(os.path.basename(f.file.name), ContentFile(f.file.read()), save=True)

    return Response(ActivityDetailSerializer(clone).data, status=201)


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
                try:
                    table_row_labels = p.get('table_row_labels', []) or []
                    if isinstance(table_row_labels, str):
                        table_row_labels = json.loads(table_row_labels)
                except Exception:
                    table_row_labels = []
                ActivityPrompt.objects.create(
                    section=section,
                    text=prompt_text,
                    prompt_type=prompt_type,
                    response_type=response_type,
                    table_headers=table_headers,
                    table_row_labels=table_row_labels,
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
        qs = Classroom.objects.filter(teachers=request.user).prefetch_related('students', 'assigned_activities', 'assigned_modules')
        return Response(ClassroomListSerializer(qs, many=True).data)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'Name is required.'}, status=400)
    classroom = Classroom.objects.create(name=name)
    classroom.teachers.add(request.user)
    return Response(ClassroomListSerializer(classroom).data, status=201)


@api_view(['GET', 'DELETE'])
def api_classroom_detail(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teachers=request.user)
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
        classroom = Classroom.objects.get(pk=pk, teachers=request.user)
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
        classroom = Classroom.objects.get(pk=pk, teachers=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    module_ids = request.data.get('module_ids', [])
    classroom.assigned_modules.set(module_ids)
    return Response({'ok': True})


@api_view(['GET'])
def api_teacher_search(request):
    """Search approved teacher accounts, for adding a co-teacher to a classroom."""
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    q = request.GET.get('q', '').strip()
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
        }
        for tp in qs.order_by('user__last_name', 'user__first_name')
    ])


@api_view(['POST'])
def api_classroom_add_teacher(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teachers=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    try:
        target = User.objects.get(pk=request.data.get('user_id'))
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Teacher not found.'}, status=404)
    if not (hasattr(target, 'teacher_profile') and target.teacher_profile.is_approved):
        return Response({'error': 'Teacher not found.'}, status=404)
    classroom.teachers.add(target)
    return Response(ClassroomDetailSerializer(classroom).data)


@api_view(['POST'])
def api_classroom_remove_teacher(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        classroom = Classroom.objects.get(pk=pk, teachers=request.user)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if classroom.teachers.count() <= 1:
        return Response({'error': 'A classroom must have at least one teacher.'}, status=400)
    try:
        target = User.objects.get(pk=request.data.get('user_id'))
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Teacher not found.'}, status=404)
    classroom.teachers.remove(target)
    return Response(ClassroomDetailSerializer(classroom).data)


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
        'teachers',
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
            'teachers': [t.get_full_name() or t.username for t in classroom.teachers.all()],
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
    elif prompt.response_type == 'drawing':
        drawing_file = request.FILES.get('response_drawing')
        if drawing_file:
            obj, _ = StudentResponse.objects.update_or_create(
                student=request.user, prompt=prompt,
                defaults={'response_drawing': drawing_file, 'response_text': ''},
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

    direct_classrooms = Classroom.objects.filter(teachers=request.user, assigned_activities=activity)
    module_classrooms = Classroom.objects.filter(
        teachers=request.user,
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
        classroom = Classroom.objects.get(pk=classroom_pk, teachers=request.user)
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
        classroom = Classroom.objects.get(pk=classroom_pk, teachers=request.user)
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
    pending_program_staff = TeacherProfile.objects.filter(
        is_approved=True, is_program_staff=True, program_staff_approved=False
    ).select_related('user')
    pending_activities = Activity.objects.filter(status='pending').select_related('created_by').prefetch_related('grade_levels')
    return Response({
        'pending_teachers': [
            {'id': tp.user.id, 'name': tp.user.get_full_name() or tp.user.username,
             'username': tp.user.username, 'email': tp.user.email,
             'is_teach_stem': tp.is_teach_stem, 'is_program_staff': tp.is_program_staff}
            for tp in pending_teachers
        ],
        'pending_teach_stem': [
            {'id': tp.user.id, 'name': tp.user.get_full_name() or tp.user.username,
             'username': tp.user.username, 'email': tp.user.email}
            for tp in pending_teach_stem
        ],
        'pending_program_staff': [
            {'id': tp.user.id, 'name': tp.user.get_full_name() or tp.user.username,
             'username': tp.user.username, 'email': tp.user.email}
            for tp in pending_program_staff
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
    elif action in ('approve_program_staff', 'reject_program_staff'):
        try:
            tp = TeacherProfile.objects.get(user_id=request.data.get('user_id'))
            tp.program_staff_approved = (action == 'approve_program_staff')
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
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_project_reflections(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    if request.method == 'GET':
        submissions = TeacherProjectReflection.objects.filter(teacher=request.user).prefetch_related('files')
        return Response(TeacherProjectReflectionSerializer(submissions, many=True).data)

    project_name = request.data.get('project_name', '').strip()
    if not project_name:
        return Response({'error': 'Please tell us which STEM project you implemented.'}, status=400)

    future_plans_raw = request.data.get('future_plans', '[]')
    try:
        future_plans = json.loads(future_plans_raw) if isinstance(future_plans_raw, str) else list(future_plans_raw)
    except Exception:
        future_plans = []

    reflection = TeacherProjectReflection.objects.create(
        teacher=request.user,
        project_name=project_name,
        success_rating=request.data.get('success_rating', ''),
        engagement=request.data.get('engagement', ''),
        evidence_of_learning=request.data.get('evidence_of_learning', ''),
        improvements=request.data.get('improvements', ''),
        future_plans=future_plans,
        additional_comments=request.data.get('additional_comments', ''),
    )

    for f in request.FILES.getlist('student_work_files'):
        ReflectionFile.objects.create(reflection=reflection, kind='student_work', file=f, label=f.name)
    for f in request.FILES.getlist('supporting_material_files'):
        ReflectionFile.objects.create(reflection=reflection, kind='supporting_material', file=f, label=f.name)

    return Response(TeacherProjectReflectionSerializer(reflection).data, status=201)


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


@api_view(['PUT'])
def api_project_topic_update(request, pk):
    """Edit a plan the teacher already saved — including ones already submitted or reviewed.
    Any edit pulls it back to 'draft' so it must be resubmitted before an admin sees the changes."""
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    try:
        sub = ProjectTopicSubmission.objects.get(pk=pk, teacher=request.user)
    except ProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    serializer = ProjectTopicSubmissionSerializer(sub, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(status='draft')
    return Response(ProjectTopicSubmissionSerializer(sub).data)


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


@api_view(['GET', 'POST'])
def api_project_starters(request):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    if request.method == 'GET':
        submissions = ProjectStarter.objects.filter(teacher=request.user)
        return Response(ProjectStarterSerializer(submissions, many=True).data)

    serializer = ProjectStarterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(teacher=request.user)
    return Response(serializer.data, status=201)


@api_view(['PUT'])
def api_project_starter_update(request, pk):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    try:
        starter = ProjectStarter.objects.get(pk=pk, teacher=request.user)
    except ProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if starter.status != 'draft':
        return Response({'error': 'Only drafts can be edited.'}, status=400)
    serializer = ProjectStarterSerializer(starter, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def api_project_starter_submit(request, pk):
    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)
    try:
        starter = ProjectStarter.objects.get(pk=pk, teacher=request.user)
    except ProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if starter.status != 'draft':
        return Response({'error': 'Already submitted.'}, status=400)
    if not starter.title.strip():
        return Response({'error': 'A title is required to submit for review.'}, status=400)
    starter.status = 'submitted'
    starter.save()
    return Response(ProjectStarterSerializer(starter).data)


@api_view(['GET'])
def api_admin_project_starters(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    starters = ProjectStarter.objects.filter(status__in=['submitted', 'reviewed']).select_related('teacher', 'reviewed_by')
    return Response(ProjectStarterSerializer(starters, many=True).data)


@api_view(['POST'])
def api_admin_project_starter_feedback(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        starter = ProjectStarter.objects.get(pk=pk)
    except ProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    from django.utils import timezone
    starter.admin_feedback = request.data.get('feedback', '').strip()
    starter.reviewed_by = request.user
    starter.reviewed_at = timezone.now()
    starter.status = 'reviewed'
    starter.save()
    return Response(ProjectStarterSerializer(starter).data)


# ── Staff ─────────────────────────────────────────────────────────────────────

def _program_staff_required(request):
    if not request.user.is_authenticated:
        return False
    if request.user.is_staff or request.user.is_superuser:
        return True
    return hasattr(request.user, 'teacher_profile') and request.user.teacher_profile.program_staff_approved


@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_staff_project_reflections(request):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)

    if request.method == 'GET':
        submissions = StaffProjectReflection.objects.filter(teacher=request.user).prefetch_related('files')
        return Response(StaffProjectReflectionSerializer(submissions, many=True).data)

    project_name = request.data.get('project_name', '').strip()
    if not project_name:
        return Response({'error': 'Please tell us which project you implemented.'}, status=400)

    future_plans_raw = request.data.get('future_plans', '[]')
    try:
        future_plans = json.loads(future_plans_raw) if isinstance(future_plans_raw, str) else list(future_plans_raw)
    except Exception:
        future_plans = []

    reflection = StaffProjectReflection.objects.create(
        teacher=request.user,
        project_name=project_name,
        success_rating=request.data.get('success_rating', ''),
        engagement=request.data.get('engagement', ''),
        evidence_of_learning=request.data.get('evidence_of_learning', ''),
        improvements=request.data.get('improvements', ''),
        future_plans=future_plans,
        additional_comments=request.data.get('additional_comments', ''),
    )

    for f in request.FILES.getlist('student_work_files'):
        StaffReflectionFile.objects.create(reflection=reflection, kind='student_work', file=f, label=f.name)
    for f in request.FILES.getlist('supporting_material_files'):
        StaffReflectionFile.objects.create(reflection=reflection, kind='supporting_material', file=f, label=f.name)

    return Response(StaffProjectReflectionSerializer(reflection).data, status=201)


@api_view(['GET', 'POST'])
def api_staff_profile(request):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)

    profile, _ = StaffProfile.objects.get_or_create(teacher=request.user)

    if request.method == 'GET':
        return Response(StaffProfileSerializer(profile).data)

    serializer = StaffProfileSerializer(profile, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
def api_staff_tasks(request):
    is_admin = request.user.is_staff or request.user.is_superuser

    if request.method == 'GET':
        if not (_program_staff_required(request) or is_admin):
            return Response({'error': 'Access required.'}, status=403)
        tasks = StaffTask.objects.prefetch_related('completions').all()
        return Response(StaffTaskSerializer(tasks, many=True, context={'request': request}).data)

    if not is_admin:
        return Response({'error': 'Admin access required.'}, status=403)
    serializer = StaffTaskSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(created_by=request.user)
    return Response(serializer.data, status=201)


@api_view(['PUT', 'DELETE'])
def api_staff_task_detail(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        task = StaffTask.objects.get(pk=pk)
    except StaffTask.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        task.delete()
        return Response({'ok': True})

    serializer = StaffTaskSerializer(task, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def api_staff_task_complete(request, pk):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)
    try:
        task = StaffTask.objects.get(pk=pk)
    except StaffTask.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    completion, created = StaffTaskCompletion.objects.get_or_create(
        teacher=request.user, task=task
    )
    if not created:
        completion.delete()
        return Response({'completed': False})
    return Response({'completed': True})


@api_view(['GET', 'POST'])
def api_staff_project_topics(request):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)

    if request.method == 'GET':
        submissions = StaffProjectTopicSubmission.objects.filter(teacher=request.user)
        return Response(StaffProjectTopicSubmissionSerializer(submissions, many=True).data)

    serializer = StaffProjectTopicSubmissionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(teacher=request.user)
    return Response(serializer.data, status=201)


@api_view(['PUT'])
def api_staff_project_topic_update(request, pk):
    """Edit a plan the teacher already saved — including ones already submitted or reviewed.
    Any edit pulls it back to 'draft' so it must be resubmitted before an admin sees the changes."""
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)
    try:
        sub = StaffProjectTopicSubmission.objects.get(pk=pk, teacher=request.user)
    except StaffProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    serializer = StaffProjectTopicSubmissionSerializer(sub, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(status='draft')
    return Response(StaffProjectTopicSubmissionSerializer(sub).data)


@api_view(['POST'])
def api_staff_project_topic_submit(request, pk):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)
    try:
        sub = StaffProjectTopicSubmission.objects.get(pk=pk, teacher=request.user)
    except StaffProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if sub.status != 'draft':
        return Response({'error': 'Already submitted.'}, status=400)
    questions = [q for q in (sub.research_questions or []) if q.strip()]
    if len(questions) < 3:
        return Response({'error': 'At least 3 research questions are required.'}, status=400)
    sub.status = 'submitted'
    sub.save()
    return Response(StaffProjectTopicSubmissionSerializer(sub).data)


@api_view(['GET'])
def api_admin_staff_project_topics(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    subs = StaffProjectTopicSubmission.objects.filter(status__in=['submitted', 'reviewed']).select_related('teacher', 'reviewed_by')
    return Response(StaffProjectTopicSubmissionSerializer(subs, many=True).data)


@api_view(['POST'])
def api_admin_staff_project_topic_feedback(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        sub = StaffProjectTopicSubmission.objects.get(pk=pk)
    except StaffProjectTopicSubmission.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    from django.utils import timezone
    sub.admin_feedback = request.data.get('feedback', '').strip()
    sub.reviewed_by = request.user
    sub.reviewed_at = timezone.now()
    sub.status = 'reviewed'
    sub.save()
    return Response(StaffProjectTopicSubmissionSerializer(sub).data)


@api_view(['GET', 'POST'])
def api_staff_project_starters(request):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)

    if request.method == 'GET':
        submissions = StaffProjectStarter.objects.filter(teacher=request.user)
        return Response(StaffProjectStarterSerializer(submissions, many=True).data)

    serializer = StaffProjectStarterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(teacher=request.user)
    return Response(serializer.data, status=201)


@api_view(['PUT'])
def api_staff_project_starter_update(request, pk):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)
    try:
        starter = StaffProjectStarter.objects.get(pk=pk, teacher=request.user)
    except StaffProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if starter.status != 'draft':
        return Response({'error': 'Only drafts can be edited.'}, status=400)
    serializer = StaffProjectStarterSerializer(starter, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def api_staff_project_starter_submit(request, pk):
    if not _program_staff_required(request):
        return Response({'error': 'Staff access required.'}, status=403)
    try:
        starter = StaffProjectStarter.objects.get(pk=pk, teacher=request.user)
    except StaffProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if starter.status != 'draft':
        return Response({'error': 'Already submitted.'}, status=400)
    if not starter.title.strip():
        return Response({'error': 'A title is required to submit for review.'}, status=400)
    starter.status = 'submitted'
    starter.save()
    return Response(StaffProjectStarterSerializer(starter).data)


@api_view(['GET'])
def api_admin_staff_project_starters(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    starters = StaffProjectStarter.objects.filter(status__in=['submitted', 'reviewed']).select_related('teacher', 'reviewed_by')
    return Response(StaffProjectStarterSerializer(starters, many=True).data)


@api_view(['POST'])
def api_admin_staff_project_starter_feedback(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        starter = StaffProjectStarter.objects.get(pk=pk)
    except StaffProjectStarter.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    from django.utils import timezone
    starter.admin_feedback = request.data.get('feedback', '').strip()
    starter.reviewed_by = request.user
    starter.reviewed_at = timezone.now()
    starter.status = 'reviewed'
    starter.save()
    return Response(StaffProjectStarterSerializer(starter).data)


@api_view(['GET'])
def api_admin_staff_profile(request, user_id):
    """View a Staff member's profile info (name, school, subject/role, etc.)."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        tp = TeacherProfile.objects.select_related('user').get(user_id=user_id)
    except TeacherProfile.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if not tp.program_staff_approved:
        return Response({'error': 'This teacher is not a Staff member.'}, status=400)

    profile = StaffProfile.objects.filter(teacher_id=user_id).first()
    data = StaffProfileSerializer(profile).data if profile else {
        'id': None, 'name': '', 'school': '', 'subject_taught': '',
        'num_students': None, 'years_teaching': None, 'email': '',
    }
    data['has_profile'] = profile is not None
    return Response(data)


@api_view(['POST'])
def api_admin_toggle_program_staff(request, user_id):
    """Toggle a teacher's Staff approved status."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        tp = TeacherProfile.objects.get(user_id=user_id)
        tp.program_staff_approved = not tp.program_staff_approved
        tp.save()
        return Response({'program_staff_approved': tp.program_staff_approved})
    except TeacherProfile.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)


@api_view(['GET', 'POST'])
def api_topic_suggestions(request):
    """Approved teachers submit a topic idea from the teaching dashboard, for admins to
    consider developing into a future lesson or project."""
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)

    if request.method == 'GET':
        suggestions = TopicSuggestion.objects.filter(teacher=request.user)
        return Response(TopicSuggestionSerializer(suggestions, many=True).data)

    serializer = TopicSuggestionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(teacher=request.user)
    return Response(serializer.data, status=201)


@api_view(['DELETE'])
def api_topic_suggestion_delete(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        sub = TopicSuggestion.objects.get(pk=pk, teacher=request.user)
    except TopicSuggestion.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if sub.status == 'reviewed':
        return Response({'error': 'Reviewed suggestions cannot be deleted.'}, status=400)
    sub.delete()
    return Response(status=204)


@api_view(['GET'])
def api_admin_topic_suggestions(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    subs = TopicSuggestion.objects.select_related('teacher', 'reviewed_by')
    return Response(TopicSuggestionSerializer(subs, many=True).data)


@api_view(['POST'])
def api_admin_topic_suggestion_feedback(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        sub = TopicSuggestion.objects.get(pk=pk)
    except TopicSuggestion.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    from django.utils import timezone
    sub.admin_feedback = request.data.get('feedback', '').strip()
    sub.reviewed_by = request.user
    sub.reviewed_at = timezone.now()
    sub.status = 'reviewed'
    sub.save()
    return Response(TopicSuggestionSerializer(sub).data)


# ── Forum ─────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def api_forum_threads(request):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)

    if request.method == 'GET':
        qs = ForumThread.objects.select_related('author').prefetch_related('replies')
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return Response(ForumThreadListSerializer(qs, many=True, context={'request': request}).data)

    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'A title is required.'}, status=400)
    category = request.data.get('category', 'general')
    if category not in dict(ForumThread.CATEGORY_CHOICES):
        category = 'general'
    thread = ForumThread.objects.create(
        author=request.user, title=title,
        body=request.data.get('body', '').strip(), category=category,
    )
    return Response(ForumThreadDetailSerializer(thread, context={'request': request}).data, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
def api_forum_thread_detail(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        thread = ForumThread.objects.select_related('author').prefetch_related('replies__author').get(pk=pk)
    except ForumThread.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        return Response(ForumThreadDetailSerializer(thread, context={'request': request}).data)

    is_admin = request.user.is_staff or request.user.is_superuser
    is_owner = thread.author_id == request.user.id

    if request.method == 'DELETE':
        if not (is_owner or is_admin):
            return Response({'error': 'You can only delete your own thread.'}, status=403)
        thread.delete()
        return Response({'ok': True})

    if not is_owner:
        return Response({'error': 'Only the author can edit this thread.'}, status=403)
    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'A title is required.'}, status=400)
    category = request.data.get('category', thread.category)
    if category not in dict(ForumThread.CATEGORY_CHOICES):
        category = thread.category
    thread.title = title
    thread.body = request.data.get('body', '').strip()
    thread.category = category
    thread.save()
    return Response(ForumThreadDetailSerializer(thread, context={'request': request}).data)


@api_view(['POST'])
def api_forum_reply_create(request, thread_pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        thread = ForumThread.objects.get(pk=thread_pk)
    except ForumThread.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    body = request.data.get('body', '').strip()
    if not body:
        return Response({'error': 'Reply cannot be empty.'}, status=400)
    reply = ForumReply.objects.create(thread=thread, author=request.user, body=body)
    from django.utils import timezone
    thread.updated_at = timezone.now()
    thread.save(update_fields=['updated_at'])
    return Response(ForumReplySerializer(reply, context={'request': request}).data, status=201)


@api_view(['PUT', 'DELETE'])
def api_forum_reply_detail(request, pk):
    if not _teacher_required(request):
        return Response({'error': 'Teacher access required.'}, status=403)
    try:
        reply = ForumReply.objects.get(pk=pk)
    except ForumReply.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    is_admin = request.user.is_staff or request.user.is_superuser
    is_owner = reply.author_id == request.user.id

    if request.method == 'DELETE':
        if not (is_owner or is_admin):
            return Response({'error': 'You can only delete your own reply.'}, status=403)
        reply.delete()
        return Response({'ok': True})

    if not is_owner:
        return Response({'error': 'Only the author can edit this reply.'}, status=403)
    body = request.data.get('body', '').strip()
    if not body:
        return Response({'error': 'Reply cannot be empty.'}, status=400)
    reply.body = body
    reply.save()
    return Response(ForumReplySerializer(reply, context={'request': request}).data)


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
            'program_staff_approved': tp.program_staff_approved,
        }
        for tp in qs.order_by('user__last_name', 'user__first_name')
    ])


@api_view(['GET'])
def api_admin_teach_stem_profile(request, user_id):
    """View a Teach STEM teacher's profile info (name, school, subject, etc.)."""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        tp = TeacherProfile.objects.select_related('user').get(user_id=user_id)
    except TeacherProfile.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if not tp.teach_stem_approved:
        return Response({'error': 'This teacher is not a Teach STEM member.'}, status=400)

    profile = TeachSTEMProfile.objects.filter(teacher_id=user_id).first()
    data = TeachSTEMProfileSerializer(profile).data if profile else {
        'id': None, 'name': '', 'school': '', 'subject_taught': '',
        'num_students': None, 'years_teaching': None, 'email': '',
    }
    data['has_profile'] = profile is not None
    return Response(data)


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


# --- Student STEM Reflection ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_student_reflection_assignments(request):
    if request.method == 'GET':
        if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Access denied.'}, status=403)
        if request.user.is_staff or request.user.is_superuser:
            qs = StudentReflectionAssignment.objects.prefetch_related('classrooms', 'responses')
        else:
            qs = StudentReflectionAssignment.objects.filter(
                created_by=request.user
            ).prefetch_related('classrooms', 'responses')
        return Response(StudentReflectionAssignmentSerializer(qs, many=True, context={'request': request}).data)

    if not _teach_stem_required(request):
        return Response({'error': 'Teach STEM access required.'}, status=403)

    classroom_ids = request.data.get('classrooms', [])
    activity_id = request.data.get('activity')
    title = request.data.get('title', '')

    assignment = StudentReflectionAssignment.objects.create(
        title=title,
        created_by=request.user,
        activity_id=activity_id if activity_id else None,
    )
    if classroom_ids:
        assignment.classrooms.set(Classroom.objects.filter(id__in=classroom_ids))

    return Response(
        StudentReflectionAssignmentSerializer(assignment, context={'request': request}).data,
        status=201,
    )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def api_student_reflection_assignment_detail(request, pk):
    if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Access denied.'}, status=403)
    try:
        assignment = StudentReflectionAssignment.objects.get(pk=pk)
    except StudentReflectionAssignment.DoesNotExist:
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
    assignment.save()
    return Response(StudentReflectionAssignmentSerializer(assignment, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_student_reflection_responses(request, pk):
    if not (_teach_stem_required(request) or request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Access denied.'}, status=403)
    try:
        assignment = StudentReflectionAssignment.objects.get(pk=pk)
    except StudentReflectionAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if not (request.user.is_staff or request.user.is_superuser) and assignment.created_by != request.user:
        return Response({'error': 'Permission denied.'}, status=403)

    responses = assignment.responses.select_related('student').all()
    return Response(StudentReflectionResponseSerializer(responses, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_student_reflection_student_list(request):
    enrolled_classroom_ids = request.user.enrolled_classrooms.values_list('id', flat=True)
    assignments = StudentReflectionAssignment.objects.filter(
        classrooms__id__in=enrolled_classroom_ids,
        is_open=True,
    ).prefetch_related('classrooms', 'responses').distinct()
    return Response(StudentReflectionAssignmentSerializer(assignments, many=True, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_student_reflection_respond(request, pk):
    try:
        assignment = StudentReflectionAssignment.objects.get(pk=pk)
    except StudentReflectionAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        try:
            resp = StudentReflectionResponse.objects.get(assignment=assignment, student=request.user)
            return Response(StudentReflectionResponseSerializer(resp, context={'request': request}).data)
        except StudentReflectionResponse.DoesNotExist:
            return Response({})

    if not assignment.is_open:
        return Response({'error': 'This reflection is closed.'}, status=400)

    if StudentReflectionResponse.objects.filter(assignment=assignment, student=request.user).exists():
        return Response({'error': 'You have already submitted a response.'}, status=400)

    d = request.data

    def parse_list(val):
        if isinstance(val, list):
            return val
        try:
            return json.loads(val) if val else []
        except Exception:
            return []

    required_text = ['one_thing_learned', 'most_enjoyable_part', 'biggest_challenge', 'change_one_thing']
    for field in required_text:
        if not str(d.get(field, '')).strip():
            return Response({'error': f'{field} is required.'}, status=400)
    required_choice = ['enjoyment', 'challenge_level']
    for field in required_choice:
        if not d.get(field):
            return Response({'error': f'{field} is required.'}, status=400)
    required_rating = ['learned_something_rating', 'want_more_stem_rating', 'real_world_connection_rating']
    for field in required_rating:
        if not d.get(field):
            return Response({'error': f'{field} is required.'}, status=400)

    resp = StudentReflectionResponse.objects.create(
        assignment=assignment,
        student=request.user,
        enjoyment=d.get('enjoyment', ''),
        challenge_level=d.get('challenge_level', ''),
        enjoyed_parts=parse_list(d.get('enjoyed_parts')),
        learned_something_rating=int(d['learned_something_rating']),
        skills_improved=parse_list(d.get('skills_improved')),
        one_thing_learned=d['one_thing_learned'].strip(),
        most_enjoyable_part=d['most_enjoyable_part'].strip(),
        biggest_challenge=d['biggest_challenge'].strip(),
        change_one_thing=d['change_one_thing'].strip(),
        want_more_stem_rating=int(d['want_more_stem_rating']),
        real_world_connection_rating=int(d['real_world_connection_rating']),
        additional_comments=d.get('additional_comments', '').strip() if isinstance(d.get('additional_comments'), str) else '',
    )

    return Response(StudentReflectionResponseSerializer(resp, context={'request': request}).data, status=201)
