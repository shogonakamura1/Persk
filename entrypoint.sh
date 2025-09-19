#!/bin/bash

# エラー時にスクリプトを停止
set -e

echo "=== Django アプリケーション起動準備 ==="

# データベースの接続を待機（PostgreSQL使用時）
if [ "$DATABASE_URL" ]; then
    echo "データベース接続を確認中..."
    python manage.py check --database default
    echo "データベース接続確認完了"
fi

# データベースマイグレーションの実行
echo "データベースマイグレーションを実行中..."
python manage.py migrate --noinput
echo "マイグレーション完了"

# 静的ファイルの収集
echo "静的ファイルを収集中..."
python manage.py collectstatic --noinput
echo "静的ファイル収集完了"

# スーパーユーザーの作成（初回起動時のみ）
if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ] && [ "$DJANGO_SUPERUSER_EMAIL" ]; then
    echo "スーパーユーザーの作成を確認中..."
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists():
    User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME', '$DJANGO_SUPERUSER_EMAIL', '$DJANGO_SUPERUSER_PASSWORD')
    print('スーパーユーザーを作成しました')
else:
    print('スーパーユーザーは既に存在します')
"
fi

echo "=== 起動準備完了 ==="

# メインコマンドを実行
exec "$@"
