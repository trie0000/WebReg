# permreg 開発基準

> 目的: コードの肥大化・管理困難化を防ぐ。**開発前に必ずこのファイルと Notion の
> 「🎨 UI / デザインルール(全アプリ共通)」(§17〜の全アプリ共通アーキテクチャ含む)を読むこと。**

## 1. モジュール構成(責務の固定)

```
src/
├── config.js   定数・localStorage キー・ビルド識別子(状態を持たない)
├── sp.js       SharePoint REST クライアント(fetch はここ以外に書かない)
├── schema.js   リスト/列スキーマ定義と冪等セットアップ
├── icons.js    Feather 風 SVG アイコン
├── styles.js   デザイントークン + 全 CSS(トークン定義はここだけ)
├── ui.js       UI 基盤部品(el/esc/toast/modal)
├── main.js     エントリ: state・ビュー・イベント・起動
└── loader.js   ローダ(bookmarklet 本体。バンドルに含めない)
```

- **新しい責務は新しいファイル**にする(main.js に足し続けない)。ビューが増えて main.js が
  上限を超えたら `views/` ディレクトリに分割する
- 依存方向は一方向のみ: `main → (schema|ui|views) → (sp|icons|styles|config)`。逆流禁止

## 2. サイズ上限(超えたら分割・棚卸し)

| 対象 | 目標 | 上限 |
|---|---|---|
| 1ファイル | 300行 | 500行 |
| 1関数 | 40行 | 80行 |
| bundle (minify後) | 50KB | 150KB |
| loader (minify後) | 2KB | 8KB |

- 上限超過に気付いたら**その変更の中で**分割する(「あとで」は禁止)
- bundle サイズは `npm run build` の出力で毎回確認する

## 3. 依存ポリシー

- ランタイム依存は**原則ゼロ**(ブラウザ標準 API のみ)。devDependencies は esbuild のみ
- 依存を増やすときは README に「何のため・代替案・サイズ影響」を記録してから

## 4. 機能追加の手順(フェーズ規律)

1. README のロードマップに**フェーズとして記載してから**着手(勝手に機能を生やさない。
   聞かれていない機能の提案は原因調査と混ぜない — Notion §15.6)
2. UI は Notion「UI/デザインルール」準拠(トークン直書き禁止 / toast・modal 必須 / 絵文字アイコン禁止)
3. REST 追加は sp.js / schema.js 経由のみ

## 5. テスト基準

- 変更のたびに **test/harness.html**(REST モック)で回帰: セットアップ → 追加 → 並べ替え →
  名称変更 → 子ありガード → 削除 → 設定保存
- モックは**実機の挙動に合わせて更新**する(例: 存在しない列の getbyinternalnameortitle は
  404 でなく 400 — mock が甘いと実機バグを素通りさせる)
- **スキーマ(リスト/列)を触る変更は SP 実機での確認必須**。UI 変更は preview +
  `getComputedStyle` の実値確認(Notion §0 チェックリスト)
- 「直しました」と言う前に §0 チェックリストをクリアする

## 6. ビルド・配布(全アプリ共通 §17 準拠)

- `npm run build` → dist/ に一括生成。命名は `permreg.bundle.js` / `version.txt` /
  `permreg.loader.js` / `bookmarklet.txt` / `install-loader.html` / `install.html`
- 版識別子は `<ver>-<srcSha8>`(buildTime・dirty マーカーを**含めない** — 更新誤検知防止)
- 配布先は SP の `ドキュメント/permreg/`。開発中は `npm run dev`(127.0.0.1:18086、CORS付き、
  全リクエスト1行ログ)+ アプリ内「設定 → 開発者モード」でローカル参照
- semver: バグ修正=PATCH / 後方互換の機能追加=MINOR / 破壊的変更=MAJOR(package.json の version)

## 7. コミット規律

- 1機能(または1修正)=1コミット。`feat:` `fix:` `style:` `docs:` プレフィックス
- **外部組織の固有情報をコード・コミットに書かない**(CLAUDE.md の機密ポリシー)
- dist/ もコミットする(配布物の追跡のため)

## 8. データ・スキーマの不変条件

- リスト列の内部名は英語、表示名のみ日本語。既存列の**内部名は変更しない**(参照が壊れる)
- セットアップ処理は常に**冪等**(何度実行しても安全)に保つ
- 行削除より無効化(Active=false)を優先する設計(参照整合性のため)。削除は子なしのみ
