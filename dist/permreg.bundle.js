(() => {
const PRODUCT = 'permreg';
const ROOT_ID = 'permreg-root';
const LS_WEB_URL = 'permreg.webUrl';
const LS_DEV_SOURCE = 'permreg.dev.bundle-source';
const LS_DEV_BASE = 'permreg.dev.local-base';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/permreg';
const LIST_L1 = '組織区分第1階層マスタ';
const LIST_L2 = '組織区分第2階層マスタ';
const LIST_USERS = '利用者一覧';
const CHANGE_TYPE_DEFAULTS = ['新規', '変更', '削除', '変更なし'];
const PERMISSION_DEFAULTS = ['参照者', '更新者'];
const POLL_INTERVAL = 30000;
const LS_NOTIFY_EVENTS = 'permreg.notify.events';
const LS_NOTIFY_READAT = 'permreg.notify.readAt';
const LABEL_L1 = '組織区分1';
const LABEL_L2 = '組織区分2';
const BUILD = typeof "0.1.0-6490b90c" !== 'undefined' ? "0.1.0-6490b90c" : 'dev';
let _webUrl = '';
let _digest = null;
function setWebUrl(u) {
_webUrl = String(u || '').replace(/\/+$/, '');
_digest = null;
}
function getWebUrl() {
return _webUrl;
}
async function getDigest() {
if (_digest && Date.now() < _digest.exp) return _digest.value;
const r = await fetch(_webUrl + '/_api/contextinfo', {
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
const r = await fetch(_webUrl + path, {
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
} catch { }
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
async function spReorderContentTypeFields(listTitle, orderedInternalNames) {
const [site, web, list, cts] = await Promise.all([
spGet('/_api/site?$select=Id'),
spGet('/_api/web?$select=Id'),
spGet(lt(listTitle) + '?$select=Id'),
spGet(lt(listTitle) + "/contenttypes?$select=StringId,Name"),
]);
const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
if (!ct) throw new Error('コンテンツタイプが見つかりません');
const identity = '740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:' + site.Id +
':web:' + web.Id + ':list:' + list.Id + ':contenttype:' + ct.StringId;
const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const params = orderedInternalNames.map((n) => '<Object Type="String">' + xmlEscape(n) + '</Object>').join('');
const xml = '<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0"' +
' ApplicationName="permreg" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions>' +
'<Method Name="Reorder" Id="1" ObjectPathId="2"><Parameters><Parameter Type="Array">' + params +
'</Parameter></Parameters></Method>' +
'<Method Name="Update" Id="3" ObjectPathId="5"><Parameters><Parameter Type="Boolean">false</Parameter></Parameters></Method>' +
'</Actions><ObjectPaths>' +
'<Property Id="2" ParentId="5" Name="FieldLinks" />' +
'<Identity Id="5" Name="' + identity + '" />' +
'</ObjectPaths></Request>';
const r = await fetch(_webUrl + '/_vti_bin/client.svc/ProcessQuery', {
method: 'POST',
headers: { 'Content-Type': 'text/xml', 'X-RequestDigest': await getDigest() },
credentials: 'same-origin',
body: xml,
});
if (!r.ok) throw new Error('HTTP ' + r.status);
const j = await r.json();
if (j && j[0] && j[0].ErrorInfo) throw new Error(j[0].ErrorInfo.ErrorMessage);
}
async function spMergeVerbose(path, odataType, body) {
const r = await fetch(_webUrl + path, {
method: 'POST',
headers: {
Accept: 'application/json;odata=verbose',
'Content-Type': 'application/json;odata=verbose',
'X-RequestDigest': await getDigest(),
'X-HTTP-Method': 'MERGE',
'IF-MATCH': '*',
},
credentials: 'same-origin',
body: JSON.stringify(Object.assign({ __metadata: { type: odataType } }, body)),
});
if (!r.ok) {
let msg = 'HTTP ' + r.status;
try {
const j = await r.json();
const m = j.error && j.error.message && (j.error.message.value || j.error.message);
if (m) msg += ' — ' + m;
} catch { }
throw new Error(msg);
}
}
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
const j = await spGet(lt(title) + "/fields?$select=Id&$filter=InternalName eq '" + internal + "'");
return !!(j.value && j.value.length);
}
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
let have = [];
try {
have = (await spGet(lt(title) + '/defaultview/viewfields')).Items || [];
} catch { }
for (const f of internals) {
if (have.includes(f)) continue;
try {
await spPost(lt(title) + "/defaultview/viewfields/addviewfield('" + f + "')");
} catch { }
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
const xmlEsc = (s) => String(s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const safeTitle = (s) => String(s).replace(/["[\]]/g, '');
async function createChoiceField(listTitle, internal, display, choices, fillIn) {
const xml = "<Field Type='Choice' DisplayName='" + internal + "' Name='" + internal +
"' StaticName='" + internal + "' Format='Dropdown' FillInChoice='" + (fillIn ? 'TRUE' : 'FALSE') + "'>" +
'<CHOICES>' + choices.map((c) => '<CHOICE>' + xmlEsc(c) + '</CHOICE>').join('') + '</CHOICES></Field>';
await spPost(lt(listTitle) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(listTitle) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
}
async function setChoices(listTitle, internal, display, choices, fillIn) {
if (!(await fieldExists(listTitle, internal))) {
await createChoiceField(listTitle, internal, display, choices, fillIn);
return;
}
const path = lt(listTitle) + "/fields/getbyinternalnameortitle('" + internal + "')";
try {
await spMerge(path, { Title: display, Choices: choices });
} catch {
await spMergeVerbose(path, 'SP.FieldChoice', { Title: display, Choices: { results: choices } });
}
}
async function ensureUserList(log) {
if (await listId(LIST_USERS)) return false;
log('「' + LIST_USERS + '」を作成中…');
await spPost('/_api/web/lists', { Title: LIST_USERS, BaseTemplate: 100, Description: '利用者の権限登録リスト(permreg)' });
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Title')", { Title: '利用者名' });
await ensureField(LIST_USERS, 'Company', '会社名', { FieldTypeKind: 2 });
await ensureField(LIST_USERS, 'Email', 'メールアドレス', { FieldTypeKind: 2 });
await createChoiceField(LIST_USERS, 'ChangeType', '変更区分', CHANGE_TYPE_DEFAULTS, true);
await createChoiceField(LIST_USERS, 'Permission', '権限', PERMISSION_DEFAULTS, true);
await ensureField(LIST_USERS, 'Notes', '特記事項', { FieldTypeKind: 3 });
await ensureField(LIST_USERS, 'AppliedDate', 'システム反映日', { FieldTypeKind: 4 });
await ensureField(LIST_USERS, 'SystemDeleted', 'システム削除', { FieldTypeKind: 8, DefaultValue: '0' });
await addViewFields(LIST_USERS, ['Company', 'Email', 'ChangeType', 'Permission', 'Notes', 'AppliedDate', 'SystemDeleted']);
return true;
}
async function syncMastersToUserList(state, log) {
const l1Order = new Map(state.l1.map((x, i) => [x.Id, i]));
const activeL1 = state.l1.filter((x) => x.Active !== false);
const activeL1Ids = new Set(activeL1.map((x) => x.Id));
const activeL2 = state.l2
.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id))
.sort((a, b) => (l1Order.get(a.Level1.Id) - l1Order.get(b.Level1.Id)) ||
((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
const summary = { createdList: false, l1Count: activeL1.length, added: 0, renamed: 0, l2Count: activeL2.length };
summary.createdList = await ensureUserList(log);
log(LABEL_L1 + 'の選択肢を更新中…');
await setChoices(LIST_USERS, 'OrgLevel1', LABEL_L1, activeL1.map((x) => x.Title), false);
log(LABEL_L2 + 'のチェック列を更新中…');
const existing = await spGet(lt(LIST_USERS) +
"/fields?$select=InternalName,Title&$filter=startswith(InternalName,'L2_')");
const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));
const titleCount = new Map();
activeL2.forEach((x) => titleCount.set(x.Title, (titleCount.get(x.Title) || 0) + 1));
const l1Title = new Map(state.l1.map((x) => [x.Id, x.Title]));
const displayOf = (x) => safeTitle(titleCount.get(x.Title) > 1
? x.Title + '(' + l1Title.get(x.Level1.Id) + ')' : x.Title);
const newCols = [];
for (const x of activeL2) {
const internal = 'L2_' + x.Id;
const display = displayOf(x);
if (!byInternal.has(internal)) {
const xml = "<Field Type='Boolean' DisplayName='" + internal + "' Name='" + internal +
"' StaticName='" + internal + "'><Default>0</Default></Field>";
await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
newCols.push(internal);
summary.added++;
} else if (byInternal.get(internal) !== display) {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
summary.renamed++;
}
}
log('集計列(' + LABEL_L2 + ')を更新中…');
const formula = activeL2.length
? '=' + activeL2.map((x) => 'IF([' + displayOf(x) + '],"☑","◽")&"' + displayOf(x) + '"')
.join('&" / "&')
: '=""';
if (!(await fieldExists(LIST_USERS, 'OrgLevel2'))) {
const refs = activeL2.map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
" ResultType='Text' ReadOnly='TRUE'><Formula>" + xmlEsc(formula) + '</Formula>' +
'<FieldRefs>' + refs + '</FieldRefs></Field>';
await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2 });
} else {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2, Formula: formula });
}
await addViewFields(LIST_USERS, ['OrgLevel1', 'OrgLevel2'].concat(newCols));
const orderedManaged = ['OrgLevel1', 'OrgLevel2'].concat(activeL2.map((x) => 'L2_' + x.Id));
try {
log('列の並び順を更新中…');
await applyColumnOrder(orderedManaged);
} catch (e) {
summary.orderWarn = e.message;
}
log('反映完了');
return summary;
}
async function applyColumnOrder(orderedManaged) {
let current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];
const counts = new Map();
current.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
let hadDupes = false;
for (const [n, c] of counts) {
if (c <= 1) continue;
hadDupes = true;
for (let i = 0; i < c; i++) {
try {
await spPost(lt(LIST_USERS) + "/defaultview/viewfields/removeviewfield('" + n + "')");
} catch { break; }
}
await spPost(lt(LIST_USERS) + "/defaultview/viewfields/addviewfield('" + n + "')");
}
if (hadDupes) {
current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];
}
const managedSet = new Set(orderedManaged);
const baseCount = current.filter((n) => !managedSet.has(n)).length;
const inView = orderedManaged.filter((n) => current.includes(n));
for (let i = 0; i < inView.length; i++) {
await spPost(lt(LIST_USERS) + '/defaultview/viewfields/moveviewfieldto',
{ field: inView[i], index: baseCount + i });
}
const cts = await spGet(lt(LIST_USERS) + "/contenttypes?$select=StringId");
const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
if (!ct) return;
const links = await spGet(lt(LIST_USERS) + "/contenttypes('" + ct.StringId + "')/fieldlinks?$select=Name");
const names = (links.value || []).map((f) => f.Name);
const ordered = names.filter((n) => !managedSet.has(n))
.concat(orderedManaged.filter((n) => names.includes(n)));
await spReorderContentTypeFields(LIST_USERS, ordered);
}
const ICONS = {
'chevron-up': '<path d="M6 15l6-6 6 6"/>',
'chevron-down': '<path d="M6 9l6 6 6-6"/>',
'edit-2': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
'trash-2': '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
'x': '<path d="M6 6l12 12M18 6L6 18"/>',
'refresh-cw': '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
'sync': '<path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
'gear': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
'plus': '<path d="M12 5v14M5 12h14"/>',
'copy': '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
};
const ico = (n) => '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.7"' +
' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
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
#${ROOT_ID} .pr-utable{ width:100%; border-collapse:collapse; font-size:var(--fs-md); table-layout:fixed; }
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
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:top;
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
  display:inline-block; font-size:var(--fs-xs); font-family:var(--font-mono);
  border-radius:var(--r-2); padding:0 var(--s-2); margin-right:var(--s-2); line-height:1.6;
}
#${ROOT_ID} .pr-badge--new{ background:var(--accent); color:#ffffff; }
#${ROOT_ID} .pr-badge--upd{ background:var(--warn); color:#ffffff; }
#${ROOT_ID} .pr-badge--del{ background:var(--paper-3); color:var(--ink-3); }
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
#${ROOT_ID} .pr-modal--form{ width:min(640px, 92vw); max-height:calc(100vh - 80px); overflow:auto; }
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
#${ROOT_ID} .pr-modal .pr-ta-sm{ min-height:80px !important; }
#${ROOT_ID} .pr-modal .pr-modal-ta{
  min-height:160px !important; max-height:55vh !important;
  padding:var(--s-3) var(--s-4) var(--s-5) !important;
  resize:none !important; overflow:auto !important; line-height:1.6 !important;
}
#${ROOT_ID} .pr-modal-actions{ display:flex; justify-content:flex-end; gap:var(--s-3); margin-top:var(--s-2); }
`;
let _root = null;
function setRoot(root) {
_root = root;
}
const esc = (s) => String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function el(html) {
const t = document.createElement('template');
t.innerHTML = html.trim();
return t.content.firstElementChild;
}
function toast(kind, msg) {
let host = _root.querySelector('.pr-toasts');
if (!host) {
host = el('<div class="pr-toasts" role="status" aria-live="polite"></div>');
_root.appendChild(host);
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
function modal({ title, message, inputValue, multiline, okLabel, danger }) {
return new Promise((resolve) => {
const hasInput = inputValue !== undefined;
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <h4></h4>
          ${message != null ? '<div class="pr-modal-msg"></div>' : ''}
          ${hasInput ? (multiline
? '<textarea class="pr-input pr-modal-ta" rows="8"></textarea>'
: '<input class="pr-input" type="text">') : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn ${danger ? 'pr-btn--danger' : 'pr-btn--primary'}" data-mact="ok"></button>
          </div>
        </div>
      </div>`);
