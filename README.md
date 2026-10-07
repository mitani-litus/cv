# cv — 履歴書データ化

履歴書をWebフォームで入力し、履歴書PDF・CSV・JSONを作成するオープンソースソフトウェアです。
入力した履歴書情報は、原則としてサーバーに保存しません。

- 仕様書: [`docs/spec.md`](docs/spec.md)
- 設計メモ: [`docs/design.md`](docs/design.md)

> 開発中です。セットアップ方法やデプロイ方法は、実装の進行にあわせて追記します。

## ローカルで動かす

AWS に接続しなくても、入力フォームからPDF・CSV・JSONの作成、PDFの取り込みまで確認できます。

### Docker で動かす（本番と同じ Lambda イメージを使う）

```sh
docker compose up --build
```

http://localhost:5173 を開きます。PDF生成APIは、本番と同じ Lambda コンテナイメージを AWS 公式の Runtime Interface Emulator で動かしています（読み取り専用のファイルシステムで起動）。

`public.ecr.aws` に接続できない環境では、Docker Hub にある同じイメージを使えます。

```sh
LAMBDA_BASE_IMAGE=amazon/aws-lambda-nodejs:22 docker compose up --build
```

### Node.js だけで動かす

Node.js 22 以上が必要です。

```sh
npm install
npm run dev:api   # PDF生成API（http://localhost:9000）
npm run dev       # 入力フォーム（http://localhost:5173）。/api は 9000 番に転送
```

### 開発用のコマンド

```sh
npm run check   # 型チェックとテスト
npm run build   # 本番用にビルド（packages/web/dist、packages/api/dist）
```

| パッケージ | 内容 |
|---|---|
| `packages/schema` | 履歴書JSONのスキーマと入力チェック（ブラウザとAPIで共用） |
| `packages/core` | CSV変換、表示用の整形、年齢計算（ブラウザで動作） |
| `packages/web` | 入力フォーム、確認・完了画面、PDF取り込み画面（Vite + React） |
| `packages/api` | PDF生成API（AWS Lambda、PDFKit）。履歴書JSONをPDFに添付する |

## AWS へのデプロイ

AWS CDK（`infra/`）で、次の構成を作成します。履歴書データを保存するデータベースやストレージは作りません。

```text
CloudFront（HTTPS、セキュリティヘッダー、CSP）
 ├─ /*      → S3（非公開。CloudFront からだけ読める。画面のファイルだけを置く）
 └─ /api/*  → API Gateway（HTTP API、スロットリング）→ Lambda（コンテナイメージ、ECR）
```

### 必要なもの

- AWS アカウントと、デプロイできる権限を持つ認証情報（`aws configure` など）
- Docker（Lambda のコンテナイメージをビルドするため。Windows / macOS は Docker Desktop）
- Node.js 22 以上

### 手順

```sh
npm ci
npm run cdk -w @cv/infra -- bootstrap   # 初回だけ（アカウントとリージョンごと）
npm run deploy                   # 画面とAPIをビルドしてデプロイ
```

完了すると `SiteUrl`（CloudFront のURL）が表示されます。リージョンの既定は東京（`ap-northeast-1`）です。

### 設定（任意）

`cdk deploy` に `-c 名前=値` で渡します（例：`npm run build && npm run cdk -w @cv/infra -- deploy -c domainName=cv.example.jp -c certificateArn=...`）。

| 名前 | 内容 |
|---|---|
| `domainName` / `certificateArn` | 独自ドメインと、us-east-1 の ACM 証明書。Lambda が受け付ける Origin にも加わる |
| `adOrigin` | 広告ページのオリジン（例：`https://ads.example.com`）。CSP の `frame-src` に加わる。画面側はビルド時に `VITE_AD_URL` も設定する |
| `throttleRate` / `throttleBurst` | API のスロットリング（既定：1秒あたり5件、瞬間的に10件） |
| `region` / `stackName` | リージョン（既定 `ap-northeast-1`）とスタック名（既定 `CvStack`） |

### データが残らないことの確認

- **データベース**：作成しません（`infra/test` のテストで確認しています）。
- **S3**：画面のファイルだけを置きます。PDF・CSV・JSON は置きません。
- **Lambda**：PDF はメモリ上で作り、`/tmp` を含めてファイルに書きません（ローカルでは読み取り専用のファイルシステムで動作を確認しています）。
- **ログ**：Lambda のログは決められた項目（イベント名、リクエストID、ステータス、処理時間）だけです。API Gateway のアクセスログには、本文や送信元IPを記録しません。CloudFront のアクセスログは無効です。ログの保存期間は1か月です。
- デプロイ後は、PDF を1件作ってから、CloudWatch Logs に氏名やメールアドレスが含まれていないことを確認してください（例：Logs Insights で `filter @message like /@/`）。

## ライセンス

[MIT License](LICENSE)

画面のスタイル（`packages/web/src/styles/design-system.css`）は、デジタル庁デザインシステムの公式HTMLサンプル（MIT License, © 2023 デジタル庁）をもとにしています。フォントは Noto Sans JP（SIL Open Font License 1.1）を同梱しています（画面用は `@fontsource/noto-sans-jp`、PDF用は `@expo-google-fonts/noto-sans-jp`）。
