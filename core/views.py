import json
from functools import wraps
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpResponseForbidden
from django.db.models import Q
from .models import Activity, ActivitySection, ActivityPrompt, SectionLink, GradeLevel, Standard, Strand, Concept, Classroom, Module, ModuleActivity, TeacherProfile, StudentResponse, TeacherFeedback, GRADE_CHOICES


def staff_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(f'/login/?next={request.path}')
        if not (request.user.is_staff or request.user.is_superuser):
            return HttpResponseForbidden("Admin access required.")
        return view_func(request, *args, **kwargs)
    return wrapper


def _is_teacher(user):
    """Return True for superusers/staff and for approved teachers."""
    if not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    return hasattr(user, 'teacher_profile') and user.teacher_profile.is_approved


def teacher_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(f'/login/?next={request.path}')
        if request.user.is_staff or request.user.is_superuser:
            return view_func(request, *args, **kwargs)
        if not hasattr(request.user, 'teacher_profile'):
            return HttpResponseForbidden("Teacher access required.")
        if not request.user.teacher_profile.is_approved:
            return render(request, 'core/pending_approval.html')
        return view_func(request, *args, **kwargs)
    return wrapper


def user_login(request):
    if request.user.is_authenticated:
        if _is_teacher(request.user):
            return redirect('teacher_dashboard')
        return redirect('student_dashboard')
    error = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            if user.is_staff or user.is_superuser:
                auth_login(request, user)
                return redirect(request.GET.get('next') or 'teacher_dashboard')
            elif hasattr(user, 'teacher_profile'):
                if not user.teacher_profile.is_approved:
                    error = "Your account is awaiting administrator approval. You will be able to log in once approved."
                else:
                    auth_login(request, user)
                    return redirect(request.GET.get('next') or 'teacher_dashboard')
            else:
                auth_login(request, user)
                return redirect(request.GET.get('next') or 'student_dashboard')
        else:
            error = "Incorrect username or password."
    return render(request, 'core/login.html', {'error': error})


def student_register(request):
    if request.user.is_authenticated:
        return redirect('student_dashboard')
    error = None
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name  = request.POST.get('last_name', '').strip()
        username   = request.POST.get('username', '').strip()
        password   = request.POST.get('password', '')
        password2  = request.POST.get('password2', '')

        if not all([first_name, last_name, username, password]):
            error = "All fields are required."
        elif password != password2:
            error = "Passwords do not match."
        elif len(password) < 8:
            error = "Password must be at least 8 characters."
        elif User.objects.filter(username=username).exists():
            error = "That username is already taken."
        else:
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            auth_login(request, user)
            return redirect('join_classroom')

    return render(request, 'core/student_register.html', {'error': error})


def teacher_register(request):
    if request.user.is_authenticated:
        return redirect('teacher_dashboard')
    error = None
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name  = request.POST.get('last_name', '').strip()
        email      = request.POST.get('email', '').strip()
        username   = request.POST.get('username', '').strip()
        password   = request.POST.get('password', '')
        password2  = request.POST.get('password2', '')

        if not all([first_name, last_name, email, username, password]):
            error = "All fields are required."
        elif password != password2:
            error = "Passwords do not match."
        elif len(password) < 8:
            error = "Password must be at least 8 characters."
        elif User.objects.filter(username=username).exists():
            error = "That username is already taken."
        elif User.objects.filter(email=email).exists():
            error = "An account with that email already exists."
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            TeacherProfile.objects.create(user=user, is_approved=False)
            return redirect('pending_approval')

    return render(request, 'core/register.html', {'error': error})


def pending_approval(request):
    return render(request, 'core/pending_approval.html')


