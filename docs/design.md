# 設計メモ（MVP）

仕様書（[`docs/spec.md`](spec.md)）をもとに、実装前に合意した設計判断と、実装中・動作確認後に決めたことをまとめたものです。
仕様書と食い違う場合は、このファイルの記載を優先します（合意済みの変更点のため）。

## 1. 仕様書からの変更・確定事項

| 項目 | 決定内容 |
|---|---|
| 採用担当者への受け渡し | 応募者が自分でPDFとCSVをダウンロードし、自分で採用担当者に送る。システムからは送信しない |
| PDFのみ届いた場合 | 採用担当者がこのシステムの取り込み画面にPDFを読み込ませてCSVを得る（下記「4. PDF取り込み」） |
| 広告 | 別オリジンのページを `<iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox">` で表示する（`allow-same-origin` は付けない）。トップページだけに表示し、入力画面には表示しない。広告のURL（`VITE_AD_URL`）を設定しなければ広告枠は出さない |
| JSON・CSVの生成 | ブラウザ内で生成する。サーバーには送らない |
| PDFの生成 | **既定ではブラウザ内で生成する**（GitHub Pages で公開するため。仕様書7.4「サーバーサイドで実施」から変更）。サーバー（Lambda）で生成する AWS 構成も残し、ビルド時の設定（`VITE_PDF_API`）で選べる |
| 公開する場所 | 既定は GitHub Pages（https://cv.code4hachioji.org/ ）。AWS 構成（CloudFront + Lambda、仕様書第10章）も `infra/` で引き続きデプロイできる |
| 公開APIの悪用対策（AWS 構成） | Lambdaで `Origin` ヘッダーを照合する。API Gatewayのスロットリング、リクエストサイズ（64KB）と行数（各30件）の上限も設ける |
| 職歴の部署・役職 | `department` と `position` の2項目に分ける（JSONに合わせる） |
| 年齢 | 入力項目にしない。「履歴書の日付」を基準に自動計算してPDF・CSVに出力する |
| 履歴書の日付 | `createdAt`（○年○月○日現在）を追加する。初期値は当日で、確認画面で変更できる |
| 年の表記 | MVPでは西暦。JSONは西暦の数値で持つ |
| 途中保存 | LocalStorageは使わない。「入力データを保存（JSON）」でファイルとして保存し、「JSONから再開」で読み込む |
| 学歴・職歴の対の行 | 学歴で「入学」を選ぶと「卒業」の行を、職歴で「入社」を選ぶと「退職」の行を、すぐ下に自動で追加する（下記「11. 入力の補助」） |
| 現在に至る | 職歴の最後の行が「入社」なら在職中とみなし、PDFと確認画面に「現在に至る」と記載する。JSONに項目は追加しない |
| 第20章の誤記 | 「他人事システム」は「人事システム」と読み替える |

## 2. CSVの仕様

- 文字コード：BOM付きUTF-8
- 改行：レコード区切りはCRLF。セル内の改行はExcelの方式（値を `"` で囲み、セル内はLF）
- 1応募者 = 1行
- 列：履歴書の日付、氏名、氏名フリガナ、生年月日、年齢、郵便番号、住所、電話番号、メールアドレス、学歴、職歴、資格・免許、志望動機、自己PR、本人希望
- 学歴・職歴・資格・免許は、それぞれ1列にまとめ、1件ごとにセル内で改行する（件数で切り捨てない）。備考は（）で末尾に付ける

```csv
氏名,...,学歴,職歴,資格・免許,志望動機,...
山田太郎,...,"2015/04 ○○高等学校 入学
2018/03 ○○高等学校 卒業",...
```

- CSV Injection対策：値が `=` `+` `-` `@` タブ `CR` で始まる場合は先頭に `'` を付ける
  - 例外：電話番号の列では、`+` で始まる国際形式（数字と `+` `-` `(` `)` 空白だけの値）は入力どおり出力する。この形の値には関数や外部参照を書けないため。表示の形式は受け取った側に任せる
- 「現在に至る」はCSVには出力しない（CSVはデータとしての出力のため）
- 1件ずつ機械処理したい用途にはJSONを使う

## 3. データモデル（JSON）

仕様書第4章のJSONに、次の変更を加える。

- `personal.age` を削除する（出力時に `createdAt` と `birthDate` から計算する）
- ルートに `createdAt`（`YYYY-MM-DD`）を追加する
- `employment[].department` と `employment[].position` を分けて持つ（仕様書のJSONどおり）

スキーマは `packages/schema` に zod で定義し、ブラウザとLambdaの両方で同じ入力チェックを使う。

