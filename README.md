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
npm run check   # 型チェックとテスト
```

| パッケージ | 内容 |
|---|---|
| `packages/schema` | 履歴書JSONのスキーマと入力チェック（ブラウザとAPIで共用） |

## ライセンス

[MIT License](LICENSE)
