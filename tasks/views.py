import json
import math
from datetime import datetime, timedelta
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Prefetch
from .models import UserProfile, Task, SubTask, FocusLog, DiagnosisAnswer, SortLog, TimelineEvent, TimelineLike


def jst_now():
    """JST現在時刻を取得"""
    return timezone.localtime()


def common_calculation(task):
    """共通計算関数"""
    now = jst_now()
    delta_days = math.floor((task.deadline - now).total_seconds() / 86400)
    overdue_days = max(0, -delta_days)
    urgency = max(0.0, min(1.0, 1 - max(delta_days, 0) / 14))
    imp = task.importance / 3.0
    penalty = -math.log1p(task.estimate_min / 30.0)
    overdue_bonus = 0.1 * overdue_days
    short = 1 if task.estimate_min <= 15 else 0
    not_started = 1 if task.status == 'todo' and not task.started_at else 0
    
    # 段差加点（スプリンター用）
    step = 0.0
    if delta_days == 0:
        step = 0.6
    elif delta_days == 1:
        step = 0.4
    elif delta_days == 2:
        step = 0.15
    elif delta_days == 3:
        step = 0.05
    
    return {
        'delta_days': delta_days,
        'overdue_days': overdue_days,
        'urgency': urgency,
        'imp': imp,
        'penalty': penalty,
        'overdue_bonus': overdue_bonus,
        'short': short,
        'not_started': not_started,
        'step': step
    }


def calculate_score(type_name, calc_data):
    """タイプ別スコア計算"""
    if type_name == 'planner':
        return (0.5 * calc_data['urgency'] + 
                0.3 * calc_data['imp'] + 
                calc_data['penalty'] + 
                calc_data['overdue_bonus'])
    elif type_name == 'sprinter':
        return (0.7 * calc_data['urgency'] + 
                0.2 * calc_data['not_started'] + 
                0.1 * calc_data['imp'] + 
                calc_data['step'] + 
                calc_data['penalty'] + 
                calc_data['overdue_bonus'])
    elif type_name == 'flow':
        return (0.3 * calc_data['short'] + 
                0.2 * (1 - calc_data['imp']) + 
                calc_data['penalty'] + 
                calc_data['overdue_bonus'])
    else:
        raise ValueError(f"Unknown type: {type_name}")


def compute_sorted_tasks(user, type_name):
    """ソート済みタスクを計算"""
    try:
        profile = UserProfile.objects.get(user=user)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=user)
    
    cutoff = jst_now() - timezone.timedelta(days=profile.archive_after_days)
    
    # タスクを取得（サブタスクも含む）
    qs = (Task.objects.filter(user=user)
          .prefetch_related(Prefetch('subtasks', queryset=SubTask.objects.order_by('order_index'))))
    
    # 親estimateは子合計で同期
    tasks = list(qs)
    for task in tasks:
        subtasks = list(task.subtasks.all())
        if subtasks:
            task.estimate_min = sum(st.estimate_min for st in subtasks)
    
    scored = []
    for task in tasks:
        # 完了済みでアーカイブ期間を過ぎたものは除外
        if task.completed_at and task.completed_at < cutoff:
            continue
        
        calc_data = common_calculation(task)
        score = calculate_score(type_name, calc_data)
        scored.append((task, score, calc_data))
    
    def sort_key(item):
        task, score, calc_data = item
        if task.status == 'done':
            return (2, 0, 0, 0, 0, 0)
        
        overdue_group = 0 if calc_data['overdue_days'] > 0 else 1
        return (
            overdue_group,        # 0=超過, 1=その他
            -score,               # スコア降順
            task.deadline,        # 締切昇順
            -task.importance,     # 重要度降順
            task.estimate_min,    # 見積昇順
            -int(task.created_at.timestamp())  # 新しい順
        )
    
    scored.sort(key=sort_key)
    return scored


@login_required
def home(request):
    """ホームページ"""
    return render(request, 'home.html')


@login_required
def analytics(request):
    """分析ページ"""
    return render(request, 'analytics.html')


@login_required
def tasks_page(request):
    """タスクページ"""
    return render(request, 'tasks.html')


@login_required
def timeline_page(request):
    """Timelineページ"""
    return render(request, 'timeline.html')