def search(request):
    if request.user.is_authenticated and not _is_teacher(request.user):
        return redirect('student_dashboard')

    # Public library: admin-added (no creator) or teacher-submitted and approved
    activities = Activity.objects.filter(Q(created_by__isnull=True) | Q(status='approved'))
    concepts = Concept.objects.all().order_by('name')

    q = request.GET.get('q', '').strip()
    activity_type = request.GET.get('activity_type', '')
    grade_level_id = request.GET.get('grade_level', '')
    strand_id = request.GET.get('strand', '')
    standard_id = request.GET.get('standard', '')
    concept_id = request.GET.get('concept', '')

    searched = any([q, activity_type, grade_level_id, strand_id, standard_id, concept_id])

    if searched:
        if q:
            activities = activities.filter(title__icontains=q) | activities.filter(description__icontains=q)
        if activity_type:
            activities = activities.filter(activity_type=activity_type)
        if grade_level_id:
            activities = activities.filter(grade_levels__id=grade_level_id)
        if standard_id:
            activities = activities.filter(standards__id=standard_id)
        elif strand_id:
            activities = activities.filter(standards__strand__id=strand_id)
        if concept_id:
            activities = activities.filter(concepts__id=concept_id)
        activities = activities.distinct()
    else:
        activities = activities.none()

    # Serialize strands with the set of grade levels they appear in (for JS cascade)
    from collections import defaultdict
    strand_grades = defaultdict(set)
    for row in Standard.objects.filter(strand__isnull=False).values('strand_id', 'grade_level'):
        strand_grades[row['strand_id']].add(row['grade_level'])

    strands_data = [
        {'id': s.id, 'name': s.name, 'grades': list(strand_grades.get(s.id, []))}
        for s in Strand.objects.all()
    ]
    standards_data = list(
        Standard.objects.filter(strand__isnull=False)
        .values('id', 'code', 'strand_id', 'grade_level').order_by('grade_level', 'code')
    )

    return render(request, 'core/search.html', {
        'activities': activities,
        'concepts': concepts,
        'activity_types': Activity.TYPE_CHOICES,
        'grade_levels': GradeLevel.objects.all(),
        'strands_json': json.dumps(strands_data),
        'standards_json': json.dumps(standards_data),
        'q': q,
        'selected_type': activity_type,
        'selected_grade': grade_level_id,
        'selected_strand': strand_id,
        'selected_standard': standard_id,
        'selected_concept': concept_id,
        'searched': searched,
    })


@teacher_required
def teacher_dashboard(request):
    classrooms = Classroom.objects.filter(teacher=request.user).prefetch_related('students', 'assigned_activities')
    return render(request, 'core/teacher_dashboard.html', {'classrooms': classrooms})


@teacher_required
def classroom_delete(request, pk):
    classroom = get_object_or_404(Classroom, pk=pk, teacher=request.user)
    if request.method == 'POST':
        classroom.delete()
        return redirect('teacher_dashboard')
    return redirect('classroom_detail', pk=pk)


@teacher_required
def classroom_create(request):
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        if name:
            Classroom.objects.create(name=name, teacher=request.user)
            return redirect('teacher_dashboard')
    return render(request, 'core/classroom_create.html')


@teacher_required
def classroom_detail(request, pk):
    classroom = get_object_or_404(Classroom, pk=pk, teacher=request.user)
    if request.method == 'POST':
        activity_id = request.POST.get('remove_activity')
        module_id = request.POST.get('remove_module')
        if activity_id:
            classroom.assigned_activities.remove(activity_id)
        if module_id:
            classroom.assigned_modules.remove(module_id)
        return redirect('classroom_detail', pk=pk)
    return render(request, 'core/classroom_detail.html', {'classroom': classroom})


@teacher_required
def classroom_assign(request, pk):
    classroom = get_object_or_404(Classroom, pk=pk, teacher=request.user)
    if request.method == 'POST':
        activity_ids = request.POST.getlist('activities')
        classroom.assigned_activities.set(activity_ids)
    return redirect('classroom_detail', pk=pk)