- 想定外の項目（画像データなど）は拒否する
- エラー文には入力値を含めない（APIのエラーレスポンスやログに個人情報が載らないようにするため）
- 文字数の上限：志望動機・自己PR 400字、本人希望 200字、学校名・会社名など 100字、備考 200字
- 行数の上限：学歴・職歴・資格・免許はそれぞれ30件

## 4. PDF取り込み（採用担当者向け）

- PDF生成時に、履歴書JSONをPDFの添付ファイル（`resume.json`）として埋め込む
- 取り込み画面では、ブラウザ内（pdf.js）で添付ファイルを取り出し、入力チェックを通してからCSVに変換する。サーバーには送信しない
- 対象はこのシステムで作成したPDFだけ。OCRは使わない。ファイルの先頭が `%PDF-` であることと、10MB以下であることを確かめる
- 埋め込まれたJSONは応募者が書き換えることもできるため、PDFの見た目と一致する保証はない。画面にその旨を記載する

## 5. リポジトリ構成

```text
cv/
├── packages/
│   ├── schema/      # 履歴書JSONのスキーマ（zod）と入力チェック。ブラウザとAPIで共用
│   ├── core/        # JSON→CSV変換、エスケープ、年齢計算、表示用の整形（ブラウザで動作）
│   ├── pdf/         # 履歴書PDFの作成（PDFKit）。ブラウザと Lambda の両方で使う
│   ├── web/         # フォーム画面とPDF取り込み画面（Vite + React + TypeScript）
│   └── api/         # Lambdaの処理: POST /api/pdf（AWS 構成のみ）とローカル用のゲートウェイ
├── infra/           # AWS CDK（TypeScript。AWS 構成のみ）
├── docker/          # Lambdaのコンテナイメージ定義
├── docker-compose.yml
├── README.md / LICENSE (MIT)
└── docs/            # 仕様書と設計メモ
```

セキュリティポリシー（脆弱性の報告方法）とコントリビューション方法は、README に記載している。

## 6. 使用技術

| 用途 | 技術 |
|---|---|
| 言語 | TypeScript（フロントもAPIも） |
| フロント | Vite + React |
| 入力チェック | zod（ブラウザとLambdaで共用） |
| PDF生成 | PDFKit（フォントのサブセット埋め込み、JSON添付）。ブラウザ版と Node.js 版の両方で同じコード（`packages/pdf`）を使う |
| PDF読み取り | pdf.js（ブラウザ。取り込み画面を開いたときだけ読み込む） |
| フォント | Noto Sans JP（SIL Open Font License 1.1）。画面用は `@fontsource/noto-sans-jp`、PDF用は `@expo-google-fonts/noto-sans-jp` を同梱し、外部のフォント配信サービスには接続しない |
| 公開 | GitHub Pages（GitHub Actions でビルドして公開）。AWS 構成は AWS CDK |
| インフラ | AWS CDK |
| テスト | Vitest（単体・結合）、Testing Library（画面の結合テスト）、CDK assertions（インフラ） |

- PDF生成は当初 pdf-lib を予定していたが、日本語フォントをサブセット化して埋め込むと文字が欠ける不具合があったため、PDFKit に変更した
- ブラウザでPDFを作るときは、Noto Sans JP Regular（TTF）を gzip で圧縮したもの（約3.3MB）を、PDFを作るときに一度だけ読み込み、ブラウザの `DecompressionStream` で展開する（展開できないブラウザでは TTF をそのまま読む、約5.7MB）。読み込む量を減らすため、ブラウザでは太字のフォントを使わない
  - WOFF2（約2.3MB）も試したが、PDFKit（fontkit）が WOFF2 から必要な文字だけを取り出せず、フォント全体が埋め込まれて PDF が約20MBになったため使わない
- 画面全体を通した確認（入力 → PDF作成 → 取り込み → CSV）は、Playwright で手動実行して確かめている。自動化したE2Eテストはリポジトリにはまだない

## 7. データの流れ

```text
【応募者】
フォーム入力（ブラウザのメモリ上のみ。LocalStorageは使わない）
  ├─ 途中保存：[入力データを保存（JSON）] → 後で [JSONから再開]
  ↓
入力チェック（ブラウザ） → 確認画面
  ↓
├─ JSON ……… ブラウザで生成（サーバー通信なし）
├─ CSV ……… ブラウザで生成（サーバー通信なし）
└─ PDF ……… 既定：ブラウザで生成（フォントを読み込むだけ。履歴書データは送信しない）
              AWS 構成：POST /api/pdf に JSON を送信（Cookie などは送らない）
                → Lambdaで再チェック → メモリ上で生成（/tmp は使わない）
                → 履歴書JSONを添付したPDFを返す → 処理終了

【採用担当者】
PDF取り込み画面でPDFを選ぶ → ブラウザ内で添付JSONを取り出す → CSVを保存
（サーバー通信なし）
```

