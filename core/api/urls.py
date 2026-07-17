from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.api_login, name='api_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('auth/register/teacher/', views.api_register_teacher, name='api_register_teacher'),
    path('auth/register/student/', views.api_register_student, name='api_register_student'),
    path('auth/me/', views.api_me, name='api_me'),

    # Metadata
    path('grade-levels/', views.api_grade_levels, name='api_grade_levels'),
    path('activity-types/', views.api_activity_types, name='api_activity_types'),

    # Activities
    path('activities/', views.api_activity_list, name='api_activity_list'),
    path('activities/mine/', views.api_my_activities, name='api_my_activities'),
    path('activities/create/', views.api_activity_create, name='api_activity_create'),
    path('activities/<int:pk>/', views.api_activity_detail, name='api_activity_detail'),
    path('activities/<int:pk>/edit/', views.api_activity_edit, name='api_activity_edit'),
    path('activities/<int:pk>/submit/', views.api_activity_submit, name='api_activity_submit'),
    path('activities/<int:pk>/delete/', views.api_activity_delete, name='api_activity_delete'),
    path('activities/<int:activity_pk>/responses/', views.api_student_responses, name='api_student_responses'),
    path('activities/<int:activity_pk>/teacher-responses/', views.api_teacher_responses, name='api_teacher_responses'),

    # Student responses
    path('responses/<int:prompt_pk>/save/', views.api_save_response, name='api_save_response'),
    path('responses/<int:response_pk>/feedback/', views.api_save_feedback, name='api_save_feedback'),

    # Points & scores
    path('classrooms/<int:classroom_pk>/activity/<int:activity_pk>/points/', views.api_classroom_activity_points),
    path('scores/section/<int:section_pk>/student/<int:student_pk>/classroom/<int:classroom_pk>/', views.api_save_section_score),

    # Classrooms (teacher)
    path('classrooms/', views.api_classrooms, name='api_classrooms'),
    path('classrooms/<int:pk>/', views.api_classroom_detail, name='api_classroom_detail'),
    path('classrooms/<int:pk>/assign-activities/', views.api_classroom_assign_activities),
    path('classrooms/<int:pk>/assign-modules/', views.api_classroom_assign_modules),
    path('classrooms/join/', views.api_join_classroom, name='api_join_classroom'),

    # Student classrooms
    path('student/classrooms/', views.api_student_classrooms, name='api_student_classrooms'),

    # Modules
    path('modules/', views.api_modules, name='api_modules'),
    path('modules/<int:pk>/', views.api_module_detail, name='api_module_detail'),
    path('modules/<int:pk>/view/', views.api_module_view, name='api_module_view'),

    # Admin
    path('admin/dashboard/', views.api_admin_dashboard, name='api_admin_dashboard'),
    path('admin/action/', views.api_admin_action, name='api_admin_action'),

    # Teach STEM
    path('teach-stem/profile/', views.api_teach_stem_profile, name='api_teach_stem_profile'),
    path('teach-stem/lesson-feedback/', views.api_lesson_feedback, name='api_lesson_feedback'),
    path('teach-stem/tasks/', views.api_teach_stem_tasks, name='api_teach_stem_tasks'),
    path('teach-stem/tasks/<int:pk>/', views.api_teach_stem_task_detail, name='api_teach_stem_task_detail'),
    path('teach-stem/tasks/<int:pk>/complete/', views.api_teach_stem_task_complete, name='api_teach_stem_task_complete'),
    path('teach-stem/project-topics/', views.api_project_topics, name='api_project_topics'),
    path('teach-stem/tstem-survey/', views.api_tstem_survey, name='api_tstem_survey'),
    path('teach-stem/project-topics/<int:pk>/submit/', views.api_project_topic_submit, name='api_project_topic_submit'),
    path('admin/project-topics/', views.api_admin_project_topics, name='api_admin_project_topics'),
    path('admin/project-topics/<int:pk>/feedback/', views.api_admin_project_topic_feedback, name='api_admin_project_topic_feedback'),
    path('admin/teach-stem-teachers/', views.api_admin_teach_stem_teachers, name='api_admin_teach_stem_teachers'),
    path('admin/teachers/', views.api_admin_all_teachers, name='api_admin_all_teachers'),
    path('admin/teachers/<int:user_id>/toggle-teach-stem/', views.api_admin_toggle_teach_stem, name='api_admin_toggle_teach_stem'),
    path('teach-stem/assigned-activities/', views.api_teach_stem_assigned_activities, name='api_teach_stem_assigned_activities'),

    # 3-2-1 Formative Assessment
    path('321/assignments/', views.api_321_assignments, name='api_321_assignments'),
    path('321/assignments/<int:pk>/', views.api_321_assignment_detail, name='api_321_assignment_detail'),
    path('321/assignments/<int:pk>/responses/', views.api_321_responses, name='api_321_responses'),
    path('321/student/', views.api_321_student_list, name='api_321_student_list'),
    path('321/student/<int:pk>/respond/', views.api_321_student_respond, name='api_321_student_respond'),
]
