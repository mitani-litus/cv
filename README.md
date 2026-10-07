# cv — 履歴書データ化

履歴書をWebフォームで入力し、履歴書PDF・CSV・JSONを作成するオープンソースソフトウェアです。
入力した履歴書情報は、原則としてサーバーに保存しません。

- 仕様書: [`docs/spec.md`](docs/spec.md)
- 設計メモ: [`docs/design.md`](docs/design.md)

> 開発中です。セットアップ方法やデプロイ方法は、実装の進行にあわせて追記します。

## 開発

Node.js 22 以上が必要です。

```sh
npm install
npm run dev     # 入力フォームを http://localhost:5173 で起動
npm run check   # 型チェックとテスト
npm run build   # 本番用にビルド（packages/web/dist）
```

PDFの作成（`/api/pdf`）は `packages/api` で実装予定です。それまでは、確認画面の「履歴書を作成する」はエラーになります。

| パッケージ | 内容 |
|---|---|
| `packages/schema` | 履歴書JSONのスキーマと入力チェック（ブラウザとAPIで共用） |
| `packages/core` | CSV変換、表示用の整形、年齢計算（ブラウザで動作） |
| `packages/web` | 入力フォーム、確認・完了画面、PDF取り込み画面（Vite + React） |

## ライセンス

[MIT License](LICENSE)

画面のスタイル（`packages/web/src/styles/design-system.css`）は、デジタル庁デザインシステムの公式HTMLサンプル（MIT License, © 2023 デジタル庁）をもとにしています。フォントは Noto Sans JP（SIL Open Font License 1.1）を同梱しています。