- ダウンロードするファイル名は `resume.pdf` / `resume.csv` / `resume.json`（英数字）。日本語のファイル名は、ブラウザによっては無視されて "download" などになるため。ファイル名に個人情報は含めない
- PDFの作成処理（PDFKit、約216KB）とフォントは、「履歴書を作成する」を押したときにだけ読み込む。入力画面の重さは変わらない

## 8. API（`POST /api/pdf`、AWS 構成のみ）

| 条件 | 応答 |
|---|---|
| POST 以外 | 405 |
| `Origin` が許可リストにない、または `Origin` ヘッダーがない（許可リストが空ならすべて拒否） | 403 |
| `Content-Type` が JSON でない | 415 |
| 本文が 64KB を超える | 413 |
| JSON として読めない | 400 |
| 入力チェックに通らない | 422 と項目ごとのエラー（入力値は含まない） |
| 成功 | 200 `application/pdf`（Base64）、`Cache-Control: no-store` |

- CORS のヘッダーは返さない
- ログは決められた項目（イベント名、リクエストID、ステータス、理由、処理時間、例外の種類）だけを出力する。例外のメッセージは個人情報を含みうるため出力しない

## 9. 公開の構成

### GitHub Pages（既定）

- `main` への push で、GitHub Actions（`.github/workflows/pages.yml`）が画面をビルドして公開する。独自ドメインは `cv.code4hachioji.org`（DNS の CNAME を `mitani-litus.github.io` に向ける）
- 静的ファイルだけなので、`/form` と `/import` にも `index.html` の複製を置き、直接開けるようにしている（`404.html` も置く）
- HTTP ヘッダーを設定できないため、CSP は `<meta>` タグで設定する（`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`）。`frame-ancestors` や `X-Frame-Options`、HSTS などのヘッダーは付けられない
- 広告のURLは、リポジトリの Variables `CV_AD_URL` で設定する（CSP の `frame-src` にも加わる）

### AWS 構成

```text
CloudFront（HTTPSへのリダイレクト、セキュリティヘッダー、CSP）
 ├─ /*      → S3（非公開。OACでCloudFrontからのみ読み取り可）
 └─ /api/*  → API Gateway（HTTP API。スロットリングあり）→ Lambda（ECRのコンテナイメージ）
```

- フォームとAPIを同じCloudFrontの下に置くため同一オリジンになり、CORS設定は不要（`Access-Control-Allow-Origin` を返さない）
- Lambdaの権限はCloudWatch Logsへの書き込みのみ。Lambdaが受け付ける `Origin` は、CloudFrontのドメイン（と独自ドメイン）から自動で設定する
- API Gatewayのスロットリングは、既定で1秒あたり5件、瞬間的に10件まで
- API Gatewayのアクセスログには、本文と送信元IPを記録しない。CloudFrontのアクセスログは無効。ログの保存期間は1か月
- `/api/*` はCloudFrontでキャッシュしない。`/form` などの画面のURLは、CloudFront Functionで `index.html` を返す
- セキュリティヘッダー：CSP、HSTS（1年）、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`X-Content-Type-Options`、`Permissions-Policy`、`Cross-Origin-Opener-Policy`
- CSP：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`。広告のオリジンを指定したときだけ `frame-src` に加える
- S3バケットには画面のファイルだけを置く。スタックを削除してもバケットは残す
- Lambdaのレスポンス上限（6MB）に収まるよう、PDFはBase64で返す（通常は数十KB）

## 10. ローカル開発

- `npm run dev` だけで、GitHub Pages と同じ構成（PDFもブラウザで作る）を確認できる
- AWS 構成（PDFを Lambda で作る）は、`docker compose up --build` で次の3つを起動して確認する。AWSへの接続は不要。`web` には `VITE_PDF_API=/api/pdf` を設定している

- `web`：Viteの開発サーバー。`/api` へのリクエストは `gateway` に転送する
- `gateway`：API Gatewayの代わり。HTTPリクエストをLambdaのイベントに変換する（依存パッケージのないJavaScript 1ファイル）
- `api-lambda`：本番と同じLambdaコンテナイメージを、AWS公式の Runtime Interface Emulator で動かす。読み取り専用のファイルシステムで起動し、ファイルを書かないことを確かめる

ベースイメージは `public.ecr.aws/lambda/nodejs:22`。接続できない環境では、`LAMBDA_BASE_IMAGE=amazon/aws-lambda-nodejs:22` で Docker Hub の同じイメージを使える。Dockerを使わない場合は `npm run dev:api` と `npm run dev` で動かせる。

## 11. 入力の補助

- 全角の数字・ハイフンは半角に、フリガナのひらがなはカタカナに、入力欄を離れたときにそろえる
- **学歴**：区分で「入学」を選ぶと、すぐ下に「卒業」の行を追加する（学校名・学部を写す。年月は空）
  - すぐ下に同じ学校の卒業・中途退学・修了の行がすでにあれば追加しない
  - 中途退学などの場合は、追加された行の区分を変える
  - 入学の行の学校名・学部を変えると、対の行も合わせて変わる（対の行を自分で書き換えた場合は変えない）
- **職歴**：区分で「入社」を選ぶと、すぐ下に「退職」の行を追加する（会社名を写す）
  - 在職中なら退職の行を削除する。職歴の最後の行が「入社」なら「現在に至る」と記載する
- 行数の上限（30件）に達しているときは、行を追加しない

## 12. 画面設計

ワイヤーフレーム：<https://claude.ai/artifact/Xbkz83bhGdSQFXytUvsvmd>（デザインシステム：ブルー基本デザインシステム <https://claude.ai/artifact/GDNjhehsHephkHg5rQ9qFC>）

画面の判断事項：

- ステップは6段階（基本情報 → 学歴 → 職歴 → 資格・免許 → 志望動機など → 確認）。完了画面はステップ外
- 「次へ」ボタンは無効にしない。押したときに入力チェックを行い、画面上部のエラー一覧（各項目へのリンク付き）と各項目のエラー文で示す
- 文字数の上限：志望動機・自己PR 400字、本人希望 200字（入力欄の下に文字数を表示する）
- 各入力画面の下に「入力内容はこの端末のブラウザの中だけに保持されています」と途中保存ボタンを表示する
- スマートフォン（幅640px未満）では、ステップ表示を簡略版にし、「戻る」「次へ」を画面下に固定する
  - ワイヤーフレームにあった「学歴などを入力中の1件以外は要約表示に畳む」は実装していない（すべての行を開いて表示する）
- 装飾用の区切り線（`#e6e6e6`）はデザインシステムに未登録。`divider` トークンとして追加を検討する
- `select` はデザインシステムの「読み取り専用（点線）」のスタイルに一致してしまうため、実線に打ち消している

