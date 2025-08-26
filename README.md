# Persk - 性格×タスク管理アプリ

性格診断に基づいて最適化されたタスク管理アプリケーションです。

## 機能

- **性格診断**: 7つの質問で作業スタイルを診断
- **タスク管理**: 作成、編集、削除、開始、停止、完了
- **ストップウォッチ**: 固定バーでリアルタイム計測
- **進捗管理**: プログレスリングとストリーク表示
- **サブタスク**: タスクの詳細管理
- **分析**: フォーカス時間の統計

## 技術スタック

- **バックエンド**: Django 5.2
- **フロントエンド**: HTML/CSS/JavaScript
- **UI**: Bootstrap 5
- **データベース**: SQLite（開発用）

## セットアップ

### 1. 環境準備

```bash
# プロジェクトをクローン
git clone <repository-url>
cd Persk

# 仮想環境を作成（推奨）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows
```

### 2. 依存関係のインストール

```bash
pip install django
```

### 3. データベースのセットアップ

```bash
python manage.py migrate
```

### 4. スーパーユーザーの作成

```bash
python manage.py createsuperuser
```

### 5. サーバーの起動

```bash
python manage.py runserver
```

### 6. アクセス

- アプリケーション: http://localhost:8000/
- 管理画面: http://localhost:8000/admin/

## 使用方法

### 1. ログイン
- 作成したスーパーユーザーでログイン

### 2. 性格診断
- 「診断を開始」ボタンをクリック
- 7つの質問に回答
- 結果に基づいて「今の一手」が表示される

### 3. タスク管理
- 「新規タスク」でタスクを作成
- 「開始」ボタンでストップウォッチ開始
- 「停止」ボタンで一時停止
- 「完了」ボタンでタスク完了

### 4. 進捗確認
- プログレスリングで今日の進捗を確認
- ストリークで連続達成日数を確認

## 性格タイプ

### プランナー
- 計画的にタスクを進める
- 詳細な計画を立ててから実行
- 整理整頓された環境を好む

### スプリンター
- 短時間集中で効率的に作業
- 締切に追われて集中力が高まる
- 実践しながら学習する

### フロー
- 自然な流れで作業
- リラックスした環境で作業
- 無理のないペースを保つ

## API エンドポイント

### タスク関連
- `GET /api/tasks/` - タスク一覧取得
- `POST /api/tasks/create/` - タスク作成
- `POST /api/tasks/{id}/update/` - タスク更新
- `POST /api/tasks/{id}/delete/` - タスク削除
- `POST /api/tasks/{id}/start/` - タスク開始
- `POST /api/tasks/{id}/stop/` - タスク停止
- `POST /api/tasks/{id}/complete/` - タスク完了

### 診断関連
- `POST /api/diagnosis/submit/` - 診断結果送信
- `GET /api/profile/` - プロフィール取得
- `POST /api/profile/update/` - プロフィール更新

### メトリクス
- `GET /api/metrics/summary/` - 進捗サマリー

## 開発

### プロジェクト構造
```
Persk/
├── persk/          # Django設定
├── tasks/          # メインアプリ
├── templates/      # HTMLテンプレート
├── static/         # 静的ファイル
│   ├── css/
│   └── js/
└── manage.py
```

### 主要ファイル
- `tasks/models.py` - データベースモデル
- `tasks/views.py` - APIビュー
- `static/js/app.js` - フロントエンドJavaScript
- `templates/home.html` - メインページ

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。
