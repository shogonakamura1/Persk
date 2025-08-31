from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
from tasks.models import Task, SubTask
import random


class Command(BaseCommand):
    help = 'ソート機能をテストするためのダミーデータを作成します'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='ダミーデータを作成するユーザー名'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='既存のタスクを削除してから作成'
        )

    def handle(self, *args, **options):
        username = options['username']
        clear_existing = options['clear']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'ユーザー "{username}" が見つかりません')
            )
            return

        if clear_existing:
            Task.objects.filter(user=user).delete()
            self.stdout.write(
                self.style.SUCCESS('既存のタスクを削除しました')
            )

        # 現在時刻
        now = timezone.now()
        
        # ソートテスト用のダミーデータ（現在時刻に基づいて計算）
        dummy_tasks = [
            # 1. 今日の緊急タスク（plannerで上位、sprinterで最上位）
            {
                'title': '今日の緊急プレゼン（高重要度）',
                'deadline': now.replace(hour=18, minute=0, second=0, microsecond=0),  # 今日18時
                'estimate_min': 120,
                'importance': 3,
                'status': 'todo',
                'tags': '緊急,プレゼン,高重要度',
                'subtasks': [
                    {'title': '資料作成', 'estimate_min': 60},
                    {'title': 'リハーサル', 'estimate_min': 60}
                ]
            },
            # 2. 明日の重要タスク（sprinterで段差加点あり）
            {
                'title': '明日の会議準備（中重要度）',
                'deadline': (now + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0),  # 明日10時
                'estimate_min': 90,
                'importance': 2,
                'status': 'todo',
                'tags': '会議,中重要度',
                'subtasks': [
                    {'title': '議題整理', 'estimate_min': 30},
                    {'title': '資料準備', 'estimate_min': 60}
                ]
            },
            # 3. 短時間タスク（flowで上位）
            {
                'title': 'メールチェック（短時間・低重要度）',
                'deadline': now + timedelta(hours=2),
                'estimate_min': 10,
                'importance': 0,
                'status': 'todo',
                'tags': '短時間,低重要度',
                'subtasks': [
                    {'title': 'メール確認', 'estimate_min': 10}
                ]
            },
            # 4. 期限超過タスク（全タイプで最優先）
            {
                'title': '期限超過の報告書（高重要度）',
                'deadline': now - timedelta(hours=6),
                'estimate_min': 60,
                'importance': 3,
                'status': 'todo',
                'tags': '超過,報告書,高重要度',
                'subtasks': [
                    {'title': '緊急対応', 'estimate_min': 60}
                ]
            },
            # 5. 明後日のタスク（sprinterで段差加点あり）
            {
                'title': '明後日のプロジェクト会議',
                'deadline': (now + timedelta(days=2)).replace(hour=14, minute=0, second=0, microsecond=0),
                'estimate_min': 45,
                'importance': 2,
                'status': 'todo',
                'tags': 'プロジェクト,会議',
                'subtasks': [
                    {'title': '準備作業', 'estimate_min': 45}
                ]
            },
            # 6. 3日後のタスク（sprinterで段差加点あり）
            {
                'title': '3日後のクライアント打ち合わせ',
                'deadline': (now + timedelta(days=3)).replace(hour=15, minute=0, second=0, microsecond=0),
                'estimate_min': 30,
                'importance': 1,
                'status': 'todo',
                'tags': 'クライアント,打ち合わせ',
                'subtasks': [
                    {'title': '打ち合わせ準備', 'estimate_min': 30}
                ]
            },
            # 7. 実行中のタスク（sprinterでnot_started=0）
            {
                'title': '現在実行中のタスク',
                'deadline': now + timedelta(hours=4),
                'estimate_min': 60,
                'importance': 2,
                'status': 'doing',
                'started_at': now - timedelta(minutes=30),
                'tags': '実行中',
                'subtasks': [
                    {'title': '作業中', 'estimate_min': 60}
                ]
            },
            # 8. 長期間タスク（flowで低重要度重視）
            {
                'title': '長期プロジェクト計画（低重要度・長時間）',
                'deadline': now + timedelta(days=14),
                'estimate_min': 300,
                'importance': 0,
                'status': 'todo',
                'tags': '長期,低重要度',
                'subtasks': [
                    {'title': '計画立案', 'estimate_min': 120},
                    {'title': '準備作業', 'estimate_min': 180}
                ]
            },
            # 9. 中程度の緊急タスク（plannerで中位）
            {
                'title': '今週末のイベント準備',
                'deadline': (now + timedelta(days=5)).replace(hour=12, minute=0, second=0, microsecond=0),
                'estimate_min': 90,
                'importance': 1,
                'status': 'todo',
                'tags': 'イベント,中重要度',
                'subtasks': [
                    {'title': '準備作業', 'estimate_min': 90}
                ]
            },
            # 10. 完了済みタスク（全タイプで最下位）
            {
                'title': '完了済みタスク',
                'deadline': now + timedelta(days=7),
                'estimate_min': 45,
                'importance': 2,
                'status': 'done',
                'completed_at': now - timedelta(hours=1),
                'tags': '完了',
                'subtasks': [
                    {'title': '作業完了', 'estimate_min': 45, 'done': True}
                ]
            }
        ]

        created_count = 0
        for task_data in dummy_tasks:
            # サブタスク情報を分離
            subtasks_data = task_data.pop('subtasks', [])
            
            # タスクを作成
            task = Task.objects.create(
                user=user,
                **task_data
            )
            
            # サブタスクを作成
            for i, subtask_data in enumerate(subtasks_data):
                SubTask.objects.create(
                    task=task,
                    order_index=i,
                    **subtask_data
                )
            
            created_count += 1
            self.stdout.write(
                f'タスク "{task.title}" を作成しました（期限: {task.deadline.strftime("%Y-%m-%d %H:%M")}）'
            )

        self.stdout.write(
            self.style.SUCCESS(f'{created_count}個のタスクを作成しました')
        )
        
        # ソート機能のテスト用情報を表示
        self.stdout.write('\n=== ソート機能テスト用情報 ===')
        self.stdout.write(f'現在時刻: {now.strftime("%Y-%m-%d %H:%M:%S")}')
        self.stdout.write('\n作成されたタスクの特徴:')
        self.stdout.write('1. 今日の緊急プレゼン（高重要度） - 今日18時')
        self.stdout.write('2. 明日の会議準備（中重要度） - 明日10時')
        self.stdout.write('3. メールチェック（短時間・低重要度） - 2時間後')
        self.stdout.write('4. 期限超過の報告書（高重要度） - 6時間前')
        self.stdout.write('5. 明後日のプロジェクト会議 - 明後日14時')
        self.stdout.write('6. 3日後のクライアント打ち合わせ - 3日後15時')
        self.stdout.write('7. 現在実行中のタスク - 4時間後')
        self.stdout.write('8. 長期プロジェクト計画（低重要度・長時間） - 14日後')
        self.stdout.write('9. 今週末のイベント準備 - 5日後12時')
        self.stdout.write('10. 完了済みタスク - 7日後（完了済み）')
        
        self.stdout.write('\n期待されるソート結果:')
        self.stdout.write('=== planner（緊急度重視）===')
        self.stdout.write('1. 期限超過の報告書（最優先）')
        self.stdout.write('2. 今日の緊急プレゼン（高重要度）')
        self.stdout.write('3. メールチェック（2時間後）')
        self.stdout.write('4. 現在実行中のタスク')
        self.stdout.write('5. 明日の会議準備')
        
        self.stdout.write('\n=== sprinter（期限と段差加点重視）===')
        self.stdout.write('1. 期限超過の報告書（最優先）')
        self.stdout.write('2. 今日の緊急プレゼン（今日=+0.6点）')
        self.stdout.write('3. 明日の会議準備（明日=+0.4点）')
        self.stdout.write('4. 明後日のプロジェクト会議（明後日=+0.15点）')
        self.stdout.write('5. 3日後のクライアント打ち合わせ（3日後=+0.05点）')
        
        self.stdout.write('\n=== flow（短時間・低重要度重視）===')
        self.stdout.write('1. 期限超過の報告書（最優先）')
        self.stdout.write('2. メールチェック（短時間=+0.3点、低重要度=+0.2点）')
        self.stdout.write('3. 長期プロジェクト計画（低重要度=+0.2点）')
        self.stdout.write('4. 現在実行中のタスク')
        self.stdout.write('5. 明日の会議準備')