def _activity_completed_by(activity, user):
    """True if the user has a StudentResponse for every student-type prompt in the activity."""
    prompt_ids = list(
        ActivityPrompt.objects.filter(
            section__activity=activity, prompt_type='student'
        ).values_list('pk', flat=True)
    )
    if not prompt_ids:
        return True  # no required responses → auto-complete
    answered = StudentResponse.objects.filter(
        student=user, prompt_id__in=prompt_ids
    ).count()
    return answered >= len(prompt_ids)


@teacher_required
def module_list(request):
    is_admin = request.user.is_staff or request.user.is_superuser
    if is_admin:
        modules = Module.objects.prefetch_related('module_activities').all()
    else:
        modules = Module.objects.filter(created_by=request.user).prefetch_related('module_activities')
    return render(request, 'core/module_list.html', {'modules': modules})


def _save_module_activities(module, activity_ids):
    module.module_activities.all().delete()
    for i, aid in enumerate(activity_ids):
        try:
            activity = Activity.objects.get(pk=int(aid), status='approved')
            ModuleActivity.objects.create(module=module, activity=activity, order=i)
        except (Activity.DoesNotExist, ValueError):
            pass


@teacher_required
def module_create(request):
    errors = []
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()
        activity_ids = request.POST.getlist('activity_ids')
        if not title:
            errors.append("Module title is required.")
        if not activity_ids:
            errors.append("Add at least one activity to the module.")
        if not errors:
            module = Module.objects.create(
                title=title, description=description, created_by=request.user
            )
            _save_module_activities(module, activity_ids)
            return redirect('module_detail', pk=module.pk)

    approved_activities = Activity.objects.filter(status='approved').prefetch_related('grade_levels').order_by('title')
    return render(request, 'core/module_create.html', {
        'errors': errors,
        'module': None,
        'approved_activities': approved_activities,
        'existing_activities_json': '[]',
    })


@teacher_required
def module_edit(request, pk):
    is_admin = request.user.is_staff or request.user.is_superuser
    module = get_object_or_404(Module, pk=pk) if is_admin else get_object_or_404(Module, pk=pk, created_by=request.user)

    errors = []
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()
        activity_ids = request.POST.getlist('activity_ids')
        if not title:
            errors.append("Module title is required.")
        if not activity_ids:
            errors.append("Add at least one activity to the module.")
        if not errors:
            module.title = title
            module.description = description
            module.save()
            _save_module_activities(module, activity_ids)
            return redirect('module_detail', pk=module.pk)

    existing = [
        {'id': ma.activity.pk, 'title': ma.activity.title, 'type': ma.activity.get_activity_type_display()}
        for ma in module.module_activities.select_related('activity').order_by('order')
    ]
    approved_activities = Activity.objects.filter(status='approved').prefetch_related('grade_levels').order_by('title')
    return render(request, 'core/module_create.html', {
        'errors': errors,
        'module': module,
        'approved_activities': approved_activities,
        'existing_activities_json': json.dumps(existing),
    })


@teacher_required
def module_detail(request, pk):
    is_admin = request.user.is_staff or request.user.is_superuser
    module = get_object_or_404(Module, pk=pk) if is_admin else get_object_or_404(Module, pk=pk, created_by=request.user)

    if request.method == 'POST':
        classroom_ids = set(request.POST.getlist('classroom_ids'))
        for classroom in Classroom.objects.filter(teacher=request.user):
            if str(classroom.pk) in classroom_ids:
                classroom.assigned_modules.add(module)
            else:
                classroom.assigned_modules.remove(module)
        return redirect('module_detail', pk=pk)

    teacher_classrooms = Classroom.objects.filter(teacher=request.user)
    assigned_classroom_ids = list(
        module.classrooms.filter(teacher=request.user).values_list('pk', flat=True)
    )
    module_activities = module.module_activities.select_related('activity').order_by('order')
    return render(request, 'core/module_detail.html', {
        'module': module,
        'module_activities': module_activities,
        'teacher_classrooms': teacher_classrooms,
        'assigned_classroom_ids': assigned_classroom_ids,
    })


