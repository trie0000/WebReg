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
- `build.js` — `npm run build` で `dist/permreg.bundle.js`(素のまま) / `dist/version.txt` / `dist/bookmarklet.txt` / `dist/install.html` を生成(命名は全アプリ共通規約)
- `test/harness.html` — SharePoint REST をメモリ上でモックして UI を確認するハーネス(`dist/permreg.bundle.js` を読み込む)

## 規約

- SharePoint REST は `odata=nometadata` で統一(`__metadata` 不要のため)
- ⚠ 存在しない列への `fields/getbyinternalnameortitle('X')` は **404 ではなく 400 (System.ArgumentException「列 'X' が存在しません」)** を返す(実機のみ。mock では気付けない)。列の存在判定は `fields?$filter=InternalName eq 'X'` を使う
- リスト列の内部名は英語(`SortOrder` 等)で作成し、表示名だけ日本語に変更する方式
- UI 文言は日本語

## UI ルール(必読)

UI を触る前に Notion の「🎨 UI / デザインルール(全アプリ共通)」を必ず読むこと(Spira プロジェクトHUB 配下)。
本リポジトリでの適用ポイント:

- デザイントークンは Spira と同一(モスグリーン accent / paper 系 surface)。CSS 変数で `#permreg-root` に一元定義し、hex/px の直書き禁止
- SP ホスト CSS シールド: ルールの先頭で `all: initial` → `#permreg-root .pr-*` + `!important`
- アイコンは Feather 風 SVG(stroke 1.7、`.pr-btn svg` に width/height 明示)。絵文字を UI 要素に使わない
- 通知は右上トースト(ok 2秒 / warn 3秒 / error 手動 close + コピーボタン)。`alert()` 禁止
- 破壊的操作は確認モーダル経由(`confirm()` 禁止)。backdrop クローズは mousedown 起点で判定
- 「直しました」と言う前に preview + `getComputedStyle` で実ピクセル値を確認する
