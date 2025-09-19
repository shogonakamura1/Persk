#!/bin/bash

# ECRへのDockerイメージデプロイスクリプト
# 使用方法: ./deploy-to-ecr.sh [version]

set -e

# 設定
AWS_REGION="ap-northeast-1"
AWS_ACCOUNT_ID="808834313692"
ECR_REPOSITORY="persk-app"
IMAGE_NAME="persk-app"

# バージョンタグの設定（引数が指定されていない場合はlatest）
VERSION_TAG=${1:-latest}

# フルイメージ名
FULL_IMAGE_NAME="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

echo "=== ECRデプロイメント開始 ==="
echo "リポジトリ: ${FULL_IMAGE_NAME}"
echo "バージョン: ${VERSION_TAG}"
echo ""

# 1. Dockerイメージのビルド
echo "1. Dockerイメージをビルド中..."
docker build -t ${IMAGE_NAME}:${VERSION_TAG} .
echo "✅ ビルド完了"
echo ""

# 2. ECR認証トークンの取得とログイン
echo "2. ECRに認証中..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
echo "✅ 認証完了"
echo ""

# 3. イメージのタグ付け
echo "3. イメージにタグを付与中..."
docker tag ${IMAGE_NAME}:${VERSION_TAG} ${FULL_IMAGE_NAME}:${VERSION_TAG}
docker tag ${IMAGE_NAME}:${VERSION_TAG} ${FULL_IMAGE_NAME}:latest
echo "✅ タグ付け完了"
echo ""

# 4. ECRへのプッシュ
echo "4. ECRにプッシュ中..."
docker push ${FULL_IMAGE_NAME}:${VERSION_TAG}
docker push ${FULL_IMAGE_NAME}:latest
echo "✅ プッシュ完了"
echo ""

# 5. プッシュされたイメージの確認
echo "5. プッシュされたイメージを確認中..."
aws ecr list-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'imageIds[*].[imageTag,imageDigest]' --output table
echo ""

echo "=== デプロイメント完了 ==="
echo "イメージURI: ${FULL_IMAGE_NAME}:${VERSION_TAG}"
echo ""

# トークン有効期限の注意事項
echo "⚠️  注意事項:"
echo "   - ECR認証トークンの有効期限: 12時間"
echo "   - 12時間後に再デプロイする場合は、このスクリプトを再実行してください"
echo "   - 本番環境での使用時は、適切なIAM権限を設定してください"