@login_required
def module_view(request, pk):
    """Student-facing module view — accessible if the module is assigned to any of their classrooms."""
    module = get_object_or_404(Module, pk=pk)
    is_teacher = _is_teacher(request.user)
    if not is_teacher:
        if not request.user.is_authenticated:
            return redirect(f'/login/?next={request.path}')
        if not request.user.enrolled_classrooms.filter(assigned_modules=module).exists():
            return HttpResponseForbidden("This module has not been assigned to your classroom.")

    ordered = list(
        module.module_activities.select_related('activity')
        .prefetch_related('activity__grade_levels')
        .order_by('order')
    )

    activities_data = []
    prev_complete = True  # activity 1 is always unlocked
    for ma in ordered:
        if is_teacher:
            is_locked = False
            is_complete = False
        else:
            is_locked = not prev_complete
            is_complete = (not is_locked) and _activity_completed_by(ma.activity, request.user)
        activities_data.append({
            'ma': ma,
            'is_locked': is_locked,
            'is_complete': is_complete,
        })
        prev_complete = is_complete

    return render(request, 'core/module_view.html', {
        'module': module,
        'activities_data': activities_data,
        'is_teacher': is_teacher,
    })


@teacher_required
def activity_submit(request, pk):
    activity = get_object_or_404(Activity, pk=pk, created_by=request.user)
    if request.method == 'POST' and activity.status == 'draft':
        activity.status = 'pending'
        activity.save()
    return redirect('teacher_dashboard')


def _save_sections_and_standards(activity, post_data):
    """Persist grade levels, standards, and sections/prompts from POST data."""
    activity.grade_levels.set(post_data.getlist('grade_levels'))

    activity.standards.clear()
    for code in post_data.getlist('standard_codes'):
        code = code.strip()
        if code:
            try:
                activity.standards.add(Standard.objects.get(code__iexact=code))
            except Standard.DoesNotExist:
                pass

    activity.sections.all().delete()
    section_count = int(post_data.get('section_count', 0) or 0)
    for i in range(section_count):
        section_title = post_data.get(f'section_{i}_title', '').strip()
        if not section_title:
            continue
        section = ActivitySection.objects.create(
            activity=activity, title=section_title, order=i
        )
        prompt_count = int(post_data.get(f'section_{i}_prompt_count', 0) or 0)
        for j in range(prompt_count):
            prompt_text = post_data.get(f'section_{i}_prompt_{j}', '').strip()
            prompt_type = post_data.get(f'section_{i}_prompt_{j}_type', 'student')
            response_type = post_data.get(f'section_{i}_prompt_{j}_response_type', 'text')
            try:
                table_headers = json.loads(post_data.get(f'section_{i}_prompt_{j}_table_headers', '[]') or '[]')
            except (json.JSONDecodeError, ValueError):
                table_headers = []
            if prompt_text or response_type == 'table':
                ActivityPrompt.objects.create(
                    section=section, text=prompt_text,
                    prompt_type=prompt_type,
                    response_type=response_type,
                    table_headers=table_headers,
                    order=j
                )
        link_count = int(post_data.get(f'section_{i}_link_count', 0) or 0)
        for k in range(link_count):
            url = post_data.get(f'section_{i}_link_{k}_url', '').strip()
            label = post_data.get(f'section_{i}_link_{k}_label', '').strip()
            if url:
                SectionLink.objects.create(section=section, url=url, label=label, order=k)


def _post_initial(post_data):
    return {
        'title': post_data.get('title', ''),
        'description': post_data.get('description', ''),
        'materials': post_data.get('materials', ''),
        'activity_type': post_data.get('activity_type', ''),
        'duration_minutes': post_data.get('duration_minutes', ''),
    }