### PDFの様式

A4縦・2ページの固定様式（厚生労働省の履歴書様式例などを参考にした構成）。

| ページ | 内容 |
|---|---|
| 1 | 表題・日付、フリガナ・氏名、生年月日（満○歳）、現住所、電話・メール、学歴・職歴（21行） |
| 2 | 学歴・職歴の続き（5行）、免許・資格（5行）、志望動機、自己PR、本人希望記入欄 |

- 枠の大きさと位置は入力内容によらず同じ。表の空いた行も罫線を引いて残す
- 志望動機と自己PRは別々の枠にする（入力画面とCSVに合わせる）
- 文章が枠に収まらないときは、文字を10.5ptから8ptまで小さくする（志望動機・自己PRは上限の400字でも収まる）
- それでも収まらない場合（改行がとても多いなど）や、表の行が足りない場合だけ、枠に「別紙のとおり」と書いて、3ページ目以降の「別紙」に続きを記載する。データは切り捨てない
- 長い本文は表の次の行に折り返す。句読点や閉じ括弧は行頭に置かない
- 仕様により、顔写真欄・性別欄は設けない。入力項目にない連絡先欄も設けない
- PDFの文書情報（タイトルなど）には個人情報を入れない（タイトルは「履歴書」）
- ブラウザで作るときは太字のフォントを読み込まないため、表題「履 歴 書」も通常の太さになる（AWS 構成では太字）

## 13. 残っている課題

- **GitHub Pages のヘッダー**：`frame-ancestors`・`X-Frame-Options` を設定できないため、ほかのサイトの画面に埋め込まれる可能性がある。このサービスには送信やログインなどの操作がないため、影響は小さいと判断している
- **API Gatewayの既定URL（execute-api、AWS 構成）**：CloudFrontを通さず直接呼び出せる。ブラウザからは `Origin` の照合で、大量の呼び出しはスロットリングで抑えている。より厳しくする場合は、CloudFrontから秘密のヘッダーを付けてLambdaで照合するか、AWS WAFを追加する（現時点では対応しないと決定）
- **npm audit**：`aws-cdk-lib` が内部に同梱している `brace-expansion` に「high」が1件出る。デプロイ時だけ使う開発用のツールで、公開する画面やAPIには含まれないため、`aws-cdk-lib` の更新を待つ（決定済み）
- **実際のAWSへのデプロイ**：未確認（既定の公開先は GitHub Pages に変更）。AWS 構成でデプロイする場合は、READMEの「データが残らないことの確認」の手順でCloudWatch Logsを確認する
- **自動化したE2Eテスト**：未作成（手動のPlaywrightでの確認のみ）
- **脆弱性の非公開報告**：READMEでは GitHub の「Report a vulnerability」から報告するよう案内している。リポジトリの設定で Private vulnerability reporting を有効にする必要がある