back.querySelector('h4').textContent = title;
if (message != null) back.querySelector('.pr-modal-msg').textContent = message;
const input = back.querySelector('input, textarea');
if (input) input.value = inputValue;
if (input && multiline) {
const fit = () => {
input.style.height = 'auto';
input.style.height = Math.min(input.scrollHeight + 4, window.innerHeight * 0.55) + 'px';
};
input.addEventListener('input', fit);
setTimeout(fit, 0);
}
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
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (hasInput && !multiline && e.target === input))) ok();
};
document.addEventListener('keydown', onKey, true);
_root.appendChild(back);
(input || back.querySelector('[data-mact="ok"]')).focus();
if (input) input.select();
});
}
const GRID_W = 'permreg.colw.';
const GRID_O = 'permreg.colorder.';
const GRID_S = 'permreg.sort.';
function gridColWidth(tableKey, colKey, fallback) {
const v = parseInt(localStorage.getItem(GRID_W + tableKey + ':' + colKey) || '', 10);
return Number.isFinite(v) ? v + 'px' : fallback;
}
function gridWriteWidth(tableKey, colKey, w) {
localStorage.setItem(GRID_W + tableKey + ':' + colKey, String(w));
}
function gridRemoveWidth(tableKey, colKey) {
localStorage.removeItem(GRID_W + tableKey + ':' + colKey);
}
function gridResolveOrder(tableKey, defaultKeys) {
let saved = null;
try {
saved = JSON.parse(localStorage.getItem(GRID_O + tableKey) || 'null');
} catch { }
if (!Array.isArray(saved)) return [...defaultKeys];
const known = new Set(defaultKeys);
const ordered = saved.filter((k) => known.has(k));
for (let i = 0; i < defaultKeys.length; i++) {
const k = defaultKeys[i];
if (ordered.includes(k)) continue;
let insertAt = null;
for (let j = i - 1; j >= 0; j--) {
const idx = ordered.indexOf(defaultKeys[j]);
if (idx >= 0) { insertAt = idx + 1; break; }
}
if (insertAt == null) {
for (let j = i + 1; j < defaultKeys.length; j++) {
const idx = ordered.indexOf(defaultKeys[j]);
if (idx >= 0) { insertAt = idx; break; }
}
}
ordered.splice(insertAt == null ? ordered.length : insertAt, 0, k);
}
return ordered;
}
function gridWriteOrder(tableKey, keys) {
localStorage.setItem(GRID_O + tableKey, JSON.stringify(keys));
}
function gridResetOrder(tableKey) {
localStorage.removeItem(GRID_O + tableKey);
}
function gridSort(tableKey, defaultBy) {
try {
const v = JSON.parse(localStorage.getItem(GRID_S + tableKey) || 'null');
if (v && v.by) return v;
} catch { }
return { by: defaultBy, dir: 'desc' };
}
function gridSetSort(tableKey, by, dir) {
localStorage.setItem(GRID_S + tableKey, JSON.stringify({ by, dir }));
}
function attachGrid(table, opts) {
const cols = [...table.querySelectorAll('colgroup col')];
const ths = [...table.querySelectorAll('thead th')];
const minWidth = opts.minWidth || 48;
ths.forEach((th, i) => {
const key = opts.colKeys[i];
if (!key) return;
th.style.position = 'relative';
const handle = document.createElement('span');
handle.className = 'pr-col-resize';
handle.setAttribute('aria-hidden', 'true');
th.appendChild(handle);
handle.addEventListener('pointerdown', (e) => {
e.preventDefault();
e.stopPropagation();
const startX = e.clientX;
const col = cols[i];
cols.forEach((c, ci) => {
if (ci !== i && !c.style.width && ths[ci]) {
c.style.width = Math.round(ths[ci].getBoundingClientRect().width) + 'px';
}
});
const startW = th.getBoundingClientRect().width;
document.body.style.cursor = 'col-resize';
handle.classList.add('dragging');
const onMove = (ev) => {
const w = Math.max(minWidth, Math.round(startW + ev.clientX - startX));
if (col) col.style.width = w + 'px';
};
const onUp = () => {
document.removeEventListener('pointermove', onMove);
document.removeEventListener('pointerup', onUp);
document.body.style.cursor = '';
handle.classList.remove('dragging');
gridWriteWidth(opts.tableKey, key, Math.round(th.getBoundingClientRect().width));
};
document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);
});
handle.addEventListener('dblclick', (e) => {
e.preventDefault();
e.stopPropagation();
if (cols[i]) cols[i].style.width = '';
gridRemoveWidth(opts.tableKey, key);
});
th.title = 'ドラッグで列順変更 / クリックで並び替え / 右クリックで列順リセット';
th.addEventListener('pointerdown', (e) => {
if (e.button !== 0 || e.target === handle) return;
const startX = e.clientX;
let dragging = false;
const mark = (t) => {
ths.forEach((h) => { h.style.boxShadow = ''; });
if (t && t !== th && opts.colKeys[ths.indexOf(t)]) {
t.style.boxShadow = 'inset 2px 0 0 0 var(--accent)';
}
};
const targetTh = (ev) => {
const n = document.elementFromPoint(ev.clientX, ev.clientY);
const t = n && n.closest('th');
return t && ths.includes(t) ? t : null;
};
const onMove = (ev) => {
if (!dragging && Math.abs(ev.clientX - startX) > 6) {
dragging = true;
th.style.opacity = '0.5';
document.body.style.cursor = 'grabbing';
}
if (dragging) mark(targetTh(ev));
};
const onUp = (ev) => {
document.removeEventListener('pointermove', onMove);
document.removeEventListener('pointerup', onUp);
mark(null);
th.style.opacity = '';
document.body.style.cursor = '';
if (!dragging) return;
table.dataset.dragJustEnded = '1';
setTimeout(() => { delete table.dataset.dragJustEnded; }, 0);
const t = targetTh(ev);
const toKey = t && t !== th ? opts.colKeys[ths.indexOf(t)] : null;
if (toKey) opts.onReorder(key, toKey);
};
document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);
});
th.addEventListener('contextmenu', (e) => {
e.preventDefault();
gridResetOrder(opts.tableKey);
opts.onReorder(null, null);
});
});
}
function notifyReadAt() {
return +(localStorage.getItem(LS_NOTIFY_READAT) || 0);
}
function notifyMarkRead() {
localStorage.setItem(LS_NOTIFY_READAT, String(Date.now()));
}
function notifyEvents() {
try {
const v = JSON.parse(localStorage.getItem(LS_NOTIFY_EVENTS) || '[]');
return Array.isArray(v) ? v : [];
} catch {
return [];
}
}
function notifyAdd(events) {
if (!events.length) return;
localStorage.setItem(LS_NOTIFY_EVENTS, JSON.stringify(events.concat(notifyEvents()).slice(0, 50)));
}
function notifyUnreadCount() {
const r = notifyReadAt();
return notifyEvents().filter((e) => e.ts > r).length;
}
function userBadge(u, readAt) {
const created = Date.parse(u.Created || '') || 0;
const modified = Date.parse(u.Modified || '') || 0;
if (created > readAt) return 'new';
if (modified > readAt) return 'upd';
return null;
}
function diffUsers(prev, next) {
const ts = Date.now();
const prevMap = new Map(prev.map((x) => [x.Id, x]));
const nextIds = new Set(next.map((x) => x.Id));
const events = [];
for (const n of next) {
const p = prevMap.get(n.Id);
if (!p) events.push({ ts, kind: 'new', title: n.Title || ('#' + n.Id) });
else if (p.Modified !== n.Modified) events.push({ ts, kind: 'upd', title: n.Title || ('#' + n.Id) });
}
for (const p of prev) {
if (!nextIds.has(p.Id)) events.push({ ts, kind: 'del', title: p.Title || ('#' + p.Id) });
}
return events;
}
function notifyViewHtml() {
const events = notifyEvents();
const readAt = notifyReadAt();
const kindChip = (k) => k === 'new'
? '<span class="pr-badge pr-badge--new">NEW</span>'
: k === 'upd'
? '<span class="pr-badge pr-badge--upd">更新</span>'
: '<span class="pr-badge pr-badge--del">削除</span>';
const kindText = { new: 'が追加されました', upd: 'が更新されました', del: 'が削除されました' };
const fmt = (ts) => {
const d = new Date(ts);
const pad = (n) => String(n).padStart(2, '0');
return d.getMonth() + 1 + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
const rows = events.map((e) => `
    <div class="pr-notif${e.ts > readAt ? ' unread' : ''}">
      <span class="pr-notif-time">${fmt(e.ts)}</span>
      ${kindChip(e.kind)}
      <span class="pr-notif-msg">「${esc(e.title)}」${kindText[e.kind] || ''}</span>
    </div>`).join('');
return `
    <div class="pr-sub"><b>通知</b><span class="pr-count">${events.length}件 / 未読 ${notifyUnreadCount()}件</span>
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--ghost pr-btn--sm" data-act="notify-read">すべて既読にする</button>
    </div>
    <div class="pr-rows">${rows || '<div class="pr-empty">通知はありません。「' + esc(LIST_USERS) + '」の追加・更新・削除を検知するとここに表示されます。</div>'}</div>`;
}
function activeL2Of(state, l1Title) {
const l1 = state.l1.find((x) => x.Title === l1Title && x.Active !== false);
if (!l1) return [];
return state.l2
.filter((x) => x.Active !== false && x.Level1 && x.Level1.Id === l1.Id)
.sort((a, b) => ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
}
const USERS_GRID_KEY = 'users';
const selectedUserIds = new Set();
const userFilter = { q: '', changeType: '', permission: '', org1: '', showDeleted: false };
const USER_COLS = [
{ key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
{ key: 'company', label: '会社名', w: '140px', val: (u) => u.Company || '' },
{ key: 'email', label: 'メールアドレス', w: '180px', val: (u) => u.Email || '' },
{ key: 'changeType', label: '変更区分', w: '90px', val: (u) => u.ChangeType || '' },
{ key: 'permission', label: '権限', w: '90px', val: (u) => u.Permission || '' },
{ key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },
{ key: 'org2', label: '', w: '220px', val: null },
{ key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];
function userOrg2Text(state, item) {
const names = [];
for (const m of state.l2) {
if (item['L2_' + m.Id] === true) names.push('☑' + m.Title);
}
return names.join(' / ');
}
function userColLabel(c) {
if (c.key === 'org1') return LABEL_L1;
if (c.key === 'org2') return LABEL_L2;
return c.label;
}
function userCellText(state, c, u) {
if (c.key === 'org2') return userOrg2Text(state, u);
if (c.key === 'modified') {
const d = new Date(u.Modified || '');
if (isNaN(+d)) return '';
const pad = (n) => String(n).padStart(2, '0');
return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' +
pad(d.getHours()) + ':' + pad(d.getMinutes());
}
return c.val(u);
}
function visibleUsers(state) {
const f = userFilter;
const q = f.q.trim().toLowerCase();
let list = state.users.filter((u) => {
if (!f.showDeleted && u.SystemDeleted === true) return false;
if (f.changeType && u.ChangeType !== f.changeType) return false;
if (f.permission && u.Permission !== f.permission) return false;
if (f.org1 && u.OrgLevel1 !== f.org1) return false;
if (q) {
const hay = USER_COLS.map((c) => userCellText(state, c, u)).join(' ').toLowerCase();
if (!hay.includes(q)) return false;
}
return true;
});
const s = gridSort(USERS_GRID_KEY, 'modified');
const col = USER_COLS.find((c) => c.key === s.by) || USER_COLS[USER_COLS.length - 1];
const dir = s.dir === 'asc' ? 1 : -1;
list = [...list].sort((a, b) => {
const va = userCellText(state, col, a);
const vb = userCellText(state, col, b);
return va.localeCompare(vb, 'ja') * dir || (a.Id - b.Id) * dir;
});
return list;
}
function usersViewHtml(state) {
if (!state.usersReady) {
return `
      <div class="pr-hero">
        <h4>「${esc(LIST_USERS)}」リストがまだありません</h4>
        <p>マスタ管理で組織区分を登録し、「リストへ反映」を実行するとリストが作成されます。</p>
        <button class="pr-btn pr-btn--primary" data-act="nav" data-view="master">マスタ管理を開く</button>
      </div>`;
}
const ids = new Set(state.users.map((u) => u.Id));
for (const id of [...selectedUserIds]) if (!ids.has(id)) selectedUserIds.delete(id);
const list = visibleUsers(state);
const readAt = notifyReadAt();
const sel = selectedUserIds.size;
const sort = gridSort(USERS_GRID_KEY, 'modified');
const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
const cols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);
const selOpts = (opts, cur) => '<option value="">すべて</option>' +
opts.map((o) => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
const org1Opts = state.l1.filter((x) => x.Active !== false).map((x) => x.Title);
const badgeHtml = (u) => {
const parts = [];
const b = userBadge(u, readAt);
if (b === 'new') parts.push('<span class="pr-badge pr-badge--new">NEW</span>');
if (b === 'upd') parts.push('<span class="pr-badge pr-badge--upd">更新</span>');
if (u.SystemDeleted === true) parts.push('<span class="pr-badge pr-badge--del">削除済</span>');
return parts.join('');
};
const thHtml = cols.map((c) => {
const active = sort.by === c.key;
const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
return '<th class="pr-th-sort' + (active ? ' active' : '') + '" data-col="' + c.key + '">' +
esc(userColLabel(c)) + arrow + '</th>';
}).join('');
const rowHtml = (u) => `
    <tr data-uid="${u.Id}" class="${u.SystemDeleted === true ? 'pr-udel' : ''}">
      <td class="pr-uchk"><input type="checkbox" data-usel="${u.Id}" aria-label="選択" ${selectedUserIds.has(u.Id) ? 'checked' : ''}></td>
      ${cols.map((c) => '<td>' + (c.key === 'name' ? badgeHtml(u) : '') + esc(userCellText(state, c, u)) + '</td>').join('')}
    </tr>`;
return `
    <div class="pr-sub pr-sub--users">
      ${sel
? `<b>選択中 ${sel}件</b>
           <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-bulk">一括変更</button>
           <button class="pr-btn pr-btn--sm pr-btn--danger" data-act="user-del-selected">物理削除</button>
           <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-clear-sel">選択解除</button>`
: `<b>利用者一覧</b><span class="pr-count">${list.length}件${list.length !== state.users.length ? ' / 全' + state.users.length + '件' : ''}</span>`}
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-add">${ico('plus')}新規登録</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-ufilter-q" placeholder="検索(全列)" value="${esc(userFilter.q)}">
      <select class="pr-input pr-fsel" id="pr-ufilter-ct" title="変更区分">${selOpts(state.choices.changeType, userFilter.changeType)}</select>
      <select class="pr-input pr-fsel" id="pr-ufilter-pm" title="権限">${selOpts(state.choices.permission, userFilter.permission)}</select>
      <select class="pr-input pr-fsel" id="pr-ufilter-o1" title="${esc(LABEL_L1)}">${selOpts(org1Opts, userFilter.org1)}</select>
      <label class="pr-check"><input type="checkbox" id="pr-ufilter-del" ${userFilter.showDeleted ? 'checked' : ''}>削除済も表示</label>
    </div>
    <div class="pr-rows">
      <table class="pr-utable" data-grid="users">
        <colgroup>
          <col style="width:34px">
          ${cols.map((c) => '<col style="width:' + gridColWidth(USERS_GRID_KEY, c.key, c.w) + '">').join('')}
        </colgroup>
        <thead><tr>
          <th class="pr-uchk"><input type="checkbox" data-usel-all aria-label="すべて選択" ${list.length && list.every((u) => selectedUserIds.has(u.Id)) ? 'checked' : ''}></th>
          ${thHtml}
        </tr></thead>
        <tbody>${list.map(rowHtml).join('') ||
'<tr><td colspan="' + (cols.length + 1) + '" class="pr-empty">該当する利用者がありません</td></tr>'}</tbody>
      </table>
    </div>`;
}
function usersAfterRender(app, state, ctx) {
const table = app.querySelector('.pr-utable[data-grid="users"]');
if (!table) return;
const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
attachGrid(table, {
tableKey: USERS_GRID_KEY,
colKeys: [null].concat(order),
onReorder: (fromKey, toKey) => {
if (fromKey && toKey) {
const cur = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
gridWriteOrder(USERS_GRID_KEY, cur);
}
ctx.rerender();
},
});
table.querySelector('thead').addEventListener('click', (e) => {
if (table.dataset.dragJustEnded) return;
if (e.target.closest('[data-usel-all]')) return;
const th = e.target.closest('th[data-col]');
if (!th) return;
const s = gridSort(USERS_GRID_KEY, 'modified');
gridSetSort(USERS_GRID_KEY, th.dataset.col,
s.by === th.dataset.col ? (s.dir === 'asc' ? 'desc' : 'asc') : (th.dataset.col === 'modified' ? 'desc' : 'asc'));
ctx.rerender();
});
const reflow = () => {
const tmp = document.createElement('div');
tmp.innerHTML = usersViewHtml(state);
table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
};
app.querySelector('#pr-ufilter-q').addEventListener('input', (e) => {
userFilter.q = e.target.value;
reflow();
});
const bindSel = (id, prop) => {
app.querySelector(id).addEventListener('change', (e) => {
userFilter[prop] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
ctx.rerender();
});
};
bindSel('#pr-ufilter-ct', 'changeType');
bindSel('#pr-ufilter-pm', 'permission');
bindSel('#pr-ufilter-o1', 'org1');
bindSel('#pr-ufilter-del', 'showDeleted');
table.addEventListener('click', (e) => {
const chkAll = e.target.closest('[data-usel-all]');
if (chkAll) {
e.stopPropagation();
const list = visibleUsers(state);
const all = list.length && list.every((u) => selectedUserIds.has(u.Id));
list.forEach((u) => { all ? selectedUserIds.delete(u.Id) : selectedUserIds.add(u.Id); });
ctx.rerender();
return;
}
const chk = e.target.closest('[data-usel]');
if (chk) {
e.stopPropagation();
const id = +chk.dataset.usel;
chk.checked ? selectedUserIds.add(id) : selectedUserIds.delete(id);
ctx.rerender();
return;
}
const tr = e.target.closest('tr[data-uid]');
if (!tr) return;
if (window.getSelection && String(window.getSelection())) return;
const item = state.users.find((u) => u.Id === +tr.dataset.uid);
if (item) ctx.onEdit(item);
});
}
function openUserForm(state, onSubmit, existing) {
return new Promise((resolve) => {
const isEdit = !!existing;
const activeL1 = state.l1.filter((x) => x.Active !== false);
const fieldRow = (label, inner) => `
      <div class="pr-field"><label>${label}</label>${inner}</div>`;
const selOpts = (opts, cur) => opts.map((c) =>
'<option' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="${isEdit ? '利用者の編集' : '利用者の新規登録'}">
          <h4>${isEdit ? '利用者の編集' : '利用者の新規登録'}</h4>
          ${fieldRow('利用者名 <span class="pr-req">*</span>', '<input type="text" class="pr-input" id="uf-name">')}
          ${fieldRow('会社名', '<input type="text" class="pr-input" id="uf-company">')}
          ${fieldRow('メールアドレス', '<input type="text" class="pr-input" id="uf-email">')}
          ${fieldRow('変更区分', `<select class="pr-input" id="uf-changetype">${selOpts(state.choices.changeType, existing && existing.ChangeType)}</select>`)}
          ${fieldRow('権限', `<select class="pr-input" id="uf-perm">${selOpts(state.choices.permission, existing && existing.Permission)}</select>`)}
          ${fieldRow(esc(LABEL_L1), `<select class="pr-input" id="uf-l1">${
activeL1.map((x) => '<option' + (existing && existing.OrgLevel1 === x.Title ? ' selected' : '') + '>' + esc(x.Title) + '</option>').join('')}</select>`)}
          <div class="pr-field">
            <div class="pr-field-row">
              <label>${esc(LABEL_L2)}</label>
              <button type="button" class="pr-btn pr-btn--ghost pr-btn--sm" data-ufact="all">すべて</button>
            </div>
            <div class="pr-checks" id="uf-l2"></div>
          </div>
          ${fieldRow('特記事項', '<textarea class="pr-input pr-modal-ta" id="uf-notes" rows="3"></textarea>')}
          ${isEdit ? `
          <label class="pr-check"><input type="checkbox" id="uf-sysdel" ${existing.SystemDeleted === true ? 'checked' : ''}>
            システム削除(論理削除)</label>` : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">${isEdit ? '保存' : '登録する'}</button>
          </div>
        </div>
      </div>`);
if (existing) {
back.querySelector('#uf-name').value = existing.Title || '';
back.querySelector('#uf-company').value = existing.Company || '';
back.querySelector('#uf-email').value = existing.Email || '';
back.querySelector('#uf-notes').value = existing.Notes || '';
}
const l1Sel = back.querySelector('#uf-l1');
const l2Box = back.querySelector('#uf-l2');
const renderL2 = () => {
const list = activeL2Of(state, l1Sel.value);
l2Box.innerHTML = list.length
? list.map((x) => `
            <label class="pr-check"><input type="checkbox" data-l2="${x.Id}"${
existing && existing['L2_' + x.Id] === true ? ' checked' : ''}>${esc(x.Title)}</label>`).join('')
: '<span class="pr-note">この' + LABEL_L1 + 'に有効な' + LABEL_L2 + 'はありません</span>';
};
l1Sel.addEventListener('change', renderL2);
renderL2();
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
const ok = async () => {
const name = back.querySelector('#uf-name').value.trim();
if (!name) {
toast('warn', '利用者名は必須です');
back.querySelector('#uf-name').focus();
return;
}
const body = {
Title: name,
Company: back.querySelector('#uf-company').value.trim(),
Email: back.querySelector('#uf-email').value.trim(),
ChangeType: back.querySelector('#uf-changetype').value,
Permission: back.querySelector('#uf-perm').value,
OrgLevel1: l1Sel.value || '',
Notes: back.querySelector('#uf-notes').value.trim(),
};
for (const cb of l2Box.querySelectorAll('input[data-l2]')) {
if (cb.checked) body['L2_' + cb.dataset.l2] = true;
}
if (isEdit) {
for (const k of Object.keys(existing)) {
if (k.startsWith('L2_') && existing[k] === true && !(k in body)) body[k] = false;
}
body.SystemDeleted = back.querySelector('#uf-sysdel').checked;
}
const okBtn = back.querySelector('[data-mact="ok"]');
okBtn.disabled = true;
try {
const result = await onSubmit(body);
done(result === undefined ? body : result);
} catch (e) {
toast('err', (isEdit ? '保存' : '登録') + 'に失敗しました — ' + e.message);
okBtn.disabled = false;
}
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
const allBtn = e.target.closest('[data-ufact="all"]');
if (allBtn) {
const cbs = [...l2Box.querySelectorAll('input[data-l2]')];
const allChecked = cbs.length > 0 && cbs.every((c) => c.checked);
cbs.forEach((c) => { c.checked = !allChecked; });
return;
}
if (e.target === back) {
if (downOnBack) done(null);
return;
}
const b = e.target.closest('[data-mact]');
if (b) (b.dataset.mact === 'ok' ? ok() : done(null));
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(null); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok();
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('#uf-name').focus();
});
}
function openBulkModal(state, count) {
return new Promise((resolve) => {
const KEEP = '（変更しない）';
const sel = (id, opts) => `<select class="pr-input" id="${id}">` +
['<option>' + KEEP + '</option>'].concat(opts.map((o) => '<option>' + esc(o) + '</option>')).join('') +
'</select>';
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="一括変更">
          <h4>一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更区分</label>${sel('bk-ct', state.choices.changeType)}</div>
          <div class="pr-field"><label>権限</label>${sel('bk-pm', state.choices.permission)}</div>
          <div class="pr-field"><label>システム削除(論理削除)</label>${sel('bk-del', ['削除する', '解除する'])}</div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">適用する</button>
          </div>
        </div>
      </div>`);
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
const ok = () => {
const changes = {};
const KEEPV = KEEP;
const ct = back.querySelector('#bk-ct').value;
const pm = back.querySelector('#bk-pm').value;
const dl = back.querySelector('#bk-del').value;
if (ct !== KEEPV) changes.ChangeType = ct;
if (pm !== KEEPV) changes.Permission = pm;
if (dl !== KEEPV) changes.SystemDeleted = dl === '削除する';
if (!Object.keys(changes).length) {
toast('warn', '変更する項目がありません');
return;
}
done(changes);
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) done(null);
return;
}
const b = e.target.closest('[data-mact]');
if (b) (b.dataset.mact === 'ok' ? ok() : done(null));
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(null); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok();
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('#bk-ct').focus();
});
}
function openSettingsModal(state) {
return new Promise((resolve) => {
openSettingsModalInner(state, resolve);
});
}
function openSettingsModalInner(state, resolve) {
const srcInfo = (window.__permregSource && window.__permregSource.base) || '直接実行(埋め込み/開発コンソール)';
const isLocal = localStorage.getItem(LS_DEV_SOURCE) === 'local';
const localBase = localStorage.getItem(LS_DEV_BASE) || DEFAULT_LOCAL_BASE;
const back = el(`
    <div class="pr-backdrop">
      <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="設定">
        <h4>設定</h4>
        <div class="pr-kv">バージョン: <code>${esc(BUILD)}</code> / 今回の読込元: <code>${esc(srcInfo)}</code></div>
        <div class="pr-field">
          <label>bundle の配信元(ブックマークレット起動時にどこから本体を読むか)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${isLocal ? '' : 'checked'}>
            SharePoint (ドキュメント/permreg/ に配置した dist)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="local" ${isLocal ? 'checked' : ''}>
            ローカル開発サーバ(開発者モード)</label>
        </div>
        <div class="pr-field">
          <label>ローカル配信 URL(開発者モード時)</label>
          <input type="text" class="pr-input" id="pr-dev-base" value="${esc(localBase)}" placeholder="${esc(DEFAULT_LOCAL_BASE)}">
          <span class="pr-note">リポジトリで <code>python dev/serve.py</code> を起動して配信します。</span>
        </div>
        <div class="pr-field">
          <label>配信フォルダ(ローカル配信サーバが参照するフォルダ)</label>
          <input type="text" class="pr-input" id="pr-bundle-dir" placeholder="配信サーバから取得中…">
          <span class="pr-note">permreg.bundle.js を含むフォルダの絶対パス。保存で即切替(サーバ再起動で既定の dist/ に戻る)。</span>
        </div>
        <div class="pr-field">
          <label>「変更区分」の選択肢(1行1件。利用者一覧リストの列に反映)</label>
          <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-ct" rows="4" ${state.usersReady ? '' : 'disabled'}></textarea>
        </div>
        <div class="pr-field">
          <label>「権限」の選択肢(1行1件)</label>
          <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-pm" rows="3" ${state.usersReady ? '' : 'disabled'}></textarea>
          ${state.usersReady ? '' : '<span class="pr-note">「リストへ反映」で利用者一覧リストを作成すると編集できます。</span>'}
        </div>
        <span class="pr-note">配信設定は次回のブックマークレット起動から反映されます。選択肢は保存時に即反映されます。</span>
        <div class="pr-modal-actions">
          <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
        </div>
      </div>
    </div>`);
const dirInput = back.querySelector('#pr-bundle-dir');
(async () => {
const base = localBase.replace(/\/+$/, '');
try {
const r = await fetch(base + '/bundle-dir?t=' + Date.now());
if (!r.ok) throw new Error('HTTP ' + r.status);
dirInput.value = (await r.json()).dir || '';
dirInput.dataset.loaded = '1';
} catch {
dirInput.placeholder = '配信サーバに接続できません(python dev/serve.py を起動して開き直し)';
dirInput.disabled = true;
}
})();
back.querySelector('#pr-choice-ct').value = state.choices.changeType.join('\n');
back.querySelector('#pr-choice-pm').value = state.choices.permission.join('\n');
const close = () => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve();
};
const save = async () => {
if (state.usersReady) {
const parseLines = (id) => [...new Set(back.querySelector(id).value
.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
const ct = parseLines('#pr-choice-ct');
const pm = parseLines('#pr-choice-pm');
if (!ct.length || !pm.length) {
toast('warn', '変更区分/権限の選択肢は1件以上必要です');
return;
}
const changedCt = ct.join('\n') !== state.choices.changeType.join('\n');
const changedPm = pm.join('\n') !== state.choices.permission.join('\n');
if (changedCt || changedPm) {
try {
if (changedCt) await setChoices(LIST_USERS, 'ChangeType', '変更区分', ct, true);
if (changedPm) await setChoices(LIST_USERS, 'Permission', '権限', pm, true);
state.choices = { changeType: ct, permission: pm };
} catch (e) {
toast('err', '選択肢の更新に失敗しました — ' + e.message);
return;
}
}
}
const local = back.querySelector('input[name="pr-src"][value="local"]').checked;
const base = back.querySelector('#pr-dev-base').value.trim().replace(/\/+$/, '') || DEFAULT_LOCAL_BASE;
if (local) {
localStorage.setItem(LS_DEV_SOURCE, 'local');
localStorage.setItem(LS_DEV_BASE, base);
} else {
localStorage.removeItem(LS_DEV_SOURCE);
}
if (local && dirInput.dataset.loaded && dirInput.value.trim()) {
try {
const r = await fetch(base + '/bundle-dir', {
method: 'POST',
body: JSON.stringify({ dir: dirInput.value.trim() }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
toast('ok', '保存しました(配信フォルダ: ' + j.dir + ')');
} catch (e) {
toast('err', '配信フォルダの変更に失敗しました — ' + e.message);
return;
}
} else {
toast('ok', '保存しました');
}
close();
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) close();
return;
}
const b = e.target.closest('[data-mact]');
if (b) (b.dataset.mact === 'ok' ? save() : close());
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); close(); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('input[name="pr-src"]:checked').focus();
}
const CHECK_INTERVAL = 30000;
function applyUpdate(src, ver) {
window.__permregSource = Object.assign({}, src, { ver });
if (src.dev) {
fetch(src.base + '/permreg.bundle.js?v=' + encodeURIComponent(ver))
.then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
.then((t) => { (0, eval)(t); })
.catch((e) => toast('err', '自動更新に失敗しました — ' + (e && e.message || e)));
} else {
const o = document.getElementById('permreg-script');
if (o) o.remove();
const s = document.createElement('script');
s.id = 'permreg-script';
s.src = src.base + '/permreg.bundle.js?v=' + encodeURIComponent(ver);
s.onerror = () => toast('err', '自動更新に失敗しました (script load error)');
document.body.appendChild(s);
}
}
function startUpdateWatcher(build) {
if (window.__permregWatcher) clearInterval(window.__permregWatcher);
if (window.__permregOnVisible) document.removeEventListener('visibilitychange', window.__permregOnVisible);
const src = window.__permregSource;
if (!src || !src.base) return;
let prompting = false;
let skippedVer = '';
async function check() {
if (prompting) return;
let ver = '';
try {
const r = await fetch(src.base + '/version.txt?t=' + Date.now(), { credentials: 'same-origin' });
if (!r.ok) return;
ver = (await r.text()).trim();
} catch {
return;
}
if (!ver || ver === build || ver === skippedVer) return;
prompting = true;
const ok = await modal({
title: '更新があります',
message: '新しいバージョン ' + ver + ' が配信されています(実行中: ' + build + ')。' +
'今すぐ更新しますか? 編集途中の入力は失われます。',
okLabel: '今すぐ更新',
});
if (ok) {
applyUpdate(src, ver);
return;
}
skippedVer = ver;
prompting = false;
}
window.__permregWatcher = setInterval(() => { if (!document.hidden) check(); }, CHECK_INTERVAL);
window.__permregOnVisible = () => { if (!document.hidden) check(); };
document.addEventListener('visibilitychange', window.__permregOnVisible);
window.__permregCheckNow = check;
}
(() => {
'use strict';
const prev = document.getElementById(ROOT_ID);
if (prev) prev.remove();
const state = {
view: 'master',
l1: [],
l2: [],
selectedL1: null,
ready: false,
usersReady: false,
users: [],
choices: { changeType: CHANGE_TYPE_DEFAULTS, permission: PERMISSION_DEFAULTS },
busy: false,
};
function guessWebUrl() {
try {
if (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) {
return window._spPageContextInfo.webAbsoluteUrl;
}
} catch { }
const m = location.href.match(/^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/);
return m ? m[1] : location.origin;
}
setWebUrl(localStorage.getItem(LS_WEB_URL) || guessWebUrl());
async function checkReady() {
state.ready = !!(await listId(LIST_L1)) && !!(await listId(LIST_L2));
state.usersReady = !!(await listId(LIST_USERS));
}
async function loadAll() {
const [r1, r2, ru] = await Promise.all([
spGet(lt(LIST_L1) + '/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999'),
spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
state.usersReady
? spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999')
: Promise.resolve({ value: [] }),
]);
state.l1 = r1.value || [];
state.l2 = r2.value || [];
state.users = ru.value || [];
if (state.usersReady) {
try {
const [ct, pm] = await Promise.all([
spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('ChangeType')?$select=Choices"),
spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Permission')?$select=Choices"),
]);
state.choices = {
changeType: (ct.Choices && ct.Choices.length) ? ct.Choices : CHANGE_TYPE_DEFAULTS,
permission: (pm.Choices && pm.Choices.length) ? pm.Choices : PERMISSION_DEFAULTS,
};
} catch { }
}
if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;
}
const nextOrder = (items) => items.reduce((m, x) => Math.max(m, x.SortOrder || 0), 0) + 10;
const addItem = (listTitle, body) => spPost(lt(listTitle) + '/items', body);
const updateItem = (listTitle, id, body) => spMerge(lt(listTitle) + '/items(' + id + ')', body);
const deleteItem = (listTitle, id) => spDelete(lt(listTitle) + '/items(' + id + ')');
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
const root = document.createElement('div');
root.id = ROOT_ID;
const styleEl = document.createElement('style');
styleEl.textContent = css;
root.appendChild(styleEl);
const app = document.createElement('div');
app.className = 'pr-app';
root.appendChild(app);
document.body.appendChild(root);
setRoot(root);
function setStatus(msg) {
const f = root.querySelector('.pr-status');
if (f) f.textContent = msg;
}
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
async function ensureCheckedL2Cols(body) {
const l2Keys = Object.keys(body).filter((k) => k.startsWith('L2_'));
if (!l2Keys.length) return;
const existing = await spGet(lt(LIST_USERS) +
"/fields?$select=InternalName&$filter=startswith(InternalName,'L2_')");
const have = new Set((existing.value || []).map((f) => f.InternalName));
if (l2Keys.some((k) => !have.has(k))) {
setStatus('マスタ未反映分をリストへ反映中…');
await syncMastersToUserList(state, setStatus);
}
}
async function userAddFlow() {
const result = await openUserForm(state, async (body) => {
await ensureCheckedL2Cols(body);
await addItem(LIST_USERS, body);
return body.Title;
});
if (!result) return;
run('登録', async () => {
await reload();
toast('ok', '「' + result + '」を登録しました');
});
}
async function userEditFlow(item) {
const result = await openUserForm(state, async (body) => {
await ensureCheckedL2Cols(body);
await updateItem(LIST_USERS, item.Id, body);
return body.Title;
}, item);
if (!result) return;
run('保存', async () => {
await reload();
toast('ok', '「' + result + '」を保存しました');
});
}
async function userBulkFlow() {
const ids = [...selectedUserIds];
if (!ids.length) return;
const changes = await openBulkModal(state, ids.length);
if (!changes) return;
run('一括変更', async () => {
for (const id of ids) await updateItem(LIST_USERS, id, changes);
await reload();
toast('ok', ids.length + '件を一括変更しました');
});
}
async function userDeleteFlow() {
const ids = [...selectedUserIds];
if (!ids.length) return;
const okDel = await modal({
title: '物理削除の確認',
message: '選択中の ' + ids.length + '件をリストから完全に削除します。この操作は元に戻せません。' +
'(復元できる削除は「一括変更」のシステム削除=論理削除を使ってください)',
okLabel: '完全に削除する',
danger: true,
});
if (!okDel) return;
run('物理削除', async () => {
for (const id of ids) await deleteItem(LIST_USERS, id);
selectedUserIds.clear();
await reload();
toast('ok', ids.length + '件を削除しました');
});
}
function masterView() {
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
if (!state.ready) {
return `
        <div class="pr-hero">
          <h4>マスタリストがまだありません</h4>
          <p>このサイトに「${esc(LIST_L1)}」と「${esc(LIST_L2)}」を作成します。</p>
          <button class="pr-btn pr-btn--primary" data-act="setup">${ico('plus')}初期セットアップ</button>
        </div>`;
}
return `
      <div class="pr-syncbar">
        <span>マスタの内容を「${esc(LIST_USERS)}」リストの列・選択肢・☑集計表示に反映します(無効はスキップ。列の削除はしません)</span>
        <button class="pr-btn pr-btn--primary" data-act="sync-users">${ico('sync')}リストへ反映</button>
      </div>
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L1)}</b><span class="pr-count">${state.l1.length}件</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="${esc(LABEL_L1)}の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l1" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${state.l1.map((x) =>
rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
'<div class="pr-empty">未登録</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L2)}${sel ? ' — ' + esc(sel.Title) : ''}</b>
            <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
          ${sel ? `
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l2" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
'<div class="pr-empty">未登録</div>'}</div>`
: '<div class="pr-empty">左で' + LABEL_L1 + 'を選択してください</div>'}
        </div>
      </div>`;
}
function usersView() {
return usersViewHtml(state);
}
function render() {
const views = { users: usersView, master: masterView, notify: notifyViewHtml };
const navItem = (view, label, sub) => `
      <button class="pr-nav-item${state.view === view ? ' active' : ''}" data-act="nav" data-view="${view}">
        ${label}<small>${sub}</small></button>`;
app.innerHTML = `
      <div class="pr-topbar">
        <span class="pr-title">permreg<small>利用者権限登録 管理</small></span>
        <input type="text" class="pr-input" id="pr-weburl" style="flex:1" value="${esc(getWebUrl())}"
          aria-label="SharePoint サイトURL" title="SharePoint サイトURL">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="reload" aria-label="再読込" title="再読込">${ico('refresh-cw')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="settings" aria-label="設定" title="設定(配信元 / 開発者モード)">${ico('gear')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="close" aria-label="閉じる" title="閉じる">${ico('x')}</button>
      </div>
      <div class="pr-body">
        <nav class="pr-side" aria-label="メニュー">
          <div class="pr-side-head">メニュー</div>
          ${navItem('users', '利用者一覧', '登録状況の確認ビュー')}
          ${navItem('master', 'マスタ管理', LABEL_L1 + ' / ' + LABEL_L2)}
          ${navItem('notify', '通知' + (notifyUnreadCount() ? '<span class="pr-navbadge">' + notifyUnreadCount() + '</span>' : ''), 'リスト更新の検知')}
        </nav>
        <div class="pr-main">${views[state.view]()}</div>
      </div>
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'} / ${esc(BUILD)}</div>`;
if (state.view === 'users') {
usersAfterRender(app, state, { rerender: render, onEdit: userEditFlow });
}
}
async function reload() {
await checkReady();
if (state.ready) await loadAll();
render();
}
app.addEventListener('change', (ev) => {
const t = ev.target;
if (t.id === 'pr-weburl') {
setWebUrl(t.value.trim());
localStorage.setItem(LS_WEB_URL, getWebUrl());
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
if (ev.isComposing || ev.keyCode === 229) return;
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
if (act === 'nav') { state.view = t.dataset.view; render(); return; }
if (act === 'settings') { openSettingsModal(state).then(render); return; }
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
if (act === 'user-add') { userAddFlow(); return; }
if (act === 'user-bulk') { userBulkFlow(); return; }
if (act === 'user-del-selected') { userDeleteFlow(); return; }
if (act === 'user-clear-sel') { selectedUserIds.clear(); render(); return; }
if (act === 'notify-read') { notifyMarkRead(); render(); return; }
if (act === 'sync-users') {
const activeL1 = state.l1.filter((x) => x.Active !== false);
const activeL1Ids = new Set(activeL1.map((x) => x.Id));
const activeL2 = state.l2.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id));
if (!activeL1.length) {
toast('warn', '有効な' + LABEL_L1 + 'がありません。先にマスタを登録してください');
return;
}
const ok = await modal({
title: 'リストへ反映',
message: '「' + LIST_USERS + '」リスト(無ければ作成)に反映します: ' +
LABEL_L1 + ' ' + activeL1.length + '件を選択肢に、' + LABEL_L2 + ' ' + activeL2.length +
'件をチェック列+☑集計表示に。マスタで無効/削除した分の列は消えません(データ保全)。',
okLabel: '反映する',
});
if (!ok) return;
run('リストへ反映', async () => {
const s = await syncMastersToUserList(state, setStatus);
await reload();
toast('ok', (s.createdList ? '「' + LIST_USERS + '」を作成し、' : '') +
LABEL_L1 + ' ' + s.l1Count + '件 / ' + LABEL_L2 + ' ' + s.l2Count + '件を反映しました' +
(s.added ? '(列追加 ' + s.added + ')' : '') + (s.renamed ? '(改名 ' + s.renamed + ')' : ''));
if (s.orderWarn) toast('warn', '列の並び替えに一部失敗しました — ' + s.orderWarn);
});
return;
}
if (act === 'bulk-l1' || act === 'bulk-l2') {
const isL1 = act === 'bulk-l1';
const selL1 = state.l1.find((x) => x.Id === state.selectedL1);
const targetLabel = isL1 ? LABEL_L1 : '「' + (selL1 ? selL1.Title : '') + '」配下の' + LABEL_L2;
const text = await modal({
title: 'まとめて追加 — ' + targetLabel,
message: '1行に1件ずつ入力してください(Excel の列を貼り付けてもOK)。既存と重複する名称はスキップされます。確定は Cmd/Ctrl+Enter でも可。',
inputValue: '',
multiline: true,
okLabel: '追加する',
});
if (text == null) return;
const pool = isL1 ? state.l1
: state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
const existing = new Set(pool.map((x) => x.Title));
const names = [];
let dup = 0;
for (const raw of text.split(/\r?\n/)) {
const n = raw.trim();
if (!n) continue;
if (existing.has(n)) { dup++; continue; }
existing.add(n);
names.push(n);
}
if (!names.length) {
toast('warn', '追加できる名称がありません' + (dup ? '(すべて既存と重複)' : ''));
return;
}
run('まとめて追加', async () => {
let order = nextOrder(pool);
for (const n of names) {
const body = { Title: n, SortOrder: order, Active: true };
if (!isL1) body.Level1Id = state.selectedL1;
await addItem(isL1 ? LIST_L1 : LIST_L2, body);
order += 10;
}
await reload();
toast('ok', names.length + '件追加しました' + (dup ? '(' + dup + '件は重複のためスキップ)' : ''));
});
return;
}
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
toast('warn', '「' + item.Title + '」には' + LABEL_L2 + 'が ' + children.length + ' 件あります。先に' + LABEL_L2 + 'を削除してください');
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
if (state.usersReady) {
setStatus('並び順をリストへ反映中…');
await syncMastersToUserList(state, setStatus);
}
});
}
});
render();
run('読込', reload);
window.__permreg = { state, build: BUILD };
startUpdateWatcher(BUILD);
if (window.__permregUsersPoll) clearInterval(window.__permregUsersPoll);
const pollUsers = async () => {
if (document.hidden || state.busy || !state.usersReady) return;
if (root.querySelector('.pr-backdrop')) return;
try {
const r = await spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999');
const next = r.value || [];
const events = diffUsers(state.users, next);
if (!events.length) return;
notifyAdd(events);
state.users = next;
const ae = document.activeElement;
if (ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
render();
} catch { }
};
window.__permregUsersPoll = setInterval(pollUsers, POLL_INTERVAL);
window.__permregPollNow = pollUsers;
})();
})();
