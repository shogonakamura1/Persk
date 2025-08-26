from django.urls import path
from . import views

app_name = 'tasks'

urlpatterns = [
    # ページ
    path('', views.home, name='home'),
    path('analytics/', views.analytics, name='analytics'),
    
    # API
    path('api/tasks/', views.api_tasks, name='api_tasks'),
    path('api/tasks/create/', views.api_task_create, name='api_task_create'),
    path('api/tasks/<int:task_id>/update/', views.api_task_update, name='api_task_update'),
    path('api/tasks/<int:task_id>/delete/', views.api_task_delete, name='api_task_delete'),
    path('api/tasks/<int:task_id>/start/', views.api_task_start, name='api_task_start'),
    path('api/tasks/<int:task_id>/stop/', views.api_task_stop, name='api_task_stop'),
    path('api/tasks/<int:task_id>/complete/', views.api_task_complete, name='api_task_complete'),
    
    path('api/subtasks/<int:task_id>/bulk_upsert/', views.api_subtasks_bulk_upsert, name='api_subtasks_bulk_upsert'),
    
    path('api/diagnosis/submit/', views.api_diagnosis_submit, name='api_diagnosis_submit'),
    path('api/profile/', views.api_profile, name='api_profile'),
    path('api/profile/update/', views.api_profile_update, name='api_profile_update'),
    path('api/metrics/summary/', views.api_metrics_summary, name='api_metrics_summary'),
]
