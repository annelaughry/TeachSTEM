"""
URL configuration for lessons project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.search, name='search'),
    path('login/', views.user_login, name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='/login/'), name='logout'),
    path('register/', views.teacher_register, name='register'),
    path('student/register/', views.student_register, name='student_register'),
    path('pending/', views.pending_approval, name='pending_approval'),
    path('teacher/', views.teacher_dashboard, name='teacher_dashboard'),
    path('teacher/activity/create/', views.activity_create, name='activity_create'),
    path('teacher/activity/<int:pk>/edit/', views.activity_edit, name='activity_edit'),
    path('teacher/activity/<int:pk>/submit/', views.activity_submit, name='activity_submit'),
    path('teacher/activity/<int:pk>/responses/', views.teacher_responses, name='teacher_responses'),
    path('activity/<int:pk>/', views.activity_detail, name='activity_detail'),
    path('activity/<int:pk>/work/', views.student_activity, name='student_activity'),
    path('activity/<int:pk>/work/<int:section_num>/', views.student_activity, name='student_activity_section'),
    path('teacher/classroom/create/', views.classroom_create, name='classroom_create'),
    path('teacher/classroom/<int:pk>/', views.classroom_detail, name='classroom_detail'),
    path('teacher/classroom/<int:pk>/delete/', views.classroom_delete, name='classroom_delete'),
    path('teacher/classroom/<int:pk>/assign/', views.classroom_assign, name='classroom_assign'),
    path('join/', views.join_classroom, name='join_classroom'),
    path('student/', views.student_dashboard, name='student_dashboard'),
    path('staff/', views.admin_dashboard, name='admin_dashboard'),
    path('teacher/modules/', views.module_list, name='module_list'),
    path('teacher/module/create/', views.module_create, name='module_create'),
    path('teacher/module/<int:pk>/edit/', views.module_edit, name='module_edit'),
    path('teacher/module/<int:pk>/', views.module_detail, name='module_detail'),
    path('module/<int:pk>/', views.module_view, name='module_view'),
    path('api/', include('core.api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
