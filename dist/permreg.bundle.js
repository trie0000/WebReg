/* permreg — システム利用者の権限登録リスト 管理用 bookmarklet
 *
 * フェーズ1: 組織区分マスタ(第1階層/第2階層)の管理UI。
 * SharePoint サイトのページ上で実行し、REST API でマスタリストを作成・編集する。
 *
 * UI は「🎨 UI / デザインルール(全アプリ共通)」(Notion) と Spira のトークンに準拠:
 *   - デザイントークンは CSS 変数で一元定義(hex/px の直書き禁止)
 *   - ホスト(SP)CSS シールド: ルート `all:initial` + `#permreg-root .class` + !important
 *   - アイコンは Feather 風 SVG(stroke 1.7)、絵文字をUI要素に使わない
 *   - 通知は右上トースト(ok 2秒 / warn 3秒 / error 手動close+コピー可)
 *   - 破壊的操作は確認モーダル経由(backdrop は mousedown 起点で判定)
 *
 * 作成されるリスト:
 *   組織区分第1階層マスタ … Title(名称) / SortOrder(並び順) / Active(有効)
 *   組織区分第2階層マスタ … Title(名称) / Level1(第1階層への参照) / SortOrder / Active
 */
(() => {
  'use strict';

  const ROOT_ID = 'permreg-root';
  const LS_KEY = 'permreg.webUrl';
  const LIST_L1 = '組織区分第1階層マスタ';
  const LIST_L2 = '組織区分第2階層マスタ';

  // 多重起動したら前のパネルを消して開き直す
  const prev = document.getElementById(ROOT_ID);
  if (prev) prev.remove();

  // ---------------------------------------------------------------- state
  const state = {
    webUrl: '',
    l1: [],          // [{Id, Title, SortOrder, Active}]
    l2: [],          // [{Id, Title, SortOrder, Active, Level1:{Id}}]
    selectedL1: null, // Id
    ready: false,    // マスタリストが存在するか
    busy: false,
  };

  function guessWebUrl() {
    try {
      if (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) {
        return window._spPageContextInfo.webAbsoluteUrl;
      }
    } catch { /* ignore */ }
    const m = location.href.match(/^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/);
    return m ? m[1] : location.origin;
  }
  state.webUrl = localStorage.getItem(LS_KEY) || guessWebUrl();

  // ---------------------------------------------------------------- REST
  const webUrl = () => state.webUrl.replace(/\/+$/, '');
  let _digest = null; // {value, exp}

  async function getDigest() {
    if (_digest && Date.now() < _digest.exp) return _digest.value;
    const r = await fetch(webUrl() + '/_api/contextinfo', {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'same-origin',
    });
    if (!r.ok) throw new Error('contextinfo の取得に失敗 (HTTP ' + r.status + ')。サイトURLを確認してください。');
    const j = await r.json();
    _digest = {
      value: j.FormDigestValue,
      exp: Date.now() + Math.max(60, (j.FormDigestTimeoutSeconds || 1800) - 60) * 1000,
    };
    return _digest.value;
  }

  async function sp(method, path, body, headers) {
    const h = Object.assign({ Accept: 'application/json;odata=nometadata' }, headers);
    if (method !== 'GET') {
      h['X-RequestDigest'] = await getDigest();
      if (body != null) h['Content-Type'] = 'application/json;odata=nometadata';
    }
    const r = await fetch(webUrl() + path, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: h,
      credentials: 'same-origin',
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try {
        const j = await r.json();
        const m = (j['odata.error'] && j['odata.error'].message && j['odata.error'].message.value)
          || (j.error && j.error.message && (j.error.message.value || j.error.message));
        if (m) msg += ' — ' + m;
      } catch { /* ignore */ }
      const e = new Error(msg);
      e.status = r.status;
      throw e;
    }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const spGet = (p) => sp('GET', p);
  const spPost = (p, b) => sp('POST', p, b);
  const spMerge = (p, b) => sp('POST', p, b, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
  const spDelete = (p) => sp('POST', p, null, { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' });
  const lt = (title) => "/_api/web/lists/getbytitle('" + encodeURIComponent(title.replace(/'/g, "''")) + "')";

  // ---------------------------------------------------------------- setup
  async function listId(title) {
    try {
      return (await spGet(lt(title) + '?$select=Id')).Id;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function ensureList(title, description) {
    const id = await listId(title);
    if (id) return id;
    const j = await spPost('/_api/web/lists', {
      Title: title,
      BaseTemplate: 100,
      Description: description,
    });
    return j.Id;
  }

  async function fieldExists(title, internal) {
    try {
      await spGet(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')?$select=Id");
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  }

  // 内部名を英語に固定するため、いったん英語名で作成してから表示名だけ日本語に変える
  async function ensureField(title, internal, display, createBody) {
    if (await fieldExists(title, internal)) return;
    await spPost(lt(title) + '/fields', Object.assign({ Title: internal }, createBody));
    await spMerge(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
  }

  async function ensureLookupField(title, internal, display, targetListId) {
    if (await fieldExists(title, internal)) return;
    const xml = "<Field Type='Lookup' DisplayName='" + internal + "' Name='" + internal +
      "' StaticName='" + internal + "' List='{" + targetListId + "}' ShowField='Title' Required='TRUE'/>";
    await spPost(lt(title) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
    await spMerge(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
  }

  async function addViewFields(title, internals) {
    for (const f of internals) {
      try {
        await spPost(lt(title) + "/defaultview/viewfields/addviewfield('" + f + "')");
      } catch { /* 既に追加済みなら無視 */ }
    }
  }

  async function setup(log) {
    log('「' + LIST_L1 + '」を確認中…');
    const id1 = await ensureList(LIST_L1, '権限登録リスト用 組織区分(第1階層)マスタ');
    await ensureField(LIST_L1, 'SortOrder', '並び順', { FieldTypeKind: 9 });
    await ensureField(LIST_L1, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
    await addViewFields(LIST_L1, ['SortOrder', 'Active']);

    log('「' + LIST_L2 + '」を確認中…');
    await ensureList(LIST_L2, '権限登録リスト用 組織区分(第2階層)マスタ');
    await ensureLookupField(LIST_L2, 'Level1', '第1階層', id1);
    await ensureField(LIST_L2, 'SortOrder', '並び順', { FieldTypeKind: 9 });
    await ensureField(LIST_L2, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
    await addViewFields(LIST_L2, ['Level1', 'SortOrder', 'Active']);

    log('セットアップ完了');
  }

  // ---------------------------------------------------------------- data
  async function checkReady() {
    state.ready = !!(await listId(LIST_L1)) && !!(await listId(LIST_L2));
  }

  async function loadAll() {
    const [r1, r2] = await Promise.all([
      spGet(lt(LIST_L1) + '/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999'),
      spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
    ]);
    state.l1 = r1.value || [];
    state.l2 = r2.value || [];
    if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
    if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;
  }

  const nextOrder = (items) => items.reduce((m, x) => Math.max(m, x.SortOrder || 0), 0) + 10;

  async function addItem(listTitle, body) {
    await spPost(lt(listTitle) + '/items', body);
  }
  async function updateItem(listTitle, id, body) {
    await spMerge(lt(listTitle) + '/items(' + id + ')', body);
  }
  async function deleteItem(listTitle, id) {
    await spDelete(lt(listTitle) + '/items(' + id + ')');
  }

  // 並び順の入れ替え。SortOrder が未設定/重複の行があれば全体を振り直してから入れ替える
  async function moveItem(listTitle, items, item, dir) {
    const idx = items.indexOf(item);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const orders = items.map((x) => x.SortOrder);
    const broken = orders.some((o, i) => o == null || orders.indexOf(o) !== i);
    if (broken) {
      for (let i = 0; i < items.length; i++) {
        items[i].SortOrder = (i + 1) * 10;
        await updateItem(listTitle, items[i].Id, { SortOrder: items[i].SortOrder });
      }
    }
    const a = items[idx], b = items[j];
    await updateItem(listTitle, a.Id, { SortOrder: b.SortOrder });
    await updateItem(listTitle, b.Id, { SortOrder: a.SortOrder });
  }

  // ---------------------------------------------------------------- icons (Feather 風 / stroke 1.7)
  const ICONS = {
    'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'edit-2': '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'copy': '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  };
  const ico = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';

  // ---------------------------------------------------------------- css
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  position:fixed; top:0; right:0; height:100vh; width:780px; max-width:96vw;
  z-index:2147483600; display:flex; flex-direction:column;
  font-family:var(--font-sans); font-size:var(--fs-md); line-height:var(--lh-base);
  color:var(--ink); background:var(--paper);
  border-left:1px solid var(--line-strong); box-shadow:var(--shadow-panel);
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
#${ROOT_ID} .pr-modal-actions{ display:flex; justify-content:flex-end; gap:var(--s-3); margin-top:var(--s-2); }
`;

  // ---------------------------------------------------------------- root
  const root = document.createElement('div');
  root.id = ROOT_ID;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  root.appendChild(styleEl);
  const app = document.createElement('div');
  app.className = 'pr-app';
  root.appendChild(app);
  document.body.appendChild(root);

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // ---------------------------------------------------------------- toast
  function toast(kind, msg) {
    let host = root.querySelector('.pr-toasts');
    if (!host) {
      host = el('<div class="pr-toasts" role="status" aria-live="polite"></div>');
      root.appendChild(host);
    }
    const t = el(`
      <div class="pr-toast pr-toast--${kind}">
        <div class="pr-msg"></div>
        ${kind === 'err' ? `<button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="copy" aria-label="エラー内容をコピー">${ico('copy')}</button>` : ''}
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="close" aria-label="閉じる">${ico('x')}</button>
      </div>`);
    t.querySelector('.pr-msg').textContent = msg;
    t.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tact]');
      if (!b) return;
      if (b.dataset.tact === 'copy') navigator.clipboard.writeText(msg).catch(() => {});
      else t.remove();
    });
    host.appendChild(t);
    if (kind === 'ok') setTimeout(() => t.remove(), 2000);
    if (kind === 'warn') setTimeout(() => t.remove(), 3000);
  }

  // ---------------------------------------------------------------- modal
  // inputValue を渡すと入力モーダル(resolve: string|null)、
  // 渡さなければ確認モーダル(resolve: boolean)。
  // backdrop は mousedown 起点で判定(リサイズ/選択ドラッグの誤クローズ防止)。
  function modal({ title, message, inputValue, okLabel, danger }) {
    return new Promise((resolve) => {
      const hasInput = inputValue !== undefined;
      const back = el(`
        <div class="pr-backdrop">
          <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <h4></h4>
            ${message != null ? '<div class="pr-modal-msg"></div>' : ''}
            ${hasInput ? '<input class="pr-input" type="text">' : ''}
            <div class="pr-modal-actions">
              <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
              <button class="pr-btn ${danger ? 'pr-btn--danger' : 'pr-btn--primary'}" data-mact="ok"></button>
            </div>
          </div>
        </div>`);
      back.querySelector('h4').textContent = title;
      if (message != null) back.querySelector('.pr-modal-msg').textContent = message;
      const input = back.querySelector('input');
      if (input) input.value = inputValue;
      back.querySelector('[data-mact="ok"]').textContent = okLabel || 'OK';

      const done = (val) => {
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        resolve(val);
      };
      const cancel = () => done(hasInput ? null : false);
      const ok = () => done(hasInput ? input.value.trim() : true);

      let downOnBack = false;
      back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
      back.addEventListener('click', (e) => {
        if (e.target === back) {
          if (downOnBack) cancel();
          return;
        }
        const b = e.target.closest('[data-mact]');
        if (b) (b.dataset.mact === 'ok' ? ok() : cancel());
      });
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (hasInput && e.target === input))) ok();
      };
      document.addEventListener('keydown', onKey, true);

      root.appendChild(back);
      (input || back.querySelector('[data-mact="ok"]')).focus();
      if (input) input.select();
    });
  }

  // ---------------------------------------------------------------- render
  function setStatus(msg) {
    const f = root.querySelector('.pr-status');
    if (f) f.textContent = msg;
  }

  // 操作を直列化しつつ busy 表示。エラーは右上トーストに出す(コピー可)
  async function run(label, fn) {
    if (state.busy) return;
    state.busy = true;
    app.style.opacity = '0.55';
    app.style.pointerEvents = 'none';
    setStatus(label + '…');
    try {
      await fn();
      setStatus(label + ' 完了');
    } catch (e) {
      setStatus('エラー: ' + e.message);
      toast('err', label + 'に失敗しました — ' + e.message);
    } finally {
      state.busy = false;
      app.style.opacity = '';
      app.style.pointerEvents = '';
    }
  }

  function render() {
    const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
    const sel = state.l1.find((x) => x.Id === state.selectedL1);

    const rowHtml = (x, kind, extra) => `
      <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="上へ" title="上へ">${ico('chevron-up')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="下へ" title="下へ">${ico('chevron-down')}</button>
        <span class="pr-name" ${kind === 'l1' ? 'data-act="select"' : ''} title="${esc(x.Title)}">${esc(x.Title)}${
          kind === 'l1' ? `<span class="pr-childcount">${l2of(x.Id).length}</span>` : ''}</span>
        <label class="pr-active" title="有効/無効">
          <input type="checkbox" data-act="active" aria-label="有効" ${x.Active !== false ? 'checked' : ''}>
        </label>
        <button class="pr-btn pr-btn--icon pr-btn--icon-action" data-act="rename" aria-label="名称変更" title="名称変更">${ico('edit-2')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--icon-trash" data-act="del" aria-label="削除" title="削除">${ico('trash-2')}</button>
      </div>`;

    let bodyHtml;
    if (!state.ready) {
      bodyHtml = `
        <div class="pr-hero">
          <h4>マスタリストがまだありません</h4>
          <p>このサイトに「${esc(LIST_L1)}」と「${esc(LIST_L2)}」を作成します。</p>
          <button class="pr-btn pr-btn--primary" data-act="setup">${ico('plus')}初期セットアップ</button>
        </div>`;
    } else {
      bodyHtml = `
        <div class="pr-cols">
          <div class="pr-col">
            <div class="pr-sub"><b>第1階層</b><span class="pr-count">${state.l1.length}件</span></div>
            <div class="pr-toolbar">
              <input type="text" class="pr-input" id="pr-add-l1" placeholder="第1階層の名称を入力">
              <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
            </div>
            <div class="pr-rows">${state.l1.map((x) =>
              rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
              '<div class="pr-empty">未登録</div>'}</div>
          </div>
          <div class="pr-col">
            <div class="pr-sub"><b>第2階層${sel ? ' — ' + esc(sel.Title) : ''}</b>
              <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
            ${sel ? `
            <div class="pr-toolbar">
              <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称を入力">
              <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
            </div>
            <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
              '<div class="pr-empty">未登録</div>'}</div>`
            : '<div class="pr-empty">左で第1階層を選択してください</div>'}
          </div>
        </div>`;
    }

    app.innerHTML = `
      <div class="pr-topbar">
        <span class="pr-title">permreg<small>組織区分マスタ管理</small></span>
        <input type="text" class="pr-input" id="pr-weburl" style="flex:1" value="${esc(state.webUrl)}"
          aria-label="SharePoint サイトURL" title="SharePoint サイトURL">
        <button class="pr-btn pr-btn--ghost" data-act="reload">${ico('refresh-cw')}再読込</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="close" aria-label="閉じる" title="閉じる">${ico('x')}</button>
      </div>
      ${bodyHtml}
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'}</div>`;
  }

  async function reload() {
    await checkReady();
    if (state.ready) await loadAll();
    render();
  }

  // ---------------------------------------------------------------- events
  app.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'pr-weburl') {
      state.webUrl = t.value.trim();
      localStorage.setItem(LS_KEY, state.webUrl);
      _digest = null;
      return;
    }
    if (t.dataset.act === 'active') {
      const row = t.closest('.pr-row');
      const listTitle = row.dataset.kind === 'l1' ? LIST_L1 : LIST_L2;
      run('更新', async () => {
        await updateItem(listTitle, +row.dataset.id, { Active: t.checked });
        await reload();
      });
    }
  });

  app.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'pr-add-l1') app.querySelector('[data-act="add-l1"]').click();
    if (ev.target.id === 'pr-add-l2') app.querySelector('[data-act="add-l2"]').click();
  });

  app.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const row = t.closest('.pr-row');
    const kind = row && row.dataset.kind;
    const id = row && +row.dataset.id;
    const listTitle = kind === 'l1' ? LIST_L1 : LIST_L2;
    const items = kind === 'l1' ? state.l1
      : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
    const item = items && items.find((x) => x.Id === id);

    if (act === 'close') { root.remove(); return; }
    if (act === 'reload') { run('再読込', reload); return; }
    if (act === 'setup') {
      run('セットアップ', async () => {
        await setup(setStatus);
        await reload();
        toast('ok', 'マスタリストを作成しました');
      });
      return;
    }
    if (act === 'select') { state.selectedL1 = id; render(); return; }

    if (act === 'add-l1' || act === 'add-l2') {
      const input = app.querySelector(act === 'add-l1' ? '#pr-add-l1' : '#pr-add-l2');
      const name = input.value.trim();
      if (!name) return;
      const pool = act === 'add-l1' ? state.l1
        : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
      if (pool.some((x) => x.Title === name)) {
        toast('warn', '「' + name + '」は既に登録されています');
        return;
      }
      run('追加', async () => {
        const body = { Title: name, SortOrder: nextOrder(pool), Active: true };
        if (act === 'add-l2') body.Level1Id = state.selectedL1;
        await addItem(act === 'add-l1' ? LIST_L1 : LIST_L2, body);
        await reload();
        toast('ok', '「' + name + '」を追加しました');
      });
      return;
    }

    if (!item) return;

    if (act === 'rename') {
      const name = await modal({ title: '名称変更', inputValue: item.Title, okLabel: '保存' });
      if (!name || name === item.Title) return;
      run('名称変更', async () => {
        await updateItem(listTitle, id, { Title: name });
        await reload();
      });
    } else if (act === 'del') {
      if (kind === 'l1') {
        const children = state.l2.filter((x) => x.Level1 && x.Level1.Id === id);
        if (children.length) {
          toast('warn', '「' + item.Title + '」には第2階層が ' + children.length + ' 件あります。先に第2階層を削除してください');
          return;
        }
      }
      const okDel = await modal({
        title: '削除の確認',
        message: '「' + item.Title + '」を削除します。この操作は元に戻せません。',
        okLabel: '削除する',
        danger: true,
      });
      if (!okDel) return;
      run('削除', async () => {
        await deleteItem(listTitle, id);
        await reload();
        toast('ok', '「' + item.Title + '」を削除しました');
      });
    } else if (act === 'up' || act === 'down') {
      run('並べ替え', async () => {
        await moveItem(listTitle, items, item, act === 'up' ? -1 : 1);
        await reload();
      });
    }
  });

  // ---------------------------------------------------------------- start
  render();
  run('読込', reload);
})();