def _sections_from_post(post_data):
    """Rebuild sections_json from POST data (for error re-display in edit view)."""
    sections_data = []
    section_count = int(post_data.get('section_count', 0) or 0)
    for i in range(section_count):
        prompts_data = []
        pc = int(post_data.get(f'section_{i}_prompt_count', 0) or 0)
        for j in range(pc):
            try:
                th = json.loads(post_data.get(f'section_{i}_prompt_{j}_table_headers', '[]') or '[]')
            except (json.JSONDecodeError, ValueError):
                th = []
            prompts_data.append({
                'text': post_data.get(f'section_{i}_prompt_{j}', ''),
                'type': post_data.get(f'section_{i}_prompt_{j}_type', 'student'),
                'response_type': post_data.get(f'section_{i}_prompt_{j}_response_type', 'text'),
                'table_headers': th,
            })
        links_data = []
        lc = int(post_data.get(f'section_{i}_link_count', 0) or 0)
        for k in range(lc):
            url = post_data.get(f'section_{i}_link_{k}_url', '').strip()
            label = post_data.get(f'section_{i}_link_{k}_label', '').strip()
            if url:
                links_data.append({'url': url, 'label': label})
        sections_data.append({
            'title': post_data.get(f'section_{i}_title', ''),
            'prompts': prompts_data,
            'links': links_data,
        })
    return sections_data


@teacher_required
def activity_create(request):
    errors = []
    post = {}
    standard_codes = []

    if request.method == 'POST':
        form_action = request.POST.get('form_action', 'save')
        is_draft = form_action == 'draft'

        title        = request.POST.get('title', '').strip()
        description  = request.POST.get('description', '').strip()
        materials    = request.POST.get('materials', '').strip()
        activity_type = request.POST.get('activity_type', '')
        duration_raw = request.POST.get('duration_minutes', '').strip()

        post = _post_initial(request.POST)
        standard_codes = [c for c in request.POST.getlist('standard_codes') if c.strip()]

        if not title:
            errors.append("Title is required.")
        if not is_draft:
            if not activity_type:
                errors.append("Activity type is required.")
            if not request.POST.getlist('grade_levels'):
                errors.append("Please select at least one grade level.")

        if not errors:
            activity = Activity.objects.create(
                title=title or 'Untitled Draft',
                description=description,
                materials=materials,
                activity_type=activity_type or 'challenge',
                duration_minutes=int(duration_raw) if duration_raw.isdigit() else 0,
                created_by=request.user,
                status='draft',
            )
            if request.FILES.get('instructions_pdf'):
                activity.instructions_pdf = request.FILES['instructions_pdf']
                activity.save()
            _save_sections_and_standards(activity, request.POST)
            if is_draft:
                return redirect('activity_edit', pk=activity.pk)
            return redirect('teacher_dashboard')

    return render(request, 'core/activity_create.html', {
        'errors': errors,
        'activity': None,
        'sections_json': '[]',
        'activity_types': Activity.TYPE_CHOICES,
        'grade_levels': GradeLevel.objects.all(),
        'selected_grades': request.POST.getlist('grade_levels'),
        'standard_codes': standard_codes,
        'post': post,
    })


