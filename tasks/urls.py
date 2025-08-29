from django.urls import path
from . import views

app_name = 'tasks'

urlpatterns = [
    # ページ
    path('', views.home, name='home'),
    path('analytics/', views.analytics, name='analytics'),
    path('logout/', views.logout_view, name='logout'),
    
    # API
    path('api/tasks/', views.api_tasks, name='api_tasks'),
    path('api/tasks/create/', views.api_task_create, name='api_task_create'),
    path('api/tasks/<int:task_id>/update/', views.api_task_update, name='api_task_update'),
    path('api/tasks/<int:task_id>/delete/', views.api_task_delete, name='api_task_delete'),
    path('api/tasks/<int:task_id>/start/', views.api_task_start, name='api_task_start'),
    path('api/tasks/<int:task_id>/pause/', views.api_task_pause, name='api_task_pause'),
    path('api/tasks/<int:task_id>/resume/', views.api_task_resume, name='api_task_resume'),
    path('api/tasks/<int:task_id>/complete/', views.api_task_complete, name='api_task_complete'),
    
    path('api/subtasks/<int:subtask_id>/start/', views.api_subtask_start, name='api_subtask_start'),
    path('api/subtasks/<int:subtask_id>/pause/', views.api_subtask_pause, name='api_subtask_pause'),
    path('api/subtasks/<int:subtask_id>/resume/', views.api_subtask_resume, name='api_subtask_resume'),
    path('api/subtasks/<int:subtask_id>/complete/', views.api_subtask_complete, name='api_subtask_complete'),
    
    path('api/subtasks/<int:task_id>/bulk_upsert/', views.api_subtasks_bulk_upsert, name='api_subtasks_bulk_upsert'),
    
    path('api/diagnosis/submit/', views.api_diagnosis_submit, name='api_diagnosis_submit'),
    path('api/profile/', views.api_profile, name='api_profile'),
    path('api/profile/update/', views.api_profile_update, name='api_profile_update'),
    path('api/metrics/summary/', views.api_metrics_summary, name='api_metrics_summary'),
    path('api/tasks/<int:task_id>/focus-time/', views.api_task_focus_time, name='api_task_focus_time'),
    
    # 新しいソート関連API
    path('api/tasks/sorted/', views.api_tasks_sorted, name='api_tasks_sorted'),
    path('api/tasks/recompute-order/', views.api_recompute_order, name='api_recompute_order'),
    path('api/user/sort-settings/', views.api_sort_settings, name='api_sort_settings'),
    path('api/subtasks/create/', views.api_subtask_create, name='api_subtask_create'),
]
