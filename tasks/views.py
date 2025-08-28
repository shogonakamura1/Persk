import json
from datetime import datetime, timedelta
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .models import UserProfile, Task, SubTask, FocusLog, DiagnosisAnswer


@login_required
def home(request):
    """ホームページ"""
    return render(request, 'home.html')


@login_required
def analytics(request):
    """分析ページ"""
    return render(request, 'analytics.html')


@login_required
def logout_view(request):
    """ログアウト"""
    logout(request)
    messages.success(request, 'ログアウトしました')
    return redirect('login')


# API Views

@login_required
@require_http_methods(["GET"])
def api_tasks(request):
    """タスク一覧取得"""
    tasks = Task.objects.filter(user=request.user)
    tasks_data = []
    
    for task in tasks:
        task_data = {
            'id': task.id,
            'title': task.title,
            'deadline': task.deadline.isoformat() if task.deadline else None,
            'estimate_min': task.estimate_min,
            'tags': task.tags,
            'importance': task.importance,
            'status': task.status,
            'started_at': task.started_at.isoformat() if task.started_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'subtasks': [
                {
                    'id': subtask.id,
                    'title': subtask.title,
                    'done': subtask.done,
                    'status': subtask.status,
                    'started_at': subtask.started_at.isoformat() if subtask.started_at else None,
                    'completed_at': subtask.completed_at.isoformat() if subtask.completed_at else None
                }
                for subtask in task.subtasks.all()
            ]
        }
        tasks_data.append(task_data)
    
    return JsonResponse({'tasks': tasks_data})


