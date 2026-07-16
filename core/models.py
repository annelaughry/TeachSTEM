import secrets
from django.db import models
from django.contrib.auth.models import User


GRADE_CHOICES = [
    ('3-5', '3–5'),
    ('6-8', '6–8'),
    ('biology', 'Biology'),
    ('physical_science', 'Physical Science'),
    ('chemistry', 'Chemistry'),
    ('earth_env', 'Earth and Environmental'),
]

SUBJECT_CHOICES = [
    ('science', 'Science'),
    ('technology', 'Technology'),
    ('engineering', 'Engineering'),
    ('math', 'Math'),
    ('cross', 'Cross-Cutting'),
]


class GradeLevel(models.Model):
    name = models.CharField(max_length=50, unique=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class Strand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    subject = models.CharField(max_length=20, choices=SUBJECT_CHOICES)

    class Meta:
        ordering = ['subject', 'name']

    def __str__(self):
        return self.name


class Standard(models.Model):
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField()
    grade_level = models.CharField(max_length=20, choices=GRADE_CHOICES)
    strand = models.ForeignKey(Strand, null=True, blank=True, on_delete=models.SET_NULL, related_name='standards')

    class Meta:
        ordering = ['grade_level', 'strand__name', 'code']

    def __str__(self):
        return f"{self.code} — {self.description[:60]}"


class Concept(models.Model):
    name = models.CharField(max_length=100, unique=True)
    subject = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.name


class Activity(models.Model):
    TYPE_CHOICES = [
        ('challenge', 'Challenge'),
        ('guided_activity', 'Guided Activity'),
        ('project', 'Project'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    title = models.CharField(max_length=200)
    activity_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    grade_levels = models.ManyToManyField(GradeLevel, blank=True, related_name='activities')
    duration_minutes = models.PositiveIntegerField(default=0, help_text='Estimated time in minutes')
    materials = models.TextField(blank=True)
    instructions_pdf = models.FileField(upload_to='activity_pdfs/', blank=True, null=True)
    video_url = models.URLField(blank=True, default='')
    is_restricted = models.BooleanField(default=False, help_text='If true, hidden from library; only visible to assigned Teach STEM teachers.')
    restricted_teachers = models.ManyToManyField(
        User, blank=True, related_name='restricted_activities',
        help_text='Teach STEM teachers who can access this restricted activity.',
    )
    standards = models.ManyToManyField(Standard, blank=True, related_name='activities')
    concepts = models.ManyToManyField(Concept, blank=True, related_name='activities')
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_activities')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']
        verbose_name_plural = 'Activities'

    def __str__(self):
        return self.title


class ActivityFile(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='handout_files')
    file = models.FileField(upload_to='activity_handouts/')
    label = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'uploaded_at']

    def __str__(self):
        return self.label or self.file.name


class ActivitySection(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.activity.title} — {self.title}"


class SectionLink(models.Model):
    section = models.ForeignKey(ActivitySection, on_delete=models.CASCADE, related_name='links')
    url = models.CharField(max_length=500)
    label = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.label or self.url


class ActivityPrompt(models.Model):
    TYPE_CHOICES = [
        ('student', 'Student Prompt'),
        ('instruction', 'Student Instructions'),
        ('teacher', 'Teacher Note'),
    ]
    RESPONSE_TYPE_CHOICES = [
        ('text', 'Text Response'),
        ('video', 'Video Response'),
        ('table', 'Data Table'),
    ]
    section = models.ForeignKey(ActivitySection, on_delete=models.CASCADE, related_name='prompts')
    text = models.TextField()
    prompt_type = models.CharField(max_length=15, choices=TYPE_CHOICES, default='student')
    response_type = models.CharField(max_length=10, choices=RESPONSE_TYPE_CHOICES, default='text')
    table_headers = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"[{self.prompt_type}] {self.text[:60]}"


class StudentResponse(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='responses')
    prompt = models.ForeignKey(ActivityPrompt, on_delete=models.CASCADE, related_name='responses')
    response_text = models.TextField(blank=True)
    response_video = models.FileField(upload_to='student_videos/', blank=True, null=True)
    response_table = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('student', 'prompt')]

    def __str__(self):
        return f"{self.student.username} → {self.prompt}"


