// 画面別のコンポーネント CSS(一覧表/フィルター/バッジ/フォーム/チップ/進捗/トースト/モーダル)。
// トークンは styles.js の cssBase で定義したものだけを使う。ソース順が詳細度の決め手になる箇所があるため
// cssBase の後ろに連結する

const cssViews = `
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
/* 列フィルター中の見出し: アクセント色 + じょうご(funnel)アイコン */
#${ROOT_ID} .pr-th-funnel{ display:none; margin-left:4px; vertical-align:-1px; }
#${ROOT_ID} .pr-th-funnel svg{ width:11px; height:11px; }
#${ROOT_ID} .pr-utable th.pr-th-filtered{ color:var(--accent); }
#${ROOT_ID} .pr-utable th.pr-th-filtered .pr-th-funnel{ display:inline-block; }

/* 列ヘッダの値フィルター ポップアップ(Excel オートフィルター相当) */
#${ROOT_ID} .pr-colmenu{
  position:fixed; z-index:2147483650; display:flex; flex-direction:column;
  width:250px; max-height:min(78vh,520px); overflow:hidden; padding:var(--s-3);
  background:var(--paper); border:1px solid var(--paper-3); border-radius:var(--r-3);
  box-shadow:var(--shadow-modal); font-size:var(--fs-md); color:var(--ink);
}
#${ROOT_ID} .pr-colmenu-head{ font-size:var(--fs-xs); color:var(--ink-3); padding:0 var(--s-2) var(--s-2); }
#${ROOT_ID} .pr-colmenu-item{
  display:flex; align-items:center; gap:var(--s-3); padding:var(--s-2) var(--s-2);
  border-radius:var(--r-2); cursor:pointer; color:var(--ink); border:0; background:transparent;
  width:100%; text-align:left; font:inherit;
}
#${ROOT_ID} .pr-colmenu-item:hover{ background:var(--paper-2-strong); }
#${ROOT_ID} .pr-colmenu-item input{ flex:none; }
#${ROOT_ID} .pr-colmenu-item span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#${ROOT_ID} .pr-colmenu-act svg{ width:13px; height:13px; flex:none; color:var(--ink-3); }
#${ROOT_ID} .pr-colmenu-sep{ height:1px; background:var(--line); margin:var(--s-2) 0; }
#${ROOT_ID} .pr-colmenu-search{
  width:100%; box-sizing:border-box; height:28px; margin-bottom:var(--s-2); padding:2px var(--s-3);
  border:1px solid var(--paper-3); border-radius:var(--r-2); background:var(--paper); color:var(--ink);
  font:inherit; font-size:var(--fs-sm); outline:none;
}
#${ROOT_ID} .pr-colmenu-search:focus{ border-color:var(--accent); }
#${ROOT_ID} .pr-colmenu-all{ border-bottom:1px solid var(--line); margin-bottom:2px; }
#${ROOT_ID} .pr-colmenu-vlist{ flex:1 1 auto; min-height:40px; overflow-y:auto; }
#${ROOT_ID} .pr-colmenu-note{ font-size:var(--fs-xs); color:var(--ink-4); padding:var(--s-2); }
#${ROOT_ID} .pr-colmenu-foot{ display:flex; align-items:center; gap:var(--s-2); padding-top:var(--s-2); margin-top:var(--s-1); border-top:1px solid var(--line); }
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

/* ---- フィルタのラベル / 未反映バナー ---- */
#${ROOT_ID} .pr-fwrap{
  display:inline-flex; align-items:center; gap:var(--s-2);
  font-size:var(--fs-sm); color:var(--ink-3); white-space:nowrap;
}
#${ROOT_ID} .pr-pending{
  display:flex; align-items:center; gap:var(--s-5);
  margin:0 var(--gutter); margin-top:var(--s-5); padding:var(--s-4) var(--s-6);
  border:1px solid rgba(196,127,28,.4); border-radius:var(--r-2);
  background:rgba(196,127,28,.10); color:var(--warn); font-size:var(--fs-md);
}
#${ROOT_ID} .pr-pending span{ flex:1; min-width:0; }
/* 未反映の種類バッジ(マスタ行・列見出し) */
#${ROOT_ID} .pr-stale{
  display:inline-block; margin-left:var(--s-2); padding:0 var(--s-3);
  border-radius:var(--r-2); font-size:var(--fs-xs); font-weight:500; white-space:nowrap;
  background:rgba(196,127,28,.14); color:var(--warn);
}
#${ROOT_ID} .pr-stale--perm{ background:var(--accent-soft); color:var(--accent-strong); }

/* ---- 改廃ステータス(色分けチップ) ---- */
#${ROOT_ID} .pr-chip{
  display:inline-block; padding:2px var(--s-4); border-radius:999px;
  font-size:var(--fs-sm); font-weight:600; line-height:1.5; white-space:nowrap;
  border:1px solid transparent;
}
#${ROOT_ID} .pr-rst--wait{ background:rgba(196,127,28,.16); color:var(--warn); border-color:rgba(196,127,28,.35); }
#${ROOT_ID} .pr-rst--done{ background:var(--accent-soft); color:var(--accent-strong); border-color:rgba(122,138,120,.4); }
#${ROOT_ID} .pr-rst--verified{ background:var(--paper-3); color:var(--ink-3); border-color:var(--line); }
/* ヘルプ画面 */
#${ROOT_ID} .pr-help-body{ padding:var(--s-5) var(--gutter); overflow:auto; }
#${ROOT_ID} .pr-help-sec{ margin-bottom:var(--s-7); }
#${ROOT_ID} .pr-help-sec h5{
  margin:0 0 var(--s-3); font-size:var(--fs-md); font-weight:700; color:var(--ink);
  border-left:3px solid var(--accent); padding-left:var(--s-3);
}
#${ROOT_ID} .pr-help-sec ul{ margin:0; padding-left:var(--s-7); }
#${ROOT_ID} .pr-help-sec li{ font-size:var(--fs-md); line-height:1.85; color:var(--ink-3); }
#${ROOT_ID} .pr-help-sec li b{ color:var(--ink); font-weight:600; }
#${ROOT_ID} .pr-oss{ font-size:var(--fs-sm); color:var(--ink-3); line-height:1.7; }

/* 変更区分/権限の色チップ(SPリストと同じ色)。緑=追加 青=更新 赤=削除 灰=その他 */
#${ROOT_ID} .pr-spchip{
  display:inline-block; padding:1px var(--s-4); border-radius:999px;
  font-size:var(--fs-sm); line-height:1.6; white-space:nowrap; color:#323130;
}
#${ROOT_ID} .pr-spchip--add{ background:rgb(202,240,204); }
#${ROOT_ID} .pr-spchip--upd{ background:rgb(212,231,246); }
#${ROOT_ID} .pr-spchip--del{ background:rgb(250,187,195); }
#${ROOT_ID} .pr-spchip--gray{ background:rgb(229,229,229); }

/* 改廃ステータスのチップ風インラインselect(その場で直接変更) */
#${ROOT_ID} .pr-chipsel{
  height:26px !important; padding:0 var(--s-4) !important;
  border-radius:999px !important; border:1px solid transparent !important;
  font-size:var(--fs-sm) !important; font-weight:600 !important; cursor:pointer;
  max-width:140px;
}

/* ---- 実機差分チェックの区分バッジ ---- */
#${ROOT_ID} .pr-cmp{ display:inline-block; padding:1px var(--s-3); border-radius:var(--r-2); font-size:var(--fs-xs); font-weight:500; white-space:nowrap; }
#${ROOT_ID} .pr-cmp--diff{ background:rgba(196,127,28,.14); color:var(--warn); }
#${ROOT_ID} .pr-cmp--add{ background:var(--accent-soft); color:var(--accent-strong); }
#${ROOT_ID} .pr-cmp--miss{ background:rgba(184,83,74,.14); color:var(--danger); }

/* ---- Excel取込の差分明細 ---- */
#${ROOT_ID} .pr-diff-list{ display:block; max-height:280px; overflow:auto; }
#${ROOT_ID} .pr-diff-item{
  padding:var(--s-3) 0; border-bottom:1px solid var(--line);
  font-size:var(--fs-md); line-height:1.7;
}
#${ROOT_ID} .pr-diff-item:last-child{ border-bottom:none; }
#${ROOT_ID} .pr-diff-tag{
  display:inline-block; margin-left:var(--s-3); padding:0 var(--s-3);
  border-radius:var(--r-2); font-size:var(--fs-xs);
  background:var(--paper-3); color:var(--ink-3);
}
#${ROOT_ID} .pr-diff-tag--add{ background:var(--accent-soft); color:var(--accent-strong); }
#${ROOT_ID} .pr-diff-tag--del{ background:rgba(184,83,74,.14); color:var(--danger); }
#${ROOT_ID} .pr-diff-tag--warn{ background:rgba(196,127,28,.14); color:var(--warn); }

/* ---- progress modal(処理中の進捗+残り時間) ---- */
#${ROOT_ID} .pr-modal.pr-prog{ width:min(440px, 92vw); }
#${ROOT_ID} .pr-prog-msg{ font-size:var(--fs-md); color:var(--ink-3); min-height:1.5em; }
#${ROOT_ID} .pr-prog-track{
  height:8px; border-radius:4px; background:var(--paper-3); overflow:hidden; position:relative;
}
#${ROOT_ID} .pr-prog-fill{
  height:100%; border-radius:4px; background:var(--accent); width:0;
  transition:width .3s ease;
}
#${ROOT_ID} .pr-prog-fill.ind{ position:absolute; animation:pr-prog-slide 1.4s ease-in-out infinite; }
@keyframes pr-prog-slide{ 0%{ left:-40%; } 100%{ left:100%; } }
@media (prefers-reduced-motion: reduce){ #${ROOT_ID} .pr-prog-fill.ind{ animation:none; left:30%; } }
#${ROOT_ID} .pr-prog-meta{
  display:flex; justify-content:space-between; gap:var(--s-4);
  font-size:var(--fs-sm); color:var(--ink-3);
}
#${ROOT_ID} .pr-prog-meta .pr-prog-count{ font-family:var(--font-mono); }

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
/* マスタの2欄一括入力(日本語|英語を行対応で入力) */
#${ROOT_ID} .pr-bulk2{ display:flex; gap:var(--s-3); margin-top:var(--s-2); }
#${ROOT_ID} .pr-bulk2-col{ flex:1; min-width:0; display:flex; flex-direction:column; gap:var(--s-2); }
#${ROOT_ID} .pr-bulk2-col label{ font-size:var(--fs-sm); color:var(--ink-3); }
#${ROOT_ID} .pr-bulk2-ta{
  min-height:240px; max-height:55vh; resize:vertical; overflow:auto;
  line-height:1.7; font-family:var(--mono, ui-monospace, monospace); font-size:var(--fs-sm); white-space:pre;
}
#${ROOT_ID} .pr-modal-actions{ display:flex; justify-content:flex-end; gap:var(--s-3); margin-top:var(--s-2); }
`;
const css = cssBase + cssViews;