@login_required
@require_http_methods(["POST"])
def api_task_create(request):
    """タスク作成"""
    try:
        data = json.loads(request.body)
        task = Task.objects.create(
            user=request.user,
            title=data.get('title', ''),
            deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None,
            estimate_min=data.get('estimate_min', 0),
            tags=data.get('tags', ''),
            importance=data.get('importance', 0)
        )
        return JsonResponse({'ok': True, 'id': task.id})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_update(request, task_id):
    """タスク更新"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        data = json.loads(request.body)
        
        if 'title' in data:
            task.title = data['title']
        if 'deadline' in data:
            task.deadline = datetime.fromisoformat(data['deadline']) if data['deadline'] else None
        if 'estimate_min' in data:
            task.estimate_min = data['estimate_min']
        if 'tags' in data:
            task.tags = data['tags']
        if 'importance' in data:
            task.importance = data['importance']
        if 'status' in data:
            task.status = data['status']
        
        task.save()
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_delete(request, task_id):
    """タスク削除"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        task.delete()
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_start(request, task_id):
    """タスク開始"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        now = timezone.now()
        
        task.status = 'doing'
        task.started_at = now
        task.save()
        
        return JsonResponse({'ok': True, 'started_at': now.isoformat()})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_pause(request, task_id):
    """タスク一時停止"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        now = timezone.now()
        
        seconds = 0  # 初期化
        if task.started_at:
            # FocusLogを作成
            seconds = int((now - task.started_at).total_seconds())
            FocusLog.objects.create(
                user=request.user,
                task=task,
                started_at=task.started_at,
                stopped_at=now,
                seconds=seconds
            )
        
        task.status = 'paused'
        task.started_at = None
        task.save()
        
        return JsonResponse({'ok': True, 'logged_seconds': seconds})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_resume(request, task_id):
    """タスク再開"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        now = timezone.now()

        elapsed_seconds = 0  # 初期化
        if task.started_at:
            elapsed_seconds = int((now - task.started_at).total_seconds())
            FocusLog.objects.create(
                user=request.user,
                task=task,
                started_at=task.started_at,
                stopped_at=now,
                seconds=elapsed_seconds
            )
        
        task.status = 'doing'
        task.started_at = now
        task.save()
        
        return JsonResponse({
            'ok': True, 
            'started_at': now.isoformat(),
            'logged_seconds': elapsed_seconds
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_complete(request, task_id):
    """タスク完了"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        now = timezone.now()
        
        # 実行中ならログを作成
        if task.status == 'doing' and task.started_at:
            seconds = int((now - task.started_at).total_seconds())
            FocusLog.objects.create(
                user=request.user,
                task=task,
                started_at=task.started_at,
                stopped_at=now,
                seconds=seconds
            )
        
        task.status = 'done'
        task.completed_at = now
        task.started_at = None
        task.save()
        
        return JsonResponse({'ok': True, 'completed_at': now.isoformat()})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtasks_bulk_upsert(request, task_id):
    """サブタスク一括更新"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        data = json.loads(request.body)
        
        items = []
        for subtask_data in data.get('subtasks', []):
            if 'id' in subtask_data:
                # 更新
                subtask = get_object_or_404(SubTask, id=subtask_data['id'], task=task)
                subtask.title = subtask_data.get('title', subtask.title)
                subtask.done = subtask_data.get('done', subtask.done)
                subtask.save()
            else:
                # 新規作成
                subtask = SubTask.objects.create(
                    task=task,
                    title=subtask_data.get('title', ''),
                    done=subtask_data.get('done', False)
                )
            
            items.append({
                'id': subtask.id,
                'done': subtask.done
            })
        
        return JsonResponse({'ok': True, 'items': items})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtask_start(request, subtask_id):
    """サブタスク開始"""
    try:
        subtask = get_object_or_404(SubTask, id=subtask_id, task__user=request.user)
        now = timezone.now()
        
        subtask.status = 'doing'
        subtask.started_at = now
        subtask.save()
        
        return JsonResponse({'ok': True, 'started_at': now.isoformat()})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtask_pause(request, subtask_id):
    """サブタスク一時停止"""
    try:
        subtask = get_object_or_404(SubTask, id=subtask_id, task__user=request.user)
        now = timezone.now()
        
        seconds = 0  # 初期化
        if subtask.started_at:
            # FocusLogを作成
            seconds = int((now - subtask.started_at).total_seconds())
            FocusLog.objects.create(
                user=request.user,
                subtask=subtask,
                started_at=subtask.started_at,
                stopped_at=now,
                seconds=seconds
            )
        
        subtask.status = 'paused'
        # started_atをNoneに設定しない（経過時間を維持するため）
        subtask.save()
        
        return JsonResponse({'ok': True, 'logged_seconds': seconds})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtask_resume(request, subtask_id):
    """サブタスク再開"""
    try:
        subtask = get_object_or_404(SubTask, id=subtask_id, task__user=request.user)
        now = timezone.now()
        
        subtask.status = 'doing'
        # started_atは既存の値を維持（経過時間を保持するため）
        subtask.save()
        
        return JsonResponse({'ok': True, 'started_at': subtask.started_at.isoformat() if subtask.started_at else now.isoformat()})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtask_complete(request, subtask_id):
    """サブタスク完了"""
    try:
        subtask = get_object_or_404(SubTask, id=subtask_id, task__user=request.user)
        now = timezone.now()
        
        # 実行中ならログを作成
        if subtask.status == 'doing' and subtask.started_at:
            seconds = int((now - subtask.started_at).total_seconds())
            FocusLog.objects.create(
                user=request.user,
                subtask=subtask,
                started_at=subtask.started_at,
                stopped_at=now,
                seconds=seconds
            )
        
        subtask.status = 'done'
        subtask.completed_at = now
        subtask.started_at = None
        subtask.save()
        
        return JsonResponse({'ok': True, 'completed_at': now.isoformat()})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_diagnosis_submit(request):
    """診断結果送信"""
    try:
        data = json.loads(request.body)
        answers = data.get('answers', [])
        
        # 既存の回答を削除
        DiagnosisAnswer.objects.filter(user=request.user).delete()
        
        # 新しい回答を保存
        for answer in answers:
            DiagnosisAnswer.objects.create(
                user=request.user,
                q_index=answer['q_index'],
                choice=answer['choice']
            )
        
        # タイプ判定（簡易版）
        scores = {'planner': 0, 'sprinter': 0, 'flow': 0}
        for answer in answers:
            if answer['choice'] == 'A':
                scores['planner'] += 1
            elif answer['choice'] == 'B':
                scores['sprinter'] += 1
            elif answer['choice'] == 'C':
                scores['flow'] += 1
        
        # 最大スコアのタイプを決定
        max_score = max(scores.values())
        main_type = [k for k, v in scores.items() if v == max_score][0]
        
        # 同点があればsub_typeに設定
        sub_type = None
        if list(scores.values()).count(max_score) > 1:
            sub_types = [k for k, v in scores.items() if v == max_score]
            sub_type = '/'.join(sub_types)
        
        # UserProfileを更新
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        profile.main_type = main_type
        profile.sub_type = sub_type
        profile.save()
        
        return JsonResponse({
            'ok': True,
            'main_type': main_type,
            'sub_type': sub_type
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def api_profile(request):
    """プロフィール取得"""
    try:
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        return JsonResponse({
            'main_type': profile.main_type,
            'sub_type': profile.sub_type,
            'settings': profile.settings_json
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_profile_update(request):
    """プロフィール更新"""
    try:
        data = json.loads(request.body)
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        
        if 'settings' in data:
            profile.settings_json = data['settings']
        
        profile.save()
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def api_metrics_summary(request):
    """メトリクス取得"""
    try:
        range_type = request.GET.get('range', 'day')
        now = timezone.now()
        
        if range_type == 'day':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif range_type == 'week':
            start_date = now - timedelta(days=7)
        elif range_type == 'month':
            start_date = now - timedelta(days=30)
        else:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # フォーカス時間の合計
        focus_logs = FocusLog.objects.filter(
            user=request.user,
            started_at__gte=start_date
        )
        total_seconds = sum(log.seconds for log in focus_logs)
        
        # 仮の目標値（8時間 = 28800秒）
        target_seconds = 28800
        
        # ストリーク（連続日数）
        streak_days = 0
        current_date = now.date()
        while True:
            day_logs = FocusLog.objects.filter(
                user=request.user,
                started_at__date=current_date
            )
            if day_logs.exists():
                streak_days += 1
                current_date -= timedelta(days=1)
            else:
                break
        
        return JsonResponse({
            'ring': {
                'target': target_seconds,
                'actual': total_seconds
            },
            'streak': {
                'days': streak_days
            },
            'heatmap': []  # 仮実装
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def api_task_focus_time(request, task_id):
    """タスクのフォーカス時間取得"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        
        # このタスクのFocusLogから総フォーカス時間を計算
        focus_logs = FocusLog.objects.filter(
            user=request.user,
            task=task
        )
        total_seconds = sum(log.seconds for log in focus_logs)
        
        return JsonResponse({
            'ok': True,
            'task_id': task_id,
            'total_seconds': total_seconds
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)
