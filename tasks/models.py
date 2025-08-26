from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    main_type = models.CharField(
        max_length=16, 
        choices=[
            ('planner', 'planner'),
            ('sprinter', 'sprinter'), 
            ('flow', 'flow')
        ], 
        null=True, 
        blank=True
    )
    sub_type = models.CharField(max_length=16, null=True, blank=True)
    settings_json = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.user.username} - {self.main_type}"


class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    deadline = models.DateTimeField(null=True, blank=True)
    estimate_min = models.IntegerField(default=0)
    tags = models.CharField(max_length=200, blank=True)
    importance = models.IntegerField(default=0)  # 0-3
    status = models.CharField(
        max_length=10, 
        default="todo",
        choices=[
            ('todo', 'todo'),
            ('doing', 'doing'),
            ('done', 'done')
        ]
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    class Meta:
        ordering = ['-created_at']


class SubTask(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=200)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task.title} - {self.title}"

    class Meta:
        ordering = ['created_at']


class FocusLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    started_at = models.DateTimeField()
    stopped_at = models.DateTimeField()
    seconds = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.task.title} ({self.seconds}s)"


class DiagnosisAnswer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    q_index = models.IntegerField()  # 1..7
    choice = models.CharField(max_length=1)  # A/B/C
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - Q{self.q_index}: {self.choice}"

    class Meta:
        unique_together = ['user', 'q_index']
