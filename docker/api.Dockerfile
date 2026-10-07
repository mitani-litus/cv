# PDF生成API の Lambda コンテナイメージ。
# 本番（AWS Lambda）とローカル（docker compose）で同じイメージを使う。
# ビルド: docker build -f docker/api.Dockerfile -t cv-api .
#
# ベースイメージは AWS 公式の Lambda 用イメージ。public.ecr.aws に接続できない環境では、
# 同じものが Docker Hub にもある（--build-arg LAMBDA_BASE_IMAGE=amazon/aws-lambda-nodejs:22）。
ARG LAMBDA_BASE_IMAGE=public.ecr.aws/lambda/nodejs:22

FROM node:22-slim AS build
WORKDIR /app
# 依存関係だけ先にインストールして、キャッシュを効かせる
COPY package.json package-lock.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/core/package.json packages/core/
COPY packages/pdf/package.json packages/pdf/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN npm ci --workspace @cv/api --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/schema packages/schema
COPY packages/core packages/core
COPY packages/pdf packages/pdf
COPY packages/api packages/api
RUN npm run build -w @cv/api

FROM ${LAMBDA_BASE_IMAGE}
# ソースを1つにまとめた index.js と、フォント・PDFKit の補助データだけを置く（読み取り専用）
COPY --from=build /app/packages/api/dist/ ${LAMBDA_TASK_ROOT}/
ENV FONT_DIR=/var/task/fonts \
    NODE_ENV=production
CMD ["index.handler"]
