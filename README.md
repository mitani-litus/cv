# cv — 履歴書データ化

履歴書をWebフォームで入力し、履歴書PDF・CSV・JSONを作成するオープンソースソフトウェアです。
入力した履歴書情報は、原則としてサーバーに保存しません。

- 仕様書: [`docs/spec.md`](docs/spec.md)
- 設計メモ: [`docs/design.md`](docs/design.md)

> MVP（最小限の機能）の段階です。実際の AWS 環境へのデプロイでの動作確認は、これから行います。

## できること

- **応募者**：Webフォーム（6つのステップ）で履歴書を入力し、履歴書PDF・CSV・JSONを保存する。作成したファイルは、応募者が自分で採用担当者に送る
- **採用担当者**：PDFだけが届いた場合に、このサービスで作成したPDFを読み込んでCSVを作る
- 入力途中のデータはJSONファイルとして保存し、後で続きから入力できる
- 顔写真・性別欄は扱わない。アカウント登録は不要

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

## データの取り扱い（データ保存ポリシー）

このサービスは「履歴書をデータ化するが、履歴書データを保有しない」ことを原則にしています。

- 入力中のデータは、ブラウザのメモリの中だけに置きます。LocalStorage・Cookie・URL には保存しません。
- CSV・JSON の作成と、PDF の取り込みは、ブラウザの中だけで行います。サーバーには送りません。
- サーバーに履歴書データを送るのは、PDF を作成するときだけです。サーバーではメモリ上で PDF を作って返し、保存しません（データベースはありません）。
- ログに個人情報は出力しません。エラーの応答にも入力値を含めません。
- 入力内容を広告に利用することはありません。広告は別のオリジンのページを sandbox 付きの iframe で表示し、入力画面には表示しません。

詳しくは [`docs/design.md`](docs/design.md) を参照してください。

## セキュリティ

### 脆弱性の報告

脆弱性を見つけた場合は、**公開の Issue には書かず**、GitHub の「Security」タブにある「Report a vulnerability」から非公開で報告してください。報告には、再現手順と影響の範囲を書いてください。実在する人の個人情報は含めないでください。

### 主な対策

- 通信はすべて HTTPS です（CloudFront で HTTP から HTTPS へリダイレクトし、HSTS を設定）。
- Content Security Policy で、読み込めるスクリプトや通信先を自分のサイトだけに限っています。ほかのサイトの画面に埋め込むこともできません。
- PDF 生成 API は、自分のサイトからの呼び出し（`Origin` を照合）だけを受け付け、CORS は設定していません。大量の呼び出しは、API Gateway のスロットリングで抑えます。
- 入力チェックは、ブラウザと API の両方で同じ規則で行います。想定外の項目（画像データなど）は拒否します。
- CSV では、Excel などで数式として扱われないよう、先頭が `=` `+` `-` `@` などの値を無害化します（CSV Injection 対策）。
- Lambda の権限は、ログの書き込みだけです。

既知の課題は [`docs/design.md`](docs/design.md) の「13. 残っている課題」にまとめています。

## コントリビューション

Issue・プルリクエストを歓迎します。

### 方針

このプロジェクトは、仕様書（[`docs/spec.md`](docs/spec.md)）の第22章の原則に沿って開発しています。特に次のような変更は受け付けません。

- 履歴書データをサーバーやブラウザに保存する仕組み（データベース、LocalStorage など）
- 顔写真、認証、採用管理の機能
- AI による文章生成や、外部の AI サービスへ履歴書データを送る機能
- ログやエラーの応答に個人情報が含まれる変更

判断に迷う場合は、「データを保存しない」「機能を増やさない」方向を優先します。大きな変更は、先に Issue で相談してください。

### 手順

1. リポジトリをフォークし、ブランチを作成する
2. 変更を加え、`npm run check`（型チェックとテスト）が通ることを確かめる
3. 画面やPDFに関わる変更は、`docker compose up --build` で動作を確かめる
4. プルリクエストを作成する。何を変えたか、なぜ変えたか、どう確かめたかを書く

Issue・プルリクエスト・テストデータには、**実在する人の個人情報を含めないでください**（「山田 太郎」「taro@example.jp」などの架空のデータを使ってください）。

プルリクエストのコードは、このリポジトリと同じ MIT License で公開されます。

## ライセンス

[MIT License](LICENSE)

画面のスタイル（`packages/web/src/styles/design-system.css`）は、デジタル庁デザインシステムの公式HTMLサンプル（MIT License, © 2023 デジタル庁）をもとにしています。フォントは Noto Sans JP（SIL Open Font License 1.1）を同梱しています（画面用は `@fontsource/noto-sans-jp`、PDF用は `@expo-google-fonts/noto-sans-jp`）。
