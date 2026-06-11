// デザイントークン + コンポーネント CSS。トークンは Spira 共通(Notion「UI/デザインルール」準拠)
// SP ホスト CSS シールド: ルール先頭の all:initial + ID セレクタ + !important

const css = `
#${ROOT_ID}{
  /* SP host CSS シールド。後続宣言と custom property は all の対象外/上書きで生き残る */
  all: initial;
  /* ---- design tokens (Spira 共通) ---- */
  --ink:#2a2a26; --ink-3:#7a766c; --ink-4:#a8a39a;
  --paper:#fafaf7; --paper-2:#f3f1ea; --paper-2-strong:#ece8de; --paper-3:#e8e4d8;
  --line:rgba(42,42,38,.12); --line-strong:rgba(42,42,38,.18);
  --accent:#7a8a78; --accent-soft:rgba(122,138,120,.18); --accent-strong:#5e6f5c;
  --danger:#b8534a; --danger-soft:rgba(184,83,74,.10); --warn:#c47f1c; --ok:#2f6f5e;
  --badge-new:#3b82f6; --badge-upd:#f59e0b;
  --font-sans:"Meiryo","メイリオ","Hiragino Sans","Yu Gothic UI",-apple-system,"Segoe UI",system-ui,sans-serif;
  --font-mono:ui-monospace,"Cascadia Mono","Consolas",monospace;
  --fs-xs:11px; --fs-sm:12px; --fs-md:13px; --fs-base:15px; --fs-lg:16px; --fs-xl:18px;
  --lh-base:1.75; --lh-tight:1.35;
  --s-1:4px; --s-2:6px; --s-3:8px; --s-4:10px; --s-5:12px;
  --s-6:14px; --s-7:18px; --s-8:22px; --s-9:28px; --s-10:40px;
  --gutter:24px;
  --r-2:4px; --r-3:6px;
  --shadow-panel:0 8px 20px rgba(42,42,38,.10);
  --shadow-modal:0 0 0 1px rgba(42,42,38,.06),0 4px 12px rgba(42,42,38,.10),0 16px 40px rgba(42,42,38,.18);
  --topbar-h:44px;
}
#${ROOT_ID}{
  position:fixed; inset:0; width:100vw; height:100vh;
  z-index:2147483600; display:flex; flex-direction:column;
  font-family:var(--font-sans); font-size:var(--fs-md); line-height:var(--lh-base);
  color:var(--ink); background:var(--paper);
  /* all:initial の user-select:auto は SP host の none を継承してコピー不可になるため明示 */
  -webkit-user-select:text; user-select:text;
}
#${ROOT_ID} *, #${ROOT_ID} *::before, #${ROOT_ID} *::after{ box-sizing:border-box; }
#${ROOT_ID} svg{ width:16px; height:16px; flex:none; }
@media (prefers-reduced-motion: reduce){
  #${ROOT_ID} *{ animation-duration:.01ms !important; transition-duration:.01ms !important; }
}

/* ---- topbar ---- */
#${ROOT_ID} .pr-topbar{
  display:flex; align-items:center; gap:var(--s-4); flex:none;
  height:var(--topbar-h); padding:0 var(--gutter);
  background:var(--paper-2); border-bottom:1px solid var(--line);
}
#${ROOT_ID} .pr-brand{
  width:24px; height:24px; border-radius:var(--r-2); flex:none;
  background:var(--accent); color:var(--paper);
  display:inline-flex; align-items:center; justify-content:center;
  font-weight:600; font-size:12px; letter-spacing:0;
}
#${ROOT_ID} .pr-title{ font-size:var(--fs-base); font-weight:600; white-space:nowrap; }
#${ROOT_ID} .pr-title small{ font-size:var(--fs-xs); color:var(--ink-3); font-weight:400; margin-left:var(--s-2); }

/* ---- buttons (SP host シールド: ID + class + !important) ---- */
#${ROOT_ID} .pr-btn, #${ROOT_ID} .pr-btn *{
  font-family:var(--font-sans) !important; font-size:var(--fs-md) !important;
}
#${ROOT_ID} .pr-btn{
  height:34px !important; padding:0 var(--s-7) !important;
  display:inline-flex !important; align-items:center !important; justify-content:center !important;
  gap:var(--s-2) !important; border-radius:var(--r-2) !important; font-weight:500 !important;
  cursor:pointer !important; border:1px solid var(--line-strong) !important;
  background:var(--paper) !important; color:var(--ink) !important;
  white-space:nowrap !important; text-decoration:none !important;
  transition:background .1s, color .1s, border-color .1s, filter .1s !important;
}
#${ROOT_ID} .pr-btn svg{ width:16px !important; height:16px !important; flex:none !important; }
#${ROOT_ID} .pr-btn:hover{ filter:brightness(.96) !important; }
#${ROOT_ID} .pr-btn:focus-visible{ outline:2px solid var(--accent-soft) !important; outline-offset:1px !important; }
#${ROOT_ID} .pr-btn:disabled{ opacity:.5 !important; cursor:not-allowed !important; filter:none !important; }
#${ROOT_ID} .pr-btn--primary, #${ROOT_ID} .pr-btn--primary *{
  background:var(--accent) !important; color:#ffffff !important; border-color:var(--accent) !important;
}
#${ROOT_ID} .pr-btn--primary:hover{
  background:var(--accent-strong) !important; border-color:var(--accent-strong) !important; filter:none !important;
}
#${ROOT_ID} .pr-btn--secondary, #${ROOT_ID} .pr-btn--secondary *{
  background:var(--paper-2) !important; color:var(--ink) !important; border-color:var(--paper-3) !important;
}
#${ROOT_ID} .pr-btn--ghost, #${ROOT_ID} .pr-btn--ghost *{
  background:transparent !important; color:var(--ink-3) !important;
}
#${ROOT_ID} .pr-btn--ghost{ border:1px solid var(--line-strong) !important; }
#${ROOT_ID} .pr-btn--ghost:hover, #${ROOT_ID} .pr-btn--ghost:hover *{
  border-color:var(--ink-4) !important; color:var(--ink) !important; filter:none !important;
}
#${ROOT_ID} .pr-btn--danger, #${ROOT_ID} .pr-btn--danger *{
  background:transparent !important; color:var(--danger) !important;
}
#${ROOT_ID} .pr-btn--danger{ border-color:var(--danger) !important; }
#${ROOT_ID} .pr-btn--danger:hover{ background:var(--danger-soft) !important; filter:none !important; }
#${ROOT_ID} .pr-btn--sm{ height:28px !important; padding:0 var(--s-5) !important; font-size:var(--fs-sm) !important; }
#${ROOT_ID} .pr-btn--sm *{ font-size:var(--fs-sm) !important; }
#${ROOT_ID} .pr-btn--icon{ width:30px !important; height:30px !important; padding:0 !important; }
#${ROOT_ID} .pr-btn--icon-action{
  background:var(--paper) !important; color:var(--ink-3) !important; border:1px solid var(--line) !important;
}
#${ROOT_ID} .pr-btn--icon-action *{ background:transparent !important; color:var(--ink-3) !important; }
#${ROOT_ID} .pr-btn--icon-action:hover, #${ROOT_ID} .pr-btn--icon-action:hover *{
  background:var(--paper-2) !important; border-color:var(--line-strong) !important; color:var(--ink) !important; filter:none !important;
}
#${ROOT_ID} .pr-btn--icon-trash{
  background:var(--paper) !important; color:var(--danger) !important;
  border:1px solid rgba(184,83,74,.4) !important;
}
#${ROOT_ID} .pr-btn--icon-trash *{ background:transparent !important; color:var(--danger) !important; }
#${ROOT_ID} .pr-btn--icon-trash:hover{ background:var(--danger-soft) !important; border-color:var(--danger) !important; filter:none !important; }

/* ---- inputs ---- */
#${ROOT_ID} .pr-input{
  min-height:30px !important; padding:0 var(--s-4) !important;
  font-family:var(--font-sans) !important; font-size:var(--fs-md) !important;
  background:var(--paper-2) !important; color:var(--ink) !important;
  border:1px solid transparent !important; border-radius:var(--r-2) !important;
  outline:none !important; text-decoration:none !important;
}
#${ROOT_ID} .pr-input:focus{ background:var(--paper) !important; border-color:var(--line-strong) !important; }
#${ROOT_ID} .pr-input::placeholder{ color:var(--ink-4) !important; }

/* ---- side nav (master-detail / §20) ---- */
#${ROOT_ID} .pr-body{ flex:1; display:flex; min-height:0; }
#${ROOT_ID} .pr-side{
  flex:none; width:220px; display:flex; flex-direction:column; gap:var(--s-1);
  background:var(--paper-2); border-right:1px solid var(--line); padding:var(--s-5) 0;
}
#${ROOT_ID} .pr-side-head{
  font-size:var(--fs-xs); color:var(--ink-3); letter-spacing:.06em;
  padding:var(--s-2) var(--s-7) var(--s-1);
}
#${ROOT_ID} .pr-nav-item, #${ROOT_ID} .pr-nav-item *{
  font-family:var(--font-sans) !important; text-align:left !important;
  background:transparent; color:var(--ink) !important; text-decoration:none !important;
}
#${ROOT_ID} .pr-nav-item{
  display:block !important; width:100%; border:none !important;
  border-left:3px solid transparent !important; cursor:pointer !important;
  padding:var(--s-3) var(--s-7) !important; font-size:var(--fs-md) !important;
  background:transparent !important; line-height:var(--lh-tight) !important;
}
#${ROOT_ID} .pr-nav-item small{
  display:block !important; font-size:var(--fs-xs) !important; color:var(--ink-3) !important;
  margin-top:var(--s-1) !important; font-weight:400 !important;
}
#${ROOT_ID} .pr-nav-item:hover{ background:var(--paper-2-strong) !important; }
#${ROOT_ID} .pr-nav-item.active{
  border-left-color:var(--accent) !important; background:var(--accent-soft) !important; font-weight:600 !important;
}
#${ROOT_ID} .pr-main{ flex:1; display:flex; flex-direction:column; min-width:0; }

/* ---- sync bar ---- */
#${ROOT_ID} .pr-syncbar{
  display:flex; align-items:center; gap:var(--s-4); flex:none;
  padding:var(--s-4) var(--gutter); border-bottom:1px solid var(--line);
  background:var(--paper-2); font-size:var(--fs-sm); color:var(--ink-3);
}
#${ROOT_ID} .pr-syncbar span{ flex:1; min-width:0; }

/* ---- columns / list ---- */
#${ROOT_ID} .pr-app{ flex:1; display:flex; flex-direction:column; min-height:0; }
#${ROOT_ID} .pr-cols{ flex:1; display:flex; min-height:0; }
#${ROOT_ID} .pr-col{ flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid var(--line); }
#${ROOT_ID} .pr-col:last-child{ border-right:none; }
#${ROOT_ID} .pr-sub{
  display:flex; align-items:baseline; gap:var(--s-3); flex:none;
  padding:var(--s-5) var(--gutter) var(--s-2);
}
#${ROOT_ID} .pr-sub b{ font-size:var(--fs-md); font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#${ROOT_ID} .pr-sub .pr-count{ font-size:var(--fs-sm); color:var(--ink-3); font-family:var(--font-mono); white-space:nowrap; }
#${ROOT_ID} .pr-toolbar{
  display:flex; gap:var(--s-3); flex:none;
  padding:var(--s-2) var(--gutter) var(--s-5); border-bottom:1px solid var(--line);
}
#${ROOT_ID} .pr-toolbar .pr-input{ flex:1; min-width:0; }
#${ROOT_ID} .pr-rows{ flex:1; overflow:auto; }
#${ROOT_ID} .pr-row{
  display:flex; align-items:center; gap:var(--s-2);
  padding:var(--s-3) var(--gutter); border-bottom:1px solid var(--line); min-height:48px;
}
#${ROOT_ID} .pr-row:hover{ background:var(--paper-2); }
#${ROOT_ID} .pr-row.sel{ background:var(--accent-soft); }
#${ROOT_ID} .pr-row .pr-name{
  flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  padding:0 var(--s-2); color:var(--ink);
}
#${ROOT_ID} .pr-row[data-kind="l1"] .pr-name{ cursor:pointer; }
#${ROOT_ID} .pr-row.off .pr-name{ color:var(--ink-4); text-decoration:line-through; }
#${ROOT_ID} .pr-row .pr-childcount{
  font-family:var(--font-mono); font-size:var(--fs-xs); color:var(--ink-3);
  background:var(--paper-2-strong); border-radius:999px; padding:0 var(--s-3); margin-left:var(--s-2);
}
#${ROOT_ID} .pr-active{ display:inline-flex; align-items:center; padding:0 var(--s-1); cursor:pointer; }
#${ROOT_ID} .pr-active input{ width:14px; height:14px; accent-color:var(--accent); cursor:pointer; margin:0; }
#${ROOT_ID} .pr-empty{ padding:var(--s-9) var(--gutter); color:var(--ink-4); font-size:var(--fs-md); text-align:center; }

/* ---- empty / setup state ---- */
#${ROOT_ID} .pr-hero{
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:var(--s-5); padding:var(--s-10) var(--gutter); text-align:center;
}
#${ROOT_ID} .pr-hero h4{ margin:0; font-size:var(--fs-lg); font-weight:600; line-height:var(--lh-tight); }
#${ROOT_ID} .pr-hero p{ margin:0; color:var(--ink-3); font-size:var(--fs-md); }

/* ---- settings / form 共通部品 ---- */
#${ROOT_ID} .pr-field{ display:flex; flex-direction:column; gap:var(--s-2); }
#${ROOT_ID} .pr-field-row{ display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); }
#${ROOT_ID} .pr-field label{ font-size:var(--fs-sm); color:var(--ink-3); }
#${ROOT_ID} .pr-field .pr-note{ font-size:var(--fs-xs); color:var(--ink-4); }
#${ROOT_ID} .pr-radio{ display:flex; align-items:center; gap:var(--s-2); font-size:var(--fs-md); cursor:pointer; }
#${ROOT_ID} .pr-radio input{ accent-color:var(--accent); margin:0; }
#${ROOT_ID} .pr-kv{ font-size:var(--fs-sm); color:var(--ink-3); }
#${ROOT_ID} .pr-kv code{ font-family:var(--font-mono); color:var(--ink); background:var(--paper-2); padding:0 var(--s-2); border-radius:var(--r-2); }

/* ---- users table (§7: sticky不透明ヘッダ / hover paper-2 / チェック列34px固定) ---- */
#${ROOT_ID} .pr-utable{
  /* 表の自然幅 = 列幅の合計(Spira と同方式)。min-width:100% にしないことで
     列幅変更時に他列へ再配分されず、ドラッグ量がそのまま列幅になる */
  width:max-content; min-width:0;
  border-collapse:collapse; font-size:var(--fs-md); table-layout:fixed;
}
#${ROOT_ID} .pr-utable th{
  position:sticky; top:0; z-index:1; background:var(--paper-2); text-align:left; font-weight:600;
  padding:var(--s-4) var(--s-5); border-bottom:1px solid var(--line-strong);
  font-size:var(--fs-sm); color:var(--ink-3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  -webkit-user-select:none; user-select:none;
}
#${ROOT_ID} .pr-utable th.pr-th-sort{ cursor:pointer; }
#${ROOT_ID} .pr-utable th.pr-th-sort:hover{ background:var(--paper-2-strong); color:var(--ink); }
#${ROOT_ID} .pr-utable th.active{ color:var(--ink); }
#${ROOT_ID} .pr-utable td{
  padding:var(--s-4) var(--s-5); border-bottom:1px solid var(--line);
  /* 列幅を内容より狭くした場合は折り返して全文表示(省略しない) */
  white-space:normal; overflow-wrap:anywhere; vertical-align:top;
}
#${ROOT_ID} .pr-utable tbody tr{ cursor:pointer; }
#${ROOT_ID} .pr-utable tbody tr:hover{ background:var(--paper-2); }
#${ROOT_ID} .pr-utable .pr-udel td{ color:var(--ink-4); }
#${ROOT_ID} .pr-uchk{ width:34px; text-align:center; padding:var(--s-4) var(--s-2) !important; }
#${ROOT_ID} .pr-uchk input{ width:14px; height:14px; accent-color:var(--accent); cursor:pointer; margin:0; }

/* 列幅変更ハンドル(th 右端 6px — Spira と同仕様) */
#${ROOT_ID} .pr-col-resize{
  position:absolute; top:0; right:0; width:6px; height:100%;
  cursor:col-resize; -webkit-user-select:none; user-select:none;
  background:transparent; transition:background .1s; z-index:2;
}
#${ROOT_ID} .pr-col-resize:hover, #${ROOT_ID} .pr-col-resize.dragging{ background:var(--accent-soft); }

/* バッジ(NEW/更新/削除済) */
#${ROOT_ID} .pr-badge{
  display:inline-block; font-size:10px; font-weight:700; letter-spacing:.05em;
  border-radius:var(--r-2); padding:1px 6px; margin-right:var(--s-2); line-height:1.5;
}
/* NEW=青(新着) / 更新=アンバー(変更あり) — Spira の badge--new / badge--update と同色 */
#${ROOT_ID} .pr-badge--new{ background:var(--badge-new); color:#ffffff; }
#${ROOT_ID} .pr-badge--upd{ background:var(--badge-upd); color:#ffffff; }
#${ROOT_ID} .pr-badge--del{ background:var(--paper-3); color:var(--ink-3); font-weight:500; }

/* 通知ナビバッジ(.pr-nav-item * の上書きより後に置くこと) */
#${ROOT_ID} .pr-navbadge{
  display:inline-block !important; margin-left:var(--s-2) !important;
  background:var(--accent) !important; color:#ffffff !important;
  border-radius:999px !important; padding:0 var(--s-3) !important;
  font-size:var(--fs-xs) !important; line-height:1.7 !important;
}

/* 通知ビュー */
#${ROOT_ID} .pr-notif{
  display:flex; align-items:center; gap:var(--s-3);
  padding:var(--s-3) var(--gutter); border-bottom:1px solid var(--line);
}
#${ROOT_ID} .pr-notif.unread{ background:var(--accent-soft); }
#${ROOT_ID} .pr-notif-time{ font-family:var(--font-mono); font-size:var(--fs-xs); color:var(--ink-3); width:84px; flex:none; }
#${ROOT_ID} .pr-notif-msg{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* 利用者一覧のサブバー(選択時もレイアウトシフトさせない §1.4)とフィルタツールバー */
#${ROOT_ID} .pr-sub--users{ min-height:46px; align-items:center; }
#${ROOT_ID} .pr-toolbar--users #pr-ufilter-q{ flex:1; min-width:120px; }
#${ROOT_ID} .pr-toolbar--users .pr-fsel{ flex:none !important; width:130px !important; }
#${ROOT_ID} .pr-toolbar--users .pr-check{ flex:none; }

/* ---- user form ---- */
/* 基底 .pr-modal(440px) と同一詳細度だとソース順で負けるため、二重クラスで上書き */
#${ROOT_ID} .pr-modal.pr-modal--form{ width:min(860px, 92vw); max-height:calc(100vh - 80px); overflow:auto; }
#${ROOT_ID} .pr-req{ color:var(--danger); }
#${ROOT_ID} .pr-checks{
  display:flex; flex-wrap:wrap; gap:var(--s-3) var(--s-6);
  padding:var(--s-3) var(--s-4); background:var(--paper-2); border-radius:var(--r-2); min-height:34px;
}
#${ROOT_ID} .pr-check{
  display:inline-flex; align-items:center; gap:var(--s-2);
  font-size:var(--fs-md); cursor:pointer; white-space:nowrap;
}
#${ROOT_ID} .pr-check input{ width:14px; height:14px; accent-color:var(--accent); cursor:pointer; margin:0; }
/* 権限グループ選択(縦リスト・スクロール) */
#${ROOT_ID} .pr-checks--perm{ display:block; max-height:180px; overflow:auto; }
#${ROOT_ID} .pr-checks--perm .pr-check{ display:flex; padding:2px 0; white-space:normal; }
/* L1 行の鍵アイコン: 割当ありはアクセント色 */
#${ROOT_ID} .pr-row .pr-perm-on{ color:var(--accent-strong) !important; }

/* ---- status bar ---- */
#${ROOT_ID} .pr-status{
  flex:none; min-height:30px; padding:var(--s-1) var(--gutter);
  border-top:1px solid var(--line); background:var(--paper-2);
  color:var(--ink-3); font-size:var(--fs-sm);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; user-select:text;
}

/* ---- toasts (右上 / ok 2s / warn 3s / error 手動) ---- */
#${ROOT_ID} .pr-toasts{
  position:fixed; top:var(--s-5); right:var(--s-5); z-index:2147483800;
  display:flex; flex-direction:column; gap:var(--s-3); width:360px; max-width:90vw;
}
#${ROOT_ID} .pr-toast{
  display:flex; align-items:flex-start; gap:var(--s-3);
  background:var(--paper); border:1px solid var(--line-strong); border-left:3px solid var(--ok);
  border-radius:var(--r-3); box-shadow:var(--shadow-panel);
  padding:var(--s-3) var(--s-4); animation:pr-slide .2s ease;
}
#${ROOT_ID} .pr-toast--warn{ border-left-color:var(--warn); }
#${ROOT_ID} .pr-toast--err{ border-left-color:var(--danger); }
#${ROOT_ID} .pr-toast .pr-msg{
  flex:1; min-width:0; font-size:var(--fs-sm); line-height:1.5; padding-top:var(--s-1);
  user-select:text; word-break:break-all; color:var(--ink);
}
@keyframes pr-slide{ from{ transform:translateY(-8px); opacity:0; } }

/* ---- settings hub modal (§19: 固定サイズ+端ドラッグでリサイズ可、項目で大きさを変えない) ---- */
#${ROOT_ID} .pr-modal--hub{
  width:min(1000px, calc((100vw - 80px) * 2 / 3)) !important;
  height:calc(100vh - 80px);
  min-width:640px; min-height:480px;
  max-height:none;
  resize:both; overflow:hidden;
  padding:var(--s-8) 0 var(--s-6) !important;
}
#${ROOT_ID} .pr-modal--hub h4{ padding:0 var(--s-9); }
#${ROOT_ID} .pr-modal--hub .pr-modal-actions{ padding:0 var(--s-9); }
#${ROOT_ID} .pr-hub-body{
  flex:1; display:flex; min-height:0;
  border-top:1px solid var(--line); border-bottom:1px solid var(--line);
}
#${ROOT_ID} .pr-hub-nav{
  flex:none; width:200px; display:flex; flex-direction:column; gap:var(--s-1);
  background:var(--paper-2); border-right:1px solid var(--line); padding:var(--s-5) 0;
}
#${ROOT_ID} .pr-hub-panels{ flex:1; min-width:0; overflow:auto; }
#${ROOT_ID} .pr-hub-panel{
  display:flex; flex-direction:column; gap:var(--s-7);
  padding:var(--s-8) var(--s-9); max-width:640px;
}

/* ---- modal ---- */
#${ROOT_ID} .pr-backdrop{
  position:fixed; inset:0; z-index:2147483700;
  background:rgba(15,15,15,.45); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center;
}
#${ROOT_ID} .pr-modal{
  background:var(--paper); border-radius:var(--r-3); box-shadow:var(--shadow-modal);
  width:min(440px, 92vw); padding:var(--s-8) var(--s-9);
  display:flex; flex-direction:column; gap:var(--s-5);
}
#${ROOT_ID} .pr-modal h4{ margin:0; font-size:var(--fs-lg); font-weight:600; line-height:var(--lh-tight); }
#${ROOT_ID} .pr-modal .pr-modal-msg{ font-size:var(--fs-md); color:var(--ink-3); user-select:text; }
#${ROOT_ID} .pr-modal .pr-input{ min-height:34px !important; }
#${ROOT_ID} .pr-modal .pr-ta-sm{ min-height:80px !important; }
#${ROOT_ID} .pr-modal .pr-modal-ta{
  min-height:160px !important; max-height:55vh !important;
  padding:var(--s-3) var(--s-4) var(--s-5) !important;
  resize:none !important; overflow:auto !important; line-height:1.6 !important;
}
#${ROOT_ID} .pr-modal-actions{ display:flex; justify-content:flex-end; gap:var(--s-3); margin-top:var(--s-2); }
`;