@teacher_required
def activity_edit(request, pk):
    is_admin = request.user.is_staff or request.user.is_superuser
    if is_admin:
        activity = get_object_or_404(Activity, pk=pk)
    else:
        activity = get_object_or_404(Activity, pk=pk, created_by=request.user)
        if activity.status not in ('draft', 'rejected'):
            return redirect('teacher_dashboard')

    errors = []

    if request.method == 'POST':
        form_action = request.POST.get('form_action', 'save')
        is_draft = form_action == 'draft'

        title        = request.POST.get('title', '').strip()
        description  = request.POST.get('description', '').strip()
        materials    = request.POST.get('materials', '').strip()
        activity_type = request.POST.get('activity_type', '')
        duration_raw = request.POST.get('duration_minutes', '').strip()

        if not title:
            errors.append("Title is required.")
        if not is_draft:
            if not activity_type:
                errors.append("Activity type is required.")
            if not request.POST.getlist('grade_levels'):
                errors.append("Please select at least one grade level.")

        if not errors:
            activity.title = title
            activity.description = description
            activity.materials = materials
            if activity_type:
                activity.activity_type = activity_type
            activity.duration_minutes = int(duration_raw) if duration_raw.isdigit() else 0
            if request.FILES.get('instructions_pdf'):
                activity.instructions_pdf = request.FILES['instructions_pdf']
            elif request.POST.get('clear_instructions_pdf') and activity.instructions_pdf:
                activity.instructions_pdf.delete(save=False)
                activity.instructions_pdf = None
            activity.save()
            _save_sections_and_standards(activity, request.POST)
            if is_draft:
                return redirect('activity_edit', pk=activity.pk)
            if is_admin:
                return redirect('activity_detail', pk=activity.pk)
            return redirect('teacher_dashboard')

        return render(request, 'core/activity_create.html', {
            'errors': errors,
            'activity': activity,
            'is_admin_edit': is_admin,
            'sections_json': json.dumps(_sections_from_post(request.POST)),
            'activity_types': Activity.TYPE_CHOICES,
            'grade_levels': GradeLevel.objects.all(),
            'selected_grades': request.POST.getlist('grade_levels'),
            'standard_codes': [c for c in request.POST.getlist('standard_codes') if c.strip()],
            'post': _post_initial(request.POST),
        })

    # GET: load from database
    sections_data = [
        {
            'title': s.title,
            'prompts': [
                {
                    'text': p.text,
                    'type': p.prompt_type,
                    'response_type': p.response_type,
                    'table_headers': p.table_headers,
                }
                for p in s.prompts.order_by('order')
            ],
            'links': [
                {'url': l.url, 'label': l.label}
                for l in s.links.order_by('order')
            ],
        }
        for s in activity.sections.order_by('order')
    ]
    return render(request, 'core/activity_create.html', {
        'errors': [],
        'activity': activity,
        'is_admin_edit': is_admin,
        'sections_json': json.dumps(sections_data),
        'activity_types': Activity.TYPE_CHOICES,
        'grade_levels': GradeLevel.objects.all(),
        'selected_grades': [str(g) for g in activity.grade_levels.values_list('id', flat=True)],
        'standard_codes': list(activity.standards.values_list('code', flat=True)),
        'post': {
            'title': activity.title,
            'description': activity.description,
            'materials': activity.materials,
            'activity_type': activity.activity_type,
            'duration_minutes': activity.duration_minutes,
        },
    })


@login_required
def join_classroom(request):
    error = None
    if request.method == 'POST':
        code = request.POST.get('code', '').strip().upper()
        try:
            classroom = Classroom.objects.get(code=code)
            classroom.students.add(request.user)
            return redirect('student_dashboard')
        except Classroom.DoesNotExist:
            error = "Invalid classroom code. Please try again."
    return render(request, 'core/join_classroom.html', {'error': error})


def activity_detail(request, pk):
    if request.user.is_authenticated and not _is_teacher(request.user):
        return redirect('student_dashboard')

    activity = get_object_or_404(Activity, pk=pk)

    is_public = activity.status == 'approved' or activity.created_by is None
    is_own = (request.user.is_authenticated
              and activity.created_by == request.user)

    if not (is_public or is_own):
        from django.http import Http404
        raise Http404

    is_teacher = _is_teacher(request.user)

    if request.method == 'POST' and is_teacher:
        selected_ids = set(request.POST.getlist('classroom_ids'))
        for classroom in request.user.classrooms.all():
            if str(classroom.pk) in selected_ids:
                classroom.assigned_activities.add(activity)
            else:
                classroom.assigned_activities.remove(activity)
        return redirect('activity_detail', pk=pk)

    section_data = [
        {'section': s, 'prompts': list(s.prompts.order_by('order'))}
        for s in activity.sections.order_by('order')
        if s.prompts.exists()
    ]

    teacher_classrooms = []
    assigned_classroom_ids = set()
    if is_teacher:
        teacher_classrooms = list(request.user.classrooms.order_by('name'))
        assigned_classroom_ids = set(
            activity.classrooms.filter(teacher=request.user).values_list('id', flat=True)
        )

    return render(request, 'core/activity_detail.html', {
        'activity': activity,
        'section_data': section_data,
        'is_teacher': is_teacher,
        'teacher_classrooms': teacher_classrooms,
        'assigned_classroom_ids': assigned_classroom_ids,
    })


