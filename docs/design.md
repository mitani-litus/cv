# 設計メモ（MVP）

仕様書（[`docs/spec.md`](spec.md)）をもとに、実装前に合意した設計判断をまとめたものです。
仕様書と食い違う場合は、このファイルの記載を優先します（合意済みの変更点のため）。

## 1. 仕様書からの変更・確定事項

| 項目 | 決定内容 |
|---|---|
| 採用担当者への受け渡し | 応募者が自分でPDFとCSVをダウンロードし、自分で採用担当者に送る。システムからは送信しない |
| PDFのみ届いた場合 | 採用担当者がこのシステムの取り込み画面にPDFを読み込ませてCSVを得る（下記「4. PDF取り込み」） |
| 広告 | 別オリジンのページを `<iframe sandbox="allow-scripts allow-popups">` で表示する（`allow-same-origin` は付けない）。入力画面には表示しない |
| JSON・CSVの生成 | ブラウザ内で生成する。サーバーには送らない |
| PDFの生成 | サーバー（Lambda）で生成する。サーバーに履歴書データを送るのはこの処理だけ |
| 公開APIの悪用対策 | Lambdaで `Origin` ヘッダーを照合する。API Gatewayのスロットリング、リクエストサイズと行数の上限も設ける |
| 職歴の部署・役職 | `department` と `position` の2項目に分ける（JSONに合わせる） |
| 年齢 | 入力項目にしない。「履歴書の日付」を基準に自動計算してPDF・CSVに出力する |
| 履歴書の日付 | `createdAt`（○年○月○日現在）を追加する。初期値は当日で、確認画面で変更できる |
| 年の表記 | MVPでは西暦。JSONは西暦の数値で持つ |
| 途中保存 | LocalStorageは使わない。「入力データを保存（JSON）」でファイルとして保存し、「JSONから再開」で読み込む |
| 第20章の誤記 | 「他人事システム」は「人事システム」と読み替える |

## 2. CSVの仕様

- 文字コード：BOM付きUTF-8
- 改行：レコード区切りはCRLF。セル内の改行はExcelの方式（値を `"` で囲み、セル内はLF）
- 1応募者 = 1行
- 学歴・職歴・資格・免許は、それぞれ1列にまとめ、1件ごとにセル内で改行する（件数の上限なし）

```csv
氏名,...,学歴,職歴,資格・免許,志望動機,...
山田太郎,...,"2015/04 入学 ○○高等学校
2018/03 卒業 ○○高等学校",...
```

- CSV Injection対策：値が `=` `+` `-` `@` タブ `CR` で始まる場合は先頭に `'` を付ける
- 1件ずつ機械処理したい用途にはJSONを使う

## 3. データモデル（JSON）

仕様書第4章のJSONに、次の変更を加える。

- `personal.age` を削除する（出力時に `createdAt` と `birthDate` から計算する）
- ルートに `createdAt`（`YYYY-MM-DD`）を追加する
- `employment[].department` と `employment[].position` を分けて持つ（仕様書のJSONどおり）

スキーマは `packages/schema` に zod で定義し、ブラウザとLambdaの両方で同じ入力チェックを使う。

## 4. PDF取り込み（採用担当者向け）

- PDF生成時に、履歴書JSONをPDFの添付ファイルとして埋め込む
- 取り込み画面では、ブラウザ内（pdf.js）で添付ファイルを取り出してCSVに変換する。サーバーには送信しない
- 対象はこのシステムで作成したPDFだけ。OCRは使わない
- 埋め込まれたJSONは応募者が書き換えることもできるため、PDFの見た目と一致する保証はない。画面とREADMEにその旨を記載する

## 5. リポジトリ構成

```text
cv/
├── packages/
│   ├── schema/      # 履歴書JSONのスキーマ（zod）と入力チェック。ブラウザとAPIで共用
│   ├── core/        # JSON→CSV変換、エスケープ、年齢計算（ブラウザで動作）
│   ├── web/         # フォーム画面とPDF取り込み画面（Vite + React + TypeScript）
│   └── api/         # Lambdaの処理: POST /api/pdf（PDF生成のみ）
├── infra/           # AWS CDK（TypeScript）
├── docker/          # Lambdaのコンテナイメージ定義
├── docker-compose.yml
├── README.md / SECURITY.md / CONTRIBUTING.md / LICENSE (MIT)
└── docs/            # 仕様書と設計メモ
```

## 6. 使用技術

| 用途 | 技術 |
|---|---|
| 言語 | TypeScript（フロントもAPIも） |
| フロント | Vite + React |
| 入力チェック | zod（ブラウザとLambdaで共用） |
| PDF生成 | pdf-lib + fontkit（フォントのサブセット埋め込み、JSON添付） |
| PDF読み取り | pdf.js（ブラウザ） |
| フォント | Noto Sans JP（SIL Open Font License） |
| インフラ | AWS CDK |
| テスト | Vitest（単体）、Playwright（E2E） |

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
└─ PDF ……… POST /api/pdf に JSON を送信
              → Lambdaで再チェック → メモリ上で生成（/tmp は使わない）
              → 履歴書JSONを添付したPDFを返す → 処理終了

【採用担当者】
PDF取り込み画面でPDFを選ぶ → ブラウザ内で添付JSONを取り出す → CSVを保存
（サーバー通信なし）
```

## 8. AWS構成

```text
CloudFront（HTTPSへのリダイレクト、セキュリティヘッダー、CSP）
 ├─ /*      → S3（非公開。CloudFrontからのみ読み取り可）
 └─ /api/*  → API Gateway（HTTP API。スロットリングあり）→ Lambda（ECRのコンテナイメージ）
```

- フォームとAPIを同じCloudFrontの下に置くため同一オリジンになり、CORS設定は不要（`Access-Control-Allow-Origin` を返さない）
- Lambdaの権限はCloudWatch Logsへの書き込みのみ
- API Gatewayのアクセスログにはリクエスト・レスポンスの本文を記録しない
- Lambdaのレスポンス上限（6MB）に収まるよう、PDFはBase64で返す
- Lambdaでは `Origin` の照合、リクエストサイズと行数の上限、画像データの拒否を行う

## 9. ローカル開発

`docker compose up` で次の2つを起動する。AWSへの接続は不要。

- `web`：Viteの開発サーバー。`/api` へのリクエストは `api` に転送する
- `api`：本番と同じLambdaコンテナイメージを、AWS公式の Runtime Interface Emulator で動かす

## 10. 画面設計

ワイヤーフレーム：<https://claude.ai/artifact/Xbkz83bhGdSQFXytUvsvmd>（デザインシステム：ブルー基本デザインシステム <https://claude.ai/artifact/GDNjhehsHephkHg5rQ9qFC>）

画面の判断事項：

- ステップは6段階（基本情報 → 学歴 → 職歴 → 資格・免許 → 志望動機など → 確認）。完了画面はステップ外
- 「次へ」ボタンは無効にしない。押したときに入力チェックを行い、画面上部のエラー一覧と各項目のエラー文で示す
- 文字数の上限（仮）：志望動機・自己PR 400字、本人希望 200字
- 各入力画面の下に「入力内容はこの端末のブラウザの中だけに保持されています」と途中保存ボタンを表示する
- スマートフォンでは「戻る」「次へ」を画面下に固定し、学歴などは入力中の1件以外を要約表示に畳む
- 装飾用の区切り線（`#e6e6e6`）はデザインシステムに未登録。`divider` トークンとして追加を検討する
