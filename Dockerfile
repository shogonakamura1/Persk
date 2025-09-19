# マルチステージビルドでイメージサイズを最適化
FROM python:3.11-slim as builder

# システムパッケージの更新とビルドに必要なツールをインストール
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Pythonの依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# 本番用イメージ
FROM python:3.11-slim

# システムパッケージの更新とランタイムに必要なパッケージをインストール
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 非rootユーザーを作成（セキュリティ向上）
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 作業ディレクトリを設定
WORKDIR /app

# ビルドステージからPythonパッケージをコピー
COPY --from=builder /root/.local /home/appuser/.local

# アプリケーションコードをコピー
COPY . .

# エントリーポイントスクリプトをコピー
COPY entrypoint.sh /entrypoint.sh

# 静的ファイルとメディアファイル用のディレクトリを作成
RUN mkdir -p /app/staticfiles /app/media

# エントリーポイントスクリプトに実行権限を付与
RUN chmod +x /entrypoint.sh

# ファイルの所有者をappuserに変更
RUN chown -R appuser:appuser /app

# 非rootユーザーに切り替え
USER appuser

# Pythonパスの設定
ENV PATH=/home/appuser/.local/bin:$PATH

# ポート8000を公開
EXPOSE 8000

# ヘルスチェック用のコマンド
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/')" || exit 1

# エントリーポイントを設定
ENTRYPOINT ["/entrypoint.sh"]

# Gunicornでアプリケーションを起動
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "persk.wsgi:application"]
