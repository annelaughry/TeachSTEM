from rest_framework import serializers
from django.contrib.auth.models import User
from core.models import (
    Activity, ActivitySection, ActivityPrompt, SectionLink,
    GradeLevel, Standard, Concept, Classroom, Module, ModuleActivity,
    TeacherProfile, StudentResponse, TeacherFeedback, ActivityFile,
    LessonFeedback, TeachSTEMProfile, TeachSTEMTask, TeachSTEMTaskCompletion,
    ProjectTopicSubmission, TStemSurveyResponse, TeacherSurveyResponse,
    ThreeTwoOneAssignment, ThreeTwoOneResponse,
)


class UserSerializer(serializers.ModelSerializer):
    is_teacher    = serializers.SerializerMethodField()
    is_pending    = serializers.SerializerMethodField()
    is_teach_stem = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'is_staff', 'is_superuser', 'is_teacher', 'is_pending', 'is_teach_stem']

    def get_is_teacher(self, obj):
        if obj.is_staff or obj.is_superuser:
            return True
        return hasattr(obj, 'teacher_profile') and obj.teacher_profile.is_approved

    def get_is_pending(self, obj):
        return hasattr(obj, 'teacher_profile') and not obj.teacher_profile.is_approved

    def get_is_teach_stem(self, obj):
        return hasattr(obj, 'teacher_profile') and obj.teacher_profile.teach_stem_approved


class GradeLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = ['id', 'name', 'order']


class StandardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Standard
        fields = ['id', 'code', 'description', 'grade_level']


class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ['id', 'name', 'subject']


class SectionLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionLink
        fields = ['id', 'url', 'label', 'order']


class ActivityFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityFile
        fields = ['id', 'file', 'label', 'description', 'order']


class ActivityPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityPrompt
        fields = ['id', 'text', 'prompt_type', 'response_type', 'table_headers', 'order', 'video_url']


class ActivitySectionSerializer(serializers.ModelSerializer):
    prompts = ActivityPromptSerializer(many=True, read_only=True)
    links = SectionLinkSerializer(many=True, read_only=True)

    class Meta:
        model = ActivitySection
        fields = ['id', 'title', 'order', 'prompts', 'links']


class ActivityListSerializer(serializers.ModelSerializer):
    grade_levels = GradeLevelSerializer(many=True, read_only=True)
    standards = StandardSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    restricted_teacher_ids = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ['id', 'title', 'activity_type', 'grade_levels', 'duration_minutes',
                  'description', 'status', 'standards', 'created_by_name', 'created_at',
                  'instructions_pdf', 'video_url', 'is_restricted', 'restricted_teacher_ids']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_restricted_teacher_ids(self, obj):
        return list(obj.restricted_teachers.values_list('id', flat=True))


class ActivityDetailSerializer(ActivityListSerializer):
    sections = ActivitySectionSerializer(many=True, read_only=True)
    handout_files = ActivityFileSerializer(many=True, read_only=True)
    materials = serializers.CharField()
    concepts = ConceptSerializer(many=True, read_only=True)

    class Meta(ActivityListSerializer.Meta):
        fields = ActivityListSerializer.Meta.fields + ['materials', 'sections', 'concepts', 'handout_files']


class StudentResponseSerializer(serializers.ModelSerializer):
    feedback_text = serializers.SerializerMethodField()

    class Meta:
        model = StudentResponse
        fields = ['id', 'prompt', 'response_text', 'response_video',
                  'response_table', 'updated_at', 'feedback_text']

    def get_feedback_text(self, obj):
        if hasattr(obj, 'feedback'):
            return obj.feedback.text
        return None


class TeacherFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherFeedback
        fields = ['id', 'text', 'updated_at']


class ClassroomListSerializer(serializers.ModelSerializer):
    students_count = serializers.IntegerField(source='students.count', read_only=True)
    activities_count = serializers.IntegerField(source='assigned_activities.count', read_only=True)
    modules_count = serializers.IntegerField(source='assigned_modules.count', read_only=True)
    assigned_activity_ids = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = ['id', 'name', 'code', 'students_count', 'activities_count', 'modules_count', 'assigned_activity_ids']

    def get_assigned_activity_ids(self, obj):
        return list(obj.assigned_activities.values_list('id', flat=True))


