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
    auto_sort = models.BooleanField(default=False)  # 初期=手動
    archive_after_days = models.IntegerField(default=30)  # 超過アーカイブ日数
    settings_json = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.user.username} - {self.main_type}"


class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    deadline = models.DateTimeField()  # 必須化
    estimate_min = models.IntegerField()  # 必須化、>=5
    tags = models.CharField(max_length=200, blank=True)
    importance = models.IntegerField()  # 必須化、0-3
    status = models.CharField(
        max_length=10, 
        default="todo",
        choices=[
            ('todo', 'todo'),
            ('doing', 'doing'),
            ('paused', 'paused'),
            ('done', 'done')
        ]
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    shared = models.BooleanField(default=False)  # 共有フラグ
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    class Meta:
        ordering = ['-created_at']


class SubTask(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=200)
    estimate_min = models.IntegerField(default=15)  # 必須化、>=5、デフォルト15分
    done = models.BooleanField(default=False)
    status = models.CharField(
        max_length=10, 
        default="todo",
        choices=[
            ('todo', 'todo'),
            ('doing', 'doing'),
            ('paused', 'paused'),
            ('done', 'done')
        ]
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order_index = models.IntegerField(default=0)  # 親内の手動順（自動ソート対象外）
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task.title} - {self.title}"

    class Meta:
        ordering = ['order_index', 'created_at']


class FocusLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True)
    subtask = models.ForeignKey(SubTask, on_delete=models.CASCADE, null=True, blank=True)
    started_at = models.DateTimeField()
    stopped_at = models.DateTimeField()
    seconds = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        task_name = self.task.title if self.task else self.subtask.title
        return f"{self.user.username} - {task_name} ({self.seconds}s)"


class TimelineEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    kind = models.CharField(max_length=32)  # 'task_start'|'task_stop'|'task_complete' など
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.SET_NULL)
    ts = models.DateTimeField(db_index=True)
    payload_json = models.JSONField(default=dict)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.kind} at {self.ts}"

    class Meta:
        ordering = ['-ts']


class TimelineLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(TimelineEvent, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'event')

    def __str__(self):
        return f"{self.user.username} likes {self.event}"


class SortLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    type = models.CharField(max_length=16)  # 'planner'|'sprinter'|'flow'
    mode = models.CharField(max_length=8)   # 'auto'|'manual'
    sorted_at = models.DateTimeField()
    item_count = models.IntegerField()
    top_ids = models.JSONField()  # 上位ID配列（デバッグ）

    def __str__(self):
        return f"{self.user.username} - {self.type} ({self.mode}) at {self.sorted_at}"

    class Meta:
        ordering = ['-sorted_at']


class DiagnosisAnswer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    q_index = models.IntegerField()  # 1..7
    choice = models.CharField(max_length=1)  # A/B/C
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - Q{self.q_index}: {self.choice}"

    class Meta:
        unique_together = ['user', 'q_index']