@login_required
def student_dashboard(request):
    classrooms = request.user.enrolled_classrooms.prefetch_related(
        'assigned_activities', 'assigned_activities__grade_levels',
        'assigned_modules', 'assigned_modules__module_activities__activity__grade_levels',
        'teacher'
    ).all()
    return render(request, 'core/student_dashboard.html', {'classrooms': classrooms})


def student_activity(request, pk, section_num=None):
    from django.urls import reverse
    activity = get_object_or_404(Activity, pk=pk)

    is_teacher_preview = _is_teacher(request.user)

    if not is_teacher_preview:
        if not request.user.is_authenticated:
            return redirect(f'/login/?next={request.path}')
        directly_assigned = request.user.enrolled_classrooms.filter(assigned_activities=activity).exists()
        via_module = request.user.enrolled_classrooms.filter(
            assigned_modules__module_activities__activity=activity
        ).exists()
        if not (directly_assigned or via_module):
            return HttpResponseForbidden("This activity has not been assigned to your classroom.")

    # Only sections that have at least one student prompt
    student_sections = [
        s for s in activity.sections.order_by('order')
        if s.prompts.filter(prompt_type__in=['student', 'instruction']).exists()
    ]
    total_sections = len(student_sections)

    if not student_sections:
        return render(request, 'core/student_activity.html', {
            'activity': activity,
            'no_sections': True,
            'is_teacher_preview': is_teacher_preview,
        })

    # /work/ with no section number → redirect to section 1
    if section_num is None:
        return redirect('student_activity_section', pk=pk, section_num=1)

    section_num = max(1, min(section_num, total_sections))
    current_section = student_sections[section_num - 1]
    student_prompts = list(current_section.prompts.filter(prompt_type__in=['student', 'instruction']).order_by('order'))

    if request.method == 'POST' and not is_teacher_preview:
        for prompt in student_prompts:
            if prompt.prompt_type == 'instruction':
                continue
            if prompt.response_type == 'video':
                video_file = request.FILES.get(f'video_{prompt.id}')
                if video_file:
                    StudentResponse.objects.update_or_create(
                        student=request.user, prompt=prompt,
                        defaults={'response_video': video_file, 'response_text': ''}
                    )
            elif prompt.response_type == 'table':
                table_json = request.POST.get(f'table_data_{prompt.id}', '')
                if table_json:
                    try:
                        table_data = json.loads(table_json)
                        StudentResponse.objects.update_or_create(
                            student=request.user, prompt=prompt,
                            defaults={'response_table': table_data}
                        )
                    except (json.JSONDecodeError, ValueError):
                        pass
            else:
                text = request.POST.get(f'response_{prompt.id}', '')
                StudentResponse.objects.update_or_create(
                    student=request.user, prompt=prompt,
                    defaults={'response_text': text}
                )
        action = request.POST.get('action', 'save')
        if action == 'next' and section_num < total_sections:
            return redirect('student_activity_section', pk=pk, section_num=section_num + 1)
        if action == 'prev' and section_num > 1:
            return redirect('student_activity_section', pk=pk, section_num=section_num - 1)
        if action == 'finish':
            return redirect('student_dashboard')
        # save draft — stay on same section, show confirmation
        url = reverse('student_activity_section', kwargs={'pk': pk, 'section_num': section_num})
        return redirect(url + '?saved=1')

    existing = {}
    if not is_teacher_preview:
        existing = {
            r.prompt_id: r for r in StudentResponse.objects.filter(
                student=request.user, prompt__in=student_prompts
            ).select_related('feedback')
        }

    prompts_data = []
    for p in student_prompts:
        resp = existing.get(p.id)
        item = {'prompt': p, 'response': resp}
        if p.response_type == 'table':
            item['table_headers_json'] = json.dumps(p.table_headers or [])
            item['response_table_json'] = (
                json.dumps(resp.response_table) if (resp and resp.response_table) else 'null'
            )
        prompts_data.append(item)

    return render(request, 'core/student_activity.html', {
        'activity': activity,
        'current_section': current_section,
        'prompts_data': prompts_data,
        'section_num': section_num,
        'total_sections': total_sections,
        'section_range': list(range(1, total_sections + 1)),
        'is_teacher_preview': is_teacher_preview,
        'has_prev': section_num > 1,
        'has_next': section_num < total_sections,
        'is_last': section_num == total_sections,
        'prev_num': section_num - 1,
        'next_num': section_num + 1,
        'saved': request.GET.get('saved') == '1',
    })