class ClassroomDetailSerializer(ClassroomListSerializer):
    students = serializers.SerializerMethodField()
    assigned_activities = ActivityListSerializer(many=True, read_only=True)
    assigned_modules = serializers.SerializerMethodField()

    class Meta(ClassroomListSerializer.Meta):
        fields = ClassroomListSerializer.Meta.fields + ['students', 'assigned_activities', 'assigned_modules']

    def get_students(self, obj):
        return [
            {'id': u.id, 'name': u.get_full_name() or u.username, 'username': u.username}
            for u in obj.students.all()
        ]

    def get_assigned_modules(self, obj):
        return [
            {
                'id': m.id,
                'title': m.title,
                'description': m.description,
                'activity_count': m.module_activities.count(),
            }
            for m in obj.assigned_modules.all()
        ]


class ModuleActivitySerializer(serializers.ModelSerializer):
    activity = ActivityListSerializer(read_only=True)

    class Meta:
        model = ModuleActivity
        fields = ['id', 'activity', 'order']


class ModuleSerializer(serializers.ModelSerializer):
    module_activities = ModuleActivitySerializer(many=True, read_only=True)
    activity_count = serializers.IntegerField(source='module_activities.count', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ['id', 'title', 'description', 'module_activities',
                  'activity_count', 'created_by_name', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class LessonFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonFeedback
        fields = [
            'id', 'activity_name', 'student_count',
            'grade_level_name', 'classroom_name',
            'most_engaging', 'adaptations', 'struggled_section', 'submitted_at',
        ]
        read_only_fields = ['id', 'submitted_at']


class TStemSurveyResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TStemSurveyResponse
        fields = ['id', 'responses', 'completed', 'completed_at', 'updated_at']
        read_only_fields = ['id', 'completed_at', 'updated_at']


class TeacherSurveyResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherSurveyResponse
        fields = ['id', 'responses', 'completed', 'completed_at', 'updated_at']
        read_only_fields = ['id', 'completed_at', 'updated_at']


class ProjectTopicSubmissionSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTopicSubmission
        fields = [
            'id', 'classroom_name', 'grade_level', 'num_students',
            'standards', 'background_concepts', 'research_questions',
            'status', 'admin_feedback', 'reviewed_by_name', 'reviewed_at',
            'submitted_at', 'teacher_name',
        ]
        read_only_fields = ['id', 'submitted_at', 'status', 'admin_feedback', 'reviewed_by_name', 'reviewed_at', 'teacher_name']

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() or obj.teacher.username

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class TeachSTEMTaskSerializer(serializers.ModelSerializer):
    completed = serializers.SerializerMethodField()

    class Meta:
        model = TeachSTEMTask
        fields = ['id', 'title', 'description', 'due_date', 'created_at', 'completed']
        read_only_fields = ['id', 'created_at', 'completed']

    def get_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.completions.filter(teacher=request.user).exists()


class TeachSTEMProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeachSTEMProfile
        fields = ['id', 'name', 'school', 'subject_taught', 'num_students', 'years_teaching', 'email']


class ThreeTwoOneAssignmentSerializer(serializers.ModelSerializer):
    response_count = serializers.SerializerMethodField()
    activity_title = serializers.SerializerMethodField()
    classroom_names = serializers.SerializerMethodField()
    student_responded = serializers.SerializerMethodField()

    class Meta:
        model = ThreeTwoOneAssignment
        fields = [
            'id', 'title', 'activity', 'activity_title',
            'classrooms', 'classroom_names',
            'response_type', 'is_open', 'created_at', 'response_count', 'student_responded',
        ]
        read_only_fields = ['id', 'created_at', 'response_count', 'activity_title', 'classroom_names', 'student_responded']

    def get_response_count(self, obj):
        return obj.responses.count()

    def get_activity_title(self, obj):
        return obj.activity.title if obj.activity else None

    def get_classroom_names(self, obj):
        return [c.name for c in obj.classrooms.all()]

    def get_student_responded(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.responses.filter(student=request.user).exists()


class ThreeTwoOneResponseSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = ThreeTwoOneResponse
        fields = [
            'id', 'assignment', 'student', 'student_name',
            'learned_1', 'learned_2', 'learned_3',
            'question_1', 'question_2', 'most_interesting',
            'response_video', 'submitted_at',
        ]
        read_only_fields = ['id', 'submitted_at', 'student', 'student_name', 'assignment']

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username


class TeacherStudentResponseSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    feedback = TeacherFeedbackSerializer(read_only=True)

    class Meta:
        model = StudentResponse
        fields = ['id', 'student_name', 'response_text', 'response_video',
                  'response_table', 'updated_at', 'feedback']

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username
