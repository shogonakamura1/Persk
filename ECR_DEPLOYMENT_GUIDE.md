# ECR デプロイメントガイド

## 概要

このガイドでは、PerskアプリケーションのDockerイメージをAWS ECR（Elastic Container Registry）にデプロイする手順を説明します。

## 前提条件

- AWS CLI がインストール・設定済み
- Docker がインストール済み
- 適切なIAM権限を持つAWS認証情報が設定済み

## ECRリポジトリ情報

- **リポジトリ名**: `persk-app`
- **リージョン**: `ap-northeast-1` (東京)
- **アカウントID**: `808834313692`
- **リポジトリURI**: `808834313692.dkr.ecr.ap-northeast-1.amazonaws.com/persk-app`

## デプロイメント方法

### 方法1: 自動化スクリプトを使用（推奨）

```bash
# 最新バージョンでデプロイ
./deploy-to-ecr.sh

# 特定のバージョンでデプロイ
./deploy-to-ecr.sh v1.2.3
```

### 方法2: 手動でデプロイ

#### 1. Dockerイメージのビルド

```bash
docker build -t persk-app:latest .
```

#### 2. ECR認証

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com
```

#### 3. イメージのタグ付け

```bash
docker tag persk-app:latest 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com/persk-app:latest
docker tag persk-app:latest 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com/persk-app:v1.0.0
```

#### 4. ECRへのプッシュ

```bash
docker push 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com/persk-app:latest
docker push 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com/persk-app:v1.0.0
```

## 重要な注意事項

### 認証トークンの有効期限

- **有効期限**: 12時間
- **影響**: 12時間後にECRへのプッシュが失敗する
- **対処法**: 再デプロイ時は認証を再実行する必要がある

### 運用上の考慮事項

1. **定期的な再認証**: 12時間ごとに認証トークンを更新
2. **バージョン管理**: セマンティックバージョニングの使用を推奨
3. **セキュリティ**: 本番環境では適切なIAM権限を設定
4. **コスト最適化**: 不要なイメージの定期削除を検討

## トラブルシューティング

### 認証エラー

```bash
# エラー: "no basic auth credentials"
# 解決策: ECR認証を再実行
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 808834313692.dkr.ecr.ap-northeast-1.amazonaws.com
```

### 権限エラー

```bash
# エラー: "AccessDenied"
# 解決策: IAM権限を確認
aws iam list-attached-user-policies --user-name persk-deployment
```

### リポジトリが存在しない

```bash
# エラー: "Repository does not exist"
# 解決策: ECRリポジトリを作成
aws ecr create-repository --repository-name persk-app --region ap-northeast-1
```

## イメージの確認

### プッシュされたイメージの一覧

```bash
aws ecr list-images --repository-name persk-app --region ap-northeast-1
```

### イメージの詳細情報

```bash
aws ecr describe-images --repository-name persk-app --region ap-northeast-1
```

## CI/CD統合

### GitHub Actions での使用例

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ap-northeast-1

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v1

- name: Build, tag, and push image to Amazon ECR
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    ECR_REPOSITORY: persk-app
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
```

## セキュリティベストプラクティス

1. **最小権限の原則**: 必要最小限のIAM権限のみを付与
2. **イメージスキャン**: 脆弱性スキャンの有効化を検討
3. **アクセスログ**: CloudTrailでのアクセス監視
4. **暗号化**: 保存時と転送時の暗号化を確認

## コスト最適化

1. **ライフサイクルポリシー**: 古いイメージの自動削除
2. **イメージサイズ**: マルチステージビルドによるサイズ削減
3. **使用量監視**: CloudWatchでの使用量監視
