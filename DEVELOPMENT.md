# WebReg 開発基準

> 目的: コードの肥大化・管理困難化を防ぐ。**開発前に必ずこのファイルと Notion の
> 「🎨 UI / デザインルール(全アプリ共通)」(§17〜の全アプリ共通アーキテクチャ含む)を読むこと。**

## 1. モジュール構成(責務の固定)

```
src/
├── config.js / i18n.js  定数・localStorage キー・ビルド識別子 / 英語版の対訳(状態を持たない)
├── sp.js           SharePoint REST クライアント(fetch はここ以外に書かない。全件取得 spGetAll)
├── schema.js       マスタリストのスキーマと冪等セットアップ
├── usersync.js     「リストへ反映」: マスタ → 利用者一覧の列・選択肢・集計式・改廃ステータス列
├── perms.js        行レベル権限(組織区分1ごとのグループ割当・適用)
├── enlist.js       英語版利用者リストの生成と差分転記(SourceId 突合・行権限)
├── syncstate.js    未反映の変更の検知・破棄
├── icons.js        Feather 風 SVG アイコン
├── styles.js       デザイントークン + 基盤 CSS(トークン定義はここだけ)
├── stylesviews.js  画面別のコンポーネント CSS(styles.js の後ろに連結)
├── ui.js / grid.js / gridfilter.js  UI 基盤部品(el/esc/toast/modal)/ 表の列幅・列順 / 列フィルター
├── usersview.js / userform.js / reqview.js / compare.js / help.js / masterview.js  各画面の HTML と表操作
├── audit.js / backup.js / settings.js / importcsv.js / xlsx.js / xlsxflow.js  操作ログ・バックアップ・設定・取込/出力
├── updater.js      自動更新(version.txt 監視 → 更新モーダル → 再読込)
├── appcore.js      アプリの state・データ読込・直列実行(run)・ステータス表示
├── userflows.js / ioflows.js / masteractions.js  各操作のフロー(利用者 / 取込・出力・バックアップ / マスタ)
├── main.js         エントリ: 画面の器・描画・イベント振り分け・起動
└── loader.js       ローダ(bookmarklet 本体。バンドルに含めない)
```

- **委託先で npm/Node が使えないため、ビルドは「連結方式」**: src は import/export を使わず、
  build.py の `ORDER` に書いた順に連結すると1つの IIFE として動く形で書く。
  そのため**トップレベルの宣言名はファイル間で一意**にすること(連結後は同一スコープ)
- **新しい責務は新しいファイル**にする(main.js に足し続けない)。ファイルを増やしたら
  build.py の `ORDER` に依存順で追加する
- 依存方向は一方向のみ: `main → (flows) → appcore → (views|ui|updater|sync系|schema) → (sp|icons|styles|config)`。逆流禁止
  (appcore から main の描画は bindAppShell で受け取った関数経由で呼ぶ)

## 2. サイズ上限(超えたら分割・棚卸し)

| 対象 | 目標 | 上限 |
|---|---|---|
| 1ファイル | 300行 | 500行 |
| 1関数 | 40行 | 80行 |
| bundle (minify後) | 100KB | 200KB |
| loader (minify後) | 2KB | 8KB |

> bundle 上限は当初 150KB だったが、依存ポリシー(外部 OSS 禁止)により
> xlsx 読み書き等を自前実装しているため 2026-06 に 200KB へ改定。

- 上限超過に気付いたら**その変更の中で**分割する(「あとで」は禁止)
- bundle サイズは `python3 build.py` の出力で毎回確認する(バイト数 = 配信サイズと文字数の両方を出す。
  上限はバイト数で見る。日本語は UTF-8 で 3 バイト)

## 3. 依存ポリシー

- ランタイム依存は**原則ゼロ**(ブラウザ標準 API のみ)
- **ビルドも Python 3.8+ の標準ライブラリのみ**(npm / Node / pip / esbuild 不要 — 委託先環境の制約)。
  minify はコメント・インデント・空行除去の軽量実装(build.py 内)。識別子短縮はしない
- **外部動的モジュールのインポートは原則禁止**。CDN からの `import()` / `<script src>` /
  `fetch→eval` など、**実行時に外部から取得するコード**を bundle に持ち込まない
  (許されるのは自前配信の bundle/loader 自身のみ)。理由: 供給元の改変・消失が
  そのまま本番障害・サプライチェーンリスクになり、SP 環境では CSP/プロキシでも壊れる
- **OSS を利用するときは事前に承認を取る**(勝手に追加しない)。承認後、README に
  「ライブラリ名・ライセンス・何のため・代替案・サイズ影響」を記録し、
  bundle に**ビルド時に同梱**する(動的読込にしない)

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

- `python3 build.py` → dist/ に一括生成。命名は `webreg.bundle.js` / `version.txt` /
  `webreg.loader.js` / `bookmarklet.txt` / `install-loader.html` / `install.html`
- 版識別子は `<ver>-<srcSha8>`(buildTime・dirty マーカーを**含めない** — 更新誤検知防止)。
  ベース版数は `VERSION` ファイルで管理(semver)
- 配布先は SP の `ドキュメント/webreg/`。開発中は `python3 dev/serve.py`(127.0.0.1:18086、
  CORS付き、全リクエスト1行ログ)+ アプリ内「設定 → 開発者モード」でローカル参照
- 起動中の自動更新は updater.js(読込元の version.txt を監視 → 更新モーダル → その場で再読込)。
  webreg は共通規約 §17 の「トースト案内」ではなく**更新モーダル**を採用(ユーザー指定)。
  `__webregSource` は bundle 実行**前**に設定する(後だと初回起動で監視が無効になる)
- semver: バグ修正=PATCH / 後方互換の機能追加=MINOR / 破壊的変更=MAJOR(VERSION ファイル)

## 7. コミット規律

- 1機能(または1修正)=1コミット。`feat:` `fix:` `style:` `docs:` プレフィックス
- **外部組織の固有情報をコード・コミットに書かない**(CLAUDE.md の機密ポリシー)
- dist/ もコミットする(配布物の追跡のため)

## 8. データ・スキーマの不変条件

- リスト列の内部名は英語、表示名のみ日本語。既存列の**内部名は変更しない**(参照が壊れる)
- セットアップ処理は常に**冪等**(何度実行しても安全)に保つ
- 行削除より無効化(Active=false)を優先する設計(参照整合性のため)。削除は子なしのみ