class TeacherFeedback(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_given')
    response = models.OneToOneField(StudentResponse, on_delete=models.CASCADE, related_name='feedback')
    text = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Feedback on {self.response}"


class LessonFeedback(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lesson_feedback')
    activity_name = models.CharField(max_length=255, blank=True)
    student_count = models.PositiveIntegerField()
    grade_level_name = models.CharField(max_length=100, blank=True)
    classroom_name = models.CharField(max_length=100, blank=True)
    most_engaging = models.TextField(blank=True)
    adaptations = models.TextField(blank=True)
    struggled_section = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.teacher.username} — {self.activity_name or 'unknown'} ({self.submitted_at.date()})"


class ClassroomSectionPoints(models.Model):
    classroom = models.ForeignKey('Classroom', on_delete=models.CASCADE, related_name='section_points')
    section = models.ForeignKey(ActivitySection, on_delete=models.CASCADE, related_name='classroom_points')
    max_points = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('classroom', 'section')

    def __str__(self):
        return f"{self.classroom} / {self.section}: {self.max_points}pts"


class StudentSectionScore(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='section_scores')
    classroom = models.ForeignKey('Classroom', on_delete=models.CASCADE, related_name='section_scores')
    section = models.ForeignKey(ActivitySection, on_delete=models.CASCADE, related_name='student_scores')
    points_earned = models.PositiveIntegerField(null=True, blank=True)
    graded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='graded_scores')
    graded_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'classroom', 'section')

    def __str__(self):
        return f"{self.student.username} / {self.section}: {self.points_earned}pts"


class TeacherProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    is_approved = models.BooleanField(default=False)
    is_teach_stem = models.BooleanField(default=False)
    teach_stem_approved = models.BooleanField(default=False)

    def __str__(self):
        status = "approved" if self.is_approved else "pending"
        return f"{self.user.get_full_name() or self.user.username} ({status})"


class TeachSTEMTask(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='teach_stem_tasks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date', 'title']

    def __str__(self):
        return self.title


class ProjectTopicSubmission(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted for Review'),
        ('reviewed', 'Reviewed'),
    ]
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='project_topic_submissions')
    classroom_name = models.CharField(max_length=200, blank=True)
    grade_level = models.CharField(max_length=100, blank=True)
    num_students = models.CharField(max_length=50, blank=True)
    standards = models.TextField(blank=True)
    background_concepts = models.TextField(blank=True)
    research_questions = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    admin_feedback = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_project_topics'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.teacher.username} — {self.classroom_name or 'unnamed'} ({self.submitted_at.date()})"


class TStemSurveyResponse(models.Model):
    teacher = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tstem_survey')
    responses = models.JSONField(default=dict, blank=True)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"T-STEM Survey — {self.teacher.username}"


class TeachSTEMTaskCompletion(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_completions')
    task = models.ForeignKey(TeachSTEMTask, on_delete=models.CASCADE, related_name='completions')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'task')

    def __str__(self):
        return f"{self.teacher.username} completed {self.task.title}"


class TeachSTEMProfile(models.Model):
    teacher = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teach_stem_profile')
    name = models.CharField(max_length=200, blank=True)
    school = models.CharField(max_length=200, blank=True)
    subject_taught = models.CharField(max_length=200, blank=True)
    num_students = models.PositiveIntegerField(null=True, blank=True)
    years_teaching = models.PositiveIntegerField(null=True, blank=True)
    email = models.EmailField(blank=True)

    def __str__(self):
        return f"{self.name or self.teacher.username} — Teach STEM Profile"


class Module(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='modules')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


class ModuleActivity(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='module_activities')
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='module_activities')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = [('module', 'activity')]

    def __str__(self):
        return f"{self.module.title} — {self.activity.title}"


class ThreeTwoOneAssignment(models.Model):
    RESPONSE_TYPE_CHOICES = [('written', 'Written'), ('video', 'Video')]
    title = models.CharField(max_length=200, blank=True)
    activity = models.ForeignKey('Activity', null=True, blank=True, on_delete=models.SET_NULL, related_name='three_two_one')
    classrooms = models.ManyToManyField('Classroom', blank=True, related_name='three_two_one')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='three_two_one_assignments')
    response_type = models.CharField(max_length=10, choices=RESPONSE_TYPE_CHOICES, default='written')
    is_open = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title or f"3-2-1 by {self.created_by.username}"


class ThreeTwoOneResponse(models.Model):
    assignment = models.ForeignKey(ThreeTwoOneAssignment, on_delete=models.CASCADE, related_name='responses')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='three_two_one_responses')
    learned_1 = models.TextField(blank=True)
    learned_2 = models.TextField(blank=True)
    learned_3 = models.TextField(blank=True)
    question_1 = models.TextField(blank=True)
    question_2 = models.TextField(blank=True)
    most_interesting = models.TextField(blank=True)
    response_video = models.FileField(upload_to='321/videos/', null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('assignment', 'student')
        ordering = ['submitted_at']

    def __str__(self):
        return f"{self.student.username} — {self.assignment}"


class Classroom(models.Model):
    name = models.CharField(max_length=100)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='classrooms')
    code = models.CharField(max_length=8, unique=True, editable=False)
    students = models.ManyToManyField(User, blank=True, related_name='enrolled_classrooms')
    assigned_activities = models.ManyToManyField(Activity, blank=True, related_name='classrooms')
    assigned_modules = models.ManyToManyField(Module, blank=True, related_name='classrooms')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.code:
            while True:
                code = secrets.token_hex(3).upper()
                if not Classroom.objects.filter(code=code).exists():
                    self.code = code
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.teacher.username})"