@staff_required
def admin_dashboard(request):
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'approve_teacher':
            profile = get_object_or_404(TeacherProfile, pk=request.POST.get('profile_id'))
            profile.is_approved = True
            profile.save()

        elif action == 'approve_activity':
            activity = get_object_or_404(Activity, pk=request.POST.get('activity_id'))
            activity.status = 'approved'
            activity.save()

        elif action == 'reject_activity':
            activity = get_object_or_404(Activity, pk=request.POST.get('activity_id'))
            activity.status = 'rejected'
            activity.save()

        return redirect('admin_dashboard')

    pending_teachers = (
        TeacherProfile.objects.filter(is_approved=False)
        .select_related('user')
        .order_by('user__date_joined')
    )
    pending_activities = (
        Activity.objects.filter(status='pending')
        .select_related('created_by')
        .prefetch_related('grade_levels')
        .order_by('created_at')
    )
    return render(request, 'core/admin_dashboard.html', {
        'pending_teachers': pending_teachers,
        'pending_activities': pending_activities,
    })


@teacher_required
def teacher_responses(request, pk):
    activity = get_object_or_404(Activity, pk=pk)

    # Collect students from all classrooms where this teacher assigned this activity
    classrooms = request.user.classrooms.filter(assigned_activities=activity)
    student_ids = set()
    for c in classrooms:
        student_ids.update(c.students.values_list('id', flat=True))
    students = User.objects.filter(id__in=student_ids).order_by('last_name', 'first_name', 'username')

    student_prompts = list(
        ActivityPrompt.objects.filter(
            section__activity=activity, prompt_type='student'
        ).select_related('section').order_by('section__order', 'order')
    )

    # Handle feedback POST
    if request.method == 'POST':
        response_id = request.POST.get('response_id')
        feedback_text = request.POST.get('feedback_text', '').strip()
        if response_id:
            resp = get_object_or_404(StudentResponse, pk=response_id)
            if feedback_text:
                TeacherFeedback.objects.update_or_create(
                    response=resp,
                    defaults={'teacher': request.user, 'text': feedback_text}
                )
            else:
                TeacherFeedback.objects.filter(response=resp).delete()
        return redirect('teacher_responses', pk=pk)

    all_responses = StudentResponse.objects.filter(
        prompt__in=student_prompts, student__in=students
    ).select_related('feedback')

    # Organise: student → {prompt_id: response}
    response_map = {}
    for r in all_responses:
        response_map.setdefault(r.student_id, {})[r.prompt_id] = r

    student_data = [
        {'student': s, 'responses': response_map.get(s.id, {})}
        for s in students
    ]

    return render(request, 'core/teacher_responses.html', {
        'activity': activity,
        'sections': activity.sections.prefetch_related('prompts').all(),
        'student_prompts': student_prompts,
        'student_data': student_data,
    })
