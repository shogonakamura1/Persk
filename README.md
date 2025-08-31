# Persk - AI搭載タスク管理アプリ

あなたの作業スタイルに合わせてタスクを最適化するAI搭載タスク管理アプリケーションです。

## ✨ 主な機能

- **🎯 性格診断**: 7つの質問で作業スタイルを診断し、最適なタスク管理方法を提案
- **📝 タスク管理**: 作成、編集、削除、開始、停止、完了の完全なタスクライフサイクル
- **⏱️ タイマー機能**: リアルタイム計測で集中時間を可視化
- **📊 進捗管理**: プログレスリングとストリーク表示でモチベーション維持
- **📋 サブタスク**: タスクの詳細管理とチェックリスト機能
- **📈 分析**: フォーカス時間の統計とヒートマップ表示
- **🤝 共有機能**: タスクの共有とチームワーク促進
- **📱 モダンUI**: 紫グラデーションを基調とした美しいデザイン

## 🛠️ 技術スタック

- **🐍 バックエンド**: Django 5.2
- **🎨 フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **🎯 UIフレームワーク**: Bootstrap 5
- **💾 データベース**: SQLite（開発用）
- **🎨 デザイン**: カスタムCSS（紫グラデーション）
- **📱 レスポンシブ**: モバイルファーストデザイン

## 🚀 セットアップ

### 1. 環境準備

```bash
# プロジェクトをクローン
git clone https://github.com/shogonakamura1/Persk.git
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

- 🌐 アプリケーション: http://localhost:8000/
- ⚙️ 管理画面: http://localhost:8000/admin/

## 📖 使用方法

### 1. 🔐 ログイン
- 作成したスーパーユーザーでログイン
- 美しい紫グラデーションのログイン画面

### 2. 🎯 性格診断
- 「診断を開始」ボタンをクリック
- 7つの質問に回答して作業スタイルを診断
- 結果に基づいて「今の一手」が表示される

### 3. 📝 タスク管理
- 「新規タスク」でタスクを作成（モダンなモーダル）
- 「開始」ボタンでタイマー開始
- 「停止」ボタンで一時停止
- 「完了」ボタンでタスク完了
- タスク領域をクリックで詳細表示

### 4. 📊 進捗確認
- プログレスリングで今日の進捗を確認
- ストリークで連続達成日数を確認
- 分析ページでフォーカス時間の統計を確認

### 5. 🤝 共有機能
- 完了したタスクを共有
- チームメンバーとの励ましメッセージ
- タイムラインで活動履歴を確認

## 🎭 性格タイプ

### 📅 プランナー
- 計画的にタスクを進める
- 詳細な計画を立ててから実行
- 整理整頓された環境を好む
- 体系的に基礎から学ぶ

### ⚡ スプリンター
- 短時間集中で効率的に作業
- 締切に追われて集中力が高まる
- 実践しながら学習する
- 最も興味のあるものから始める

### 🌊 フロー
- 自然な流れで作業
- リラックスした環境で作業
- 無理のないペースを保つ
- 気分に応じて選んで取り組む

## 🔌 API エンドポイント

### 📝 タスク関連
- `GET /api/tasks/` - タスク一覧取得
- `POST /api/tasks/create/` - タスク作成
- `POST /api/tasks/{id}/update/` - タスク更新
- `POST /api/tasks/{id}/delete/` - タスク削除
- `POST /api/tasks/{id}/start/` - タスク開始
- `POST /api/tasks/{id}/pause/` - タスク一時停止
- `POST /api/tasks/{id}/resume/` - タスク再開
- `POST /api/tasks/{id}/complete/` - タスク完了
- `POST /api/tasks/{id}/share/` - タスク共有

### 🎯 診断関連
- `POST /api/diagnosis/submit/` - 診断結果送信
- `GET /api/profile/` - プロフィール取得
- `POST /api/profile/update/` - プロフィール更新

### 📊 メトリクス・分析
- `GET /api/metrics/summary/` - 進捗サマリー
- `GET /api/analytics/heatmap/` - ヒートマップデータ
- `GET /api/analytics/heatmap_avg/` - 平均ヒートマップデータ

### 🤝 共有・タイムライン
- `GET /api/timeline/` - タイムライン取得
- `POST /api/timeline/{id}/like/` - いいね機能
- `POST /api/timeline/{id}/delete/` - タイムライン削除

## 💻 開発

### 📁 プロジェクト構造
```
Persk/
├── persk/                    # Django設定
├── tasks/                    # メインアプリ
│   ├── models.py            # データベースモデル
│   ├── views.py             # APIビュー
│   ├── urls.py              # URL設定
│   └── management/          # 管理コマンド
├── templates/               # HTMLテンプレート
│   ├── base.html           # ベーステンプレート
│   ├── home.html           # メインページ
│   ├── analysis.html       # 分析ページ
│   ├── timeline.html       # タイムラインページ
│   └── registration/       # 認証ページ
├── static/                  # 静的ファイル
│   ├── css/
│   │   └── app.css         # メインCSS
│   └── js/
│       └── app.js          # フロントエンドJavaScript
└── manage.py
```

### 🔧 主要ファイル
- `tasks/models.py` - データベースモデル（Task, Subtask, FocusLog等）
- `tasks/views.py` - APIビュー（RESTful API）
- `static/js/app.js` - フロントエンドJavaScript（状態管理、UI操作）
- `templates/home.html` - メインページ（タスク管理画面）
- `templates/analysis.html` - 分析ページ（ヒートマップ表示）
- `templates/timeline.html` - タイムラインページ（共有機能）

## 📄 ライセンス

MIT License

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 🌟 最新の更新

### v2.0.0 (202５年８月最新)
- 🎨 UI/UXの大幅改善
- 🟣 紫グラデーションを基調としたモダンデザイン
- 📱 レスポンシブデザインの強化
- 🤝 共有機能とタイムラインの追加
- 📊 分析機能の強化（ヒートマップ）
- ⚡ パフォーマンスの最適化
- 🐛 バグ修正と安定性向上

---

**Persk** - あなたの作業スタイルに合わせてタスクを最適化するAI搭載タスク管理アプリ
