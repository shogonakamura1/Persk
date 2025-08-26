from django.contrib import admin
from .models import UserProfile, Task, SubTask, FocusLog, DiagnosisAnswer


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'main_type', 'sub_type']
    list_filter = ['main_type']
    search_fields = ['user__username']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'deadline', 'estimate_min', 'created_at']
    list_filter = ['status', 'importance', 'created_at']
    search_fields = ['title', 'user__username']
    date_hierarchy = 'created_at'


@admin.register(SubTask)
class SubTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'task', 'done', 'created_at']
    list_filter = ['done', 'created_at']
    search_fields = ['title', 'task__title']


@admin.register(FocusLog)
class FocusLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'task', 'started_at', 'stopped_at', 'seconds']
    list_filter = ['started_at']
    search_fields = ['user__username', 'task__title']
    date_hierarchy = 'started_at'


@admin.register(DiagnosisAnswer)
class DiagnosisAnswerAdmin(admin.ModelAdmin):
    list_display = ['user', 'q_index', 'choice', 'created_at']
    list_filter = ['q_index', 'choice', 'created_at']
    search_fields = ['user__username']
