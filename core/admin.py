from django.contrib import admin
from .models import Activity, ActivitySection, ActivityPrompt, GradeLevel, Standard, Strand, Concept, TeacherProfile, Classroom, StudentResponse, TeacherFeedback


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    list_display = ('name', 'order')
    ordering = ('order',)


class ActivityPromptInline(admin.TabularInline):
    model = ActivityPrompt
    extra = 1
    fields = ('prompt_type', 'text', 'order')


class ActivitySectionInline(admin.StackedInline):
    model = ActivitySection
    extra = 0
    show_change_link = True


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_email', 'is_approved')
    list_filter = ('is_approved',)
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')
    actions = ['approve_teachers']

    def get_email(self, obj):
        return obj.user.email
    get_email.short_description = 'Email'

    def approve_teachers(self, request, queryset):
        count = queryset.update(is_approved=True)
        self.message_user(request, f"{count} teacher account(s) approved.")
    approve_teachers.short_description = "Approve selected teacher accounts"


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_teachers', 'code', 'created_at')
    list_filter = ('teachers',)
    search_fields = ('name', 'code')
    readonly_fields = ('code',)
    filter_horizontal = ('teachers', 'assigned_activities')

    def get_teachers(self, obj):
        return ', '.join(t.get_full_name() or t.username for t in obj.teachers.all())
    get_teachers.short_description = 'Teachers'


@admin.register(Strand)
class StrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'subject')
    list_filter = ('subject',)
    search_fields = ('name',)


@admin.register(Standard)
class StandardAdmin(admin.ModelAdmin):
    list_display = ('code', 'grade_level', 'strand', 'description')
    list_filter = ('grade_level', 'strand__subject', 'strand')
    search_fields = ('code', 'description')
    autocomplete_fields = ('strand',)


@admin.register(Concept)
class ConceptAdmin(admin.ModelAdmin):
    list_display = ('name', 'subject')
    list_filter = ('subject',)
    search_fields = ('name',)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'activity_type', 'status', 'created_by')
    list_filter = ('status', 'activity_type', 'grade_levels')
    search_fields = ('title', 'description')
    filter_horizontal = ('standards', 'concepts')
    inlines = [ActivitySectionInline]
    actions = ['approve_activities', 'reject_activities']

    def approve_activities(self, request, queryset):
        count = queryset.filter(status='pending').update(status='approved')
        self.message_user(request, f"{count} activit{'y' if count == 1 else 'ies'} approved and added to the shared library.")
    approve_activities.short_description = "Approve selected activities → shared library"

    def reject_activities(self, request, queryset):
        count = queryset.filter(status='pending').update(status='rejected')
        self.message_user(request, f"{count} activit{'y' if count == 1 else 'ies'} rejected.")
    reject_activities.short_description = "Reject selected activities"


@admin.register(ActivitySection)
class ActivitySectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'activity', 'order')
    inlines = [ActivityPromptInline]


@admin.register(StudentResponse)
class StudentResponseAdmin(admin.ModelAdmin):
    list_display = ('student', 'prompt', 'updated_at')
    list_filter = ('prompt__section__activity',)


@admin.register(TeacherFeedback)
class TeacherFeedbackAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'response', 'updated_at')
