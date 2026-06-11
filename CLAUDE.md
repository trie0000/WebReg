# permreg — プロジェクト規約

## 機密・公開ポリシー(最重要・厳守)

外部組織に関する固有情報を、コード・コメント・コミットメッセージ・ドキュメント・配布物に一切書かないこと。

- 委託先/取引先/顧客の組織名・サービス名・製品名・コードネームを書かない
- 実在の SharePoint テナント URL(`xxx.sharepoint.com/...`)、サイトURL、人名、メールアドレスを書かない
- URL・テナント名等はプレースホルダ(`YOUR-TENANT.sharepoint.com` 等)か実行時のユーザー入力で扱う
- API キー等の秘密情報をコード/リポジトリに置かない
- コミットメッセージにも固有名を書かない(履歴に残るため)

## 構成

- `src/main.js` — bookmarklet 本体(単一ファイル・IIFE・プレーンJS)
- `build.js` — `npm run build` で `dist/app.js`(素のまま) / `dist/bookmarklet.txt` / `dist/install.html` を生成
- `test/harness.html` — SharePoint REST をメモリ上でモックして UI を確認するハーネス(`dist/app.js` を読み込む)

## 規約

- SharePoint REST は `odata=nometadata` で統一(`__metadata` 不要のため)
- リスト列の内部名は英語(`SortOrder` 等)で作成し、表示名だけ日本語に変更する方式
- UI 文言は日本語