@login_required
def analysis_page(request):
    """分析ページ（ヒートマップ）"""
    return render(request, 'analysis.html')


@login_required
def logout_view(request):
    """ログアウト"""
    logout(request)
    messages.success(request, 'ログアウトしました')
    return redirect('login')


def signup_view(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            # ユーザープロフィールを作成
            UserProfile.objects.create(user=user)
            messages.success(request, 'アカウントが正常に作成されました。ログインしてください。')
            return redirect('login')
    else:
        form = UserCreationForm()
    
    return render(request, 'registration/signup.html', {'form': form})


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
            'shared': task.shared,
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


@login_required
@require_http_methods(["GET"])
def api_tasks_sorted(request):
    """ソート済みタスク取得"""
    try:
        type_name = request.GET.get('type', 'planner')
        if type_name not in ['planner', 'sprinter', 'flow']:
            return JsonResponse({'error': 'Invalid type'}, status=400)
        
        scored_tasks = compute_sorted_tasks(request.user, type_name)
        
        # レスポンス用データ構造を作成
        tasks_data = []
        for task, score, calc_data in scored_tasks:
            task_data = {
                'id': task.id,
                'parent_id': None,
                'title': task.title,
                'status': task.status,
                'deadline': task.deadline.isoformat(),
                'estimate_min': task.estimate_min,
                'importance': task.importance,
                'shared': task.shared,
                'score': round(score, 3),
                'has_subtasks': task.subtasks.exists()
            }
            tasks_data.append(task_data)
            
            # サブタスクを追加
            for subtask in task.subtasks.all():
                subtask_data = {
                    'id': subtask.id,
                    'parent_id': task.id,
                    'title': subtask.title,
                    'status': subtask.status,
                    'estimate_min': subtask.estimate_min,
                    'order_index': subtask.order_index
                }
                tasks_data.append(subtask_data)
        
        # SortLogを記録
        top_ids = [task.id for task, _, _ in scored_tasks[:5]]
        SortLog.objects.create(
            user=request.user,
            type=type_name,
            mode='manual',
            sorted_at=timezone.now(),
            item_count=len(scored_tasks),
            top_ids=top_ids
        )
        
        return JsonResponse({
            'sorted_at': timezone.now().isoformat(),
            'policy': {
                'window_days': 14,
                'overdue_bonus_per_day': 0.1,
                'step_add': {'D0': 0.6, 'D1': 0.4, 'D2': 0.15, 'D3': 0.05},
                'penalty': '-log1p(estimate/30)'
            },
            'tasks': tasks_data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_recompute_order(request):
    """手動ソート実行"""
    try:
        type_name = request.GET.get('type', 'planner')
        if type_name not in ['planner', 'sprinter', 'flow']:
            return JsonResponse({'error': 'Invalid type'}, status=400)
        
        scored_tasks = compute_sorted_tasks(request.user, type_name)
        
        # SortLogを記録
        top_ids = [task.id for task, _, _ in scored_tasks[:5]]
        SortLog.objects.create(
            user=request.user,
            type=type_name,
            mode='manual',
            sorted_at=timezone.now(),
            item_count=len(scored_tasks),
            top_ids=top_ids
        )
        
        return JsonResponse({
            'ok': True,
            'sorted_at': timezone.now().isoformat()
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_sort_settings(request):
    """ソート設定保存"""
    try:
        data = json.loads(request.body)
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        
        if 'auto_sort' in data:
            profile.auto_sort = data['auto_sort']
        if 'archive_after_days' in data:
            profile.archive_after_days = data['archive_after_days']
        
        profile.save()
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_subtask_create(request):
    """サブタスク作成"""
    try:
        data = json.loads(request.body)
        task = get_object_or_404(Task, id=data['task_id'], user=request.user)
        
        # バリデーション
        if data.get('estimate_min', 15) < 5:
            return JsonResponse({'error': 'estimate_min must be >= 5'}, status=400)
        
        subtask = SubTask.objects.create(
            task=task,
            title=data['title'],
            estimate_min=data.get('estimate_min', 15),
            order_index=data.get('order_index', 0)
        )
        
        # 親のestimate_minを子合計で更新
        subtasks = task.subtasks.all()
        if subtasks.exists():
            task.estimate_min = sum(st.estimate_min for st in subtasks)
            task.save()
        
        return JsonResponse({
            'ok': True,
            'id': subtask.id
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ヒートマップ関連の関数
def bucket_index(dt_jst):
    """30分ビンのインデックスを計算"""
    dow = dt_jst.weekday()  # 0=Mon
    slot = dt_jst.hour * 2 + (1 if dt_jst.minute >= 30 else 0)
    return dow, slot  # 0..6, 0..47


def week_bins(user, week_start):
    """週の30分ビンデータを計算"""
    # 初期化
    bins = [[0] * 48 for _ in range(7)]
    
    # 週の範囲
    start = timezone.make_aware(datetime.combine(week_start, datetime.min.time()))
    end = start + timedelta(days=7)
    
    logs = FocusLog.objects.filter(
        user=user,
        started_at__lt=end,
        stopped_at__gt=start
    )
    
    for log in logs:
        # logを30分境界で分割加算（部分重なり分も按分）
        log_start = max(log.started_at, start)
        log_end = min(log.stopped_at, end)
        
        # 30分単位で分割
        current = log_start
        while current < log_end:
            next_boundary = current.replace(
                minute=(current.minute // 30) * 30,
                second=0,
                microsecond=0
            ) + timedelta(minutes=30)
            
            segment_end = min(next_boundary, log_end)
            segment_seconds = int((segment_end - current).total_seconds())
            
            dow, slot = bucket_index(timezone.localtime(current))
            bins[dow][slot] += segment_seconds
            
            current = segment_end
    
    return bins  # 秒


def quantize(bins):
    """ビンデータを5段階に量子化"""
    flat = [sec for row in bins for sec in row]
    max_sec = max(flat) if flat else 0
    
    def level(sec):
        if max_sec <= 0:
            return 0
        r = sec / max_sec
        if r <= 0:
            return 0
        elif r <= 0.2:
            return 1
        elif r <= 0.4:
            return 2
        elif r <= 0.6:
            return 3
        elif r <= 0.8:
            return 4
        else:
            return 5
    
    levels = []
    for d in range(7):
        for s in range(48):
            levels.append({
                'dow': d,
                'slot': s,
                'level': level(bins[d][s])
            })
    
    return levels, max_sec


def week_avg_bins(user, window_weeks=4):
    """週平均ビンデータを計算"""
    # 直近window_weeks分の週を遡る
    stacks = [[[] for _ in range(48)] for __ in range(7)]  # 各ビンの非ゼロ値を積む
    
    now = jst_now()
    for k in range(window_weeks):
        # 週の開始日を計算（月曜日）
        week_start = now.date() - timedelta(days=now.weekday() + 7 * k)
        bins = week_bins(user, week_start)
        
        for d in range(7):
            for s in range(48):
                sec = bins[d][s]
                if sec > 0:
                    stacks[d][s].append(sec)
    
    # 平均を計算
    avg_bins = []
    for d in range(7):
        for s in range(48):
            values = stacks[d][s]
            avg_sec = sum(values) / len(values) if values else 0
            avg_bins.append({
                'dow': d,
                'slot': s,
                'level': 0,  # 後で量子化
                'sec': avg_sec
            })
    
    return avg_bins





# 分析API
@login_required
@require_http_methods(["GET"])
def api_heatmap(request):
    """ヒートマップデータ取得（当週）"""
    try:
        week_start_str = request.GET.get('week_start')
        if week_start_str:
            week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
        else:
            # 今週の月曜日
            now = jst_now()
            week_start = now.date() - timedelta(days=now.weekday())
        
        bins = week_bins(request.user, week_start)
        levels, max_sec = quantize(bins)
        
        return JsonResponse({
            'week_start': week_start.strftime('%Y-%m-%d'),
            'bin': 30,
            'levels': levels,
            'max_sec': max_sec
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def api_heatmap_avg(request):
    """ヒートマップ平均データ取得"""
    try:
        mode = request.GET.get('mode', 'week')  # week|month
        window = int(request.GET.get('window', 4 if mode == 'week' else 3))
        
        if mode == 'week':
            avg_bins = week_avg_bins(request.user, window)
        else:  # month
            # 月平均は週平均の4倍の期間で計算
            avg_bins = week_avg_bins(request.user, window * 4)
        
        # 平均値を量子化
        sec_values = [item['sec'] for item in avg_bins]
        max_sec = max(sec_values) if sec_values else 0
        
        def level(sec):
            if max_sec <= 0:
                return 0
            r = sec / max_sec
            if r <= 0:
                return 0
            elif r <= 0.2:
                return 1
            elif r <= 0.4:
                return 2
            elif r <= 0.6:
                return 3
            elif r <= 0.8:
                return 4
            else:
                return 5
        
        for item in avg_bins:
            item['level'] = level(item['sec'])
            del item['sec']  # レスポンスから除外
        
        return JsonResponse({
            'mode': mode,
            'window': window,
            'bin': 30,
            'levels': avg_bins,
            'max_sec': max_sec
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# Timeline API
@login_required
@require_http_methods(["GET"])
def api_timeline(request):
    """Timeline取得"""
    try:
        limit = int(request.GET.get('limit', 50))
        cursor = request.GET.get('cursor')
        
        # 削除されていないイベントを取得（自分のイベント）
        events = TimelineEvent.objects.filter(
            deleted_at__isnull=True,
            user=request.user
        ).order_by('-ts')
        
        if cursor:
            # cursor実装は簡易版（実際はより複雑な実装が必要）
            try:
                cursor_time = datetime.fromisoformat(cursor)
                events = events.filter(ts__lt=cursor_time)
            except:
                pass
        
        events = events[:limit]
        
        items = []
        for event in events:
            # いいね数を取得
            likes_count = event.likes.count()
            # 自分がいいねしているかチェック
            liked = event.likes.filter(user=request.user).exists()
            
            item_data = {
                'id': event.id,
                'user': event.user.username,
                'kind': event.kind,
                'task_id': event.task.id if event.task else None,
                'ts': event.ts.isoformat(),
                'likes': likes_count,
                'liked': liked
            }
            
            # 共有イベントの場合はタスク情報を追加
            if event.kind == 'task_shared' and event.task:
                item_data['task_title'] = event.task.title
                item_data['estimate_min'] = event.task.estimate_min
            
            items.append(item_data)
        
        # 次のcursor（簡易版）
        next_cursor = None
        if len(items) == limit:
            next_cursor = items[-1]['ts']
        
        return JsonResponse({
            'items': items,
            'next_cursor': next_cursor
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_timeline_like(request, event_id):
    """Timelineいいね"""
    try:
        event = get_object_or_404(TimelineEvent, id=event_id, deleted_at__isnull=True)
        
        # 既存のいいねをチェック
        like, created = TimelineLike.objects.get_or_create(
            user=request.user,
            event=event
        )
        
        if not created:
            # 既にいいね済みなら削除
            like.delete()
            liked = False
        else:
            liked = True
        
        # いいね数を再取得
        likes_count = event.likes.count()
        
        return JsonResponse({
            'ok': True,
            'liked': liked,
            'count': likes_count
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_timeline_delete(request, event_id):
    """Timeline削除"""
    try:
        event = get_object_or_404(TimelineEvent, id=event_id, deleted_at__isnull=True)
        
        # 自分のイベントのみ削除可能
        if event.user != request.user:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        # ソフトデリート
        event.deleted_at = timezone.now()
        event.save()
        
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def api_task_share(request, task_id):
    """タスク共有"""
    try:
        task = get_object_or_404(Task, id=task_id, user=request.user)
        
        # 完了したタスクのみ共有可能
        if task.status != 'done':
            return JsonResponse({'error': '完了したタスクのみ共有できます'}, status=400)
        
        # 共有フラグを切り替え
        task.shared = not task.shared
        task.save()
        
        # 共有された場合はTimelineEventを作成、解除された場合は削除
        if task.shared:
            TimelineEvent.objects.create(
                user=request.user,
                kind='task_shared',
                task=task,
                ts=timezone.now(),
                payload_json={
                    'title': task.title,
                    'estimate_min': task.estimate_min,
                    'tags': task.tags
                }
            )
        else:
            # 共有解除時は該当するTimelineEventを削除
            TimelineEvent.objects.filter(
                user=request.user,
                kind='task_shared',
                task=task
            ).delete()
        
        return JsonResponse({
            'ok': True,
            'shared': task.shared
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
