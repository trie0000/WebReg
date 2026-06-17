(() => {
const PRODUCT = 'webreg';
const ROOT_ID = 'webreg-root';
const LS_WEB_URL = 'webreg.webUrl';
const LS_DEV_SOURCE = 'webreg.dev.bundle-source';
const LS_DEV_BASE = 'webreg.dev.local-base';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/webreg';
const LS_LIST_PREFIX = 'webreg.listPrefix';
const BASE_LIST_L1 = '組織区分第1階層マスタ';
const BASE_LIST_L2 = '組織区分第2階層マスタ';
const BASE_LIST_USERS = '利用者一覧';
const BASE_LIST_USERS_EN = '利用者一覧(英語)';
const BASE_LIST_CONF = 'WebReg設定';
const BASE_LIST_AUDIT = '操作ログ';
const LIST_COMMON = 'WebReg共通設定';
let LIST_L1, LIST_L2, LIST_USERS, LIST_USERS_EN, LIST_CONF, LIST_AUDIT;
function listPrefix() {
try { return (localStorage.getItem(LS_LIST_PREFIX) || '').trim(); } catch { return ''; }
}
function applyListPrefix() {
const p = listPrefix();
LIST_L1 = p + BASE_LIST_L1;
LIST_L2 = p + BASE_LIST_L2;
LIST_USERS = p + BASE_LIST_USERS;
LIST_USERS_EN = p + BASE_LIST_USERS_EN;
LIST_CONF = p + BASE_LIST_CONF;
LIST_AUDIT = p + BASE_LIST_AUDIT;
}
applyListPrefix();
const CHANGE_TYPE_DEFAULTS = ['新規', '変更', '削除', '変更なし'];
const PERMISSION_DEFAULTS = ['更新者', '閲覧者'];
const NO_CHANGE = '変更なし';
const WORK_STATUS = ['作業待ち', '改廃済み', '結果確認済み'];
const WORK_STATUS_DEFAULT = '作業待ち';
const WORK_STATUS_DONE = '結果確認済み';
const LS_DEBUG = 'webreg.debug';
const isDebug = () => {
try { return localStorage.getItem(LS_DEBUG) === '1'; } catch { return false; }
};
const POLL_INTERVAL = 30000;
const LS_NOTIFY_EVENTS = 'webreg.notify.events';
const LS_NOTIFY_READAT = 'webreg.notify.readAt';
const LABEL_L1 = '組織区分1';
const LABEL_L2 = '組織区分2';
try {
for (const k of Object.keys(localStorage)) {
if (!k.startsWith('permreg.')) continue;
const nk = 'webreg.' + k.slice('permreg.'.length);
if (localStorage.getItem(nk) == null) {
localStorage.setItem(nk, String(localStorage.getItem(k)).replace('/permreg', '/webreg'));
}
localStorage.removeItem(k);
}
} catch { }
const BUILD = typeof "0.1.0-31fccc49" !== 'undefined' ? "0.1.0-31fccc49" : 'dev';
const EN_FIELD_TITLE = {
Title: 'User Name',
Company: 'Company',
Email: 'Email',
ChangeType: 'Change Type',
Permission: 'Permission',
OrgLevel1: 'Org Division 1',
OrgLevel2: 'Org Division 2',
Notes: 'Notes',
AppliedDate: 'Applied Date',
SystemDeleted: 'System Deleted',
L2All: 'All Org Division 2',
WorkStatus: 'Work Status',
};
const EN_CHANGE_TYPE = {
追加: 'Add', 新規: 'New', 変更: 'Change', 更新: 'Update', 削除: 'Delete', 変更なし: 'No Change',
};
const EN_PERMISSION = { 更新者: 'Editor', 閲覧者: 'Viewer', 参照者: 'Reader' };
const EN_WORK_STATUS = { 作業待ち: 'Pending', 改廃済み: 'Done', 結果確認済み: 'Verified' };
const EN_LIST_DESC = 'User permission registry (English)';
const toEnChangeType = (v) => EN_CHANGE_TYPE[v] || v || '';
const toEnPermission = (v) => EN_PERMISSION[v] || v || '';
const toEnWorkStatus = (v) => EN_WORK_STATUS[v] || v || WORK_STATUS_DEFAULT;
const enFieldTitle = (internal, jaTitle) => EN_FIELD_TITLE[internal] || jaTitle;
const l1NameOf = (x, lang) => (lang === 'en' ? (x.TitleEn || x.Title) : x.Title);
const l2NameOf = (x, lang) => (lang === 'en' ? (x.TitleEn || x.Title) : x.Title);
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
function spLog(verb, path, status, ms, reqBody, errBody) {
let p = path;
try { p = decodeURIComponent(path); } catch { }
const line = '[WebReg] ' + verb + ' ' + p + ' -> ' + status + ' (' + ms + 'ms)';
if (errBody != null && status !== 404) {
console.error(line +
(reqBody != null ? '\n  request: ' + String(reqBody).slice(0, 800) : '') +
'\n  response: ' + String(errBody).slice(0, 1500));
} else if (isDebug()) {
console.log(line + (errBody != null ? ' (存在チェック)' : ''));
}
}
async function sp(method, path, body, headers) {
const h = Object.assign({ Accept: 'application/json;odata=nometadata' }, headers);
if (method !== 'GET') {
h['X-RequestDigest'] = await getDigest();
if (body != null) h['Content-Type'] = 'application/json;odata=nometadata';
}
const verb = (headers && headers['X-HTTP-Method']) || method;
const reqBody = body != null ? JSON.stringify(body) : undefined;
const t0 = Date.now();
const r = await fetch(_webUrl + path, {
method: method === 'GET' ? 'GET' : 'POST',
headers: h,
credentials: 'same-origin',
body: reqBody,
});
if (!r.ok) {
let msg = 'HTTP ' + r.status;
let raw = '';
try {
raw = await r.text();
const j = JSON.parse(raw);
const m = (j['odata.error'] && j['odata.error'].message && j['odata.error'].message.value)
|| (j.error && j.error.message && (j.error.message.value || j.error.message));
if (m) msg += ' — ' + m;
} catch { }
spLog(verb, path, r.status, Date.now() - t0, reqBody, raw || '(本文なし)');
const e = new Error(msg);
e.status = r.status;
throw e;
}
spLog(verb, path, r.status, Date.now() - t0);
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
' ApplicationName="webreg" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions>' +
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
if (!r.ok) {
console.error('[WebReg] CSOM ProcessQuery(FieldLinks Reorder) -> HTTP ' + r.status);
throw new Error('HTTP ' + r.status);
}
const j = await r.json();
if (j && j[0] && j[0].ErrorInfo) {
console.error('[WebReg] CSOM ProcessQuery(FieldLinks Reorder) エラー:', j[0].ErrorInfo);
throw new Error(j[0].ErrorInfo.ErrorMessage);
}
if (isDebug()) console.log('[WebReg] CSOM ProcessQuery(FieldLinks Reorder) -> OK');
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
await ensureField(LIST_L1, 'TitleEn', '英語名', { FieldTypeKind: 2 });
await ensureField(LIST_L1, 'SortOrder', '並び順', { FieldTypeKind: 9 });
await ensureField(LIST_L1, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
await addViewFields(LIST_L1, ['TitleEn', 'SortOrder', 'Active']);
log('「' + LIST_L2 + '」を確認中…');
await ensureList(LIST_L2, '権限登録リスト用 組織区分(第2階層)マスタ');
await ensureLookupField(LIST_L2, 'Level1', '第1階層', id1);
await ensureField(LIST_L2, 'TitleEn', '英語名', { FieldTypeKind: 2 });
await ensureField(LIST_L2, 'SortOrder', '並び順', { FieldTypeKind: 9 });
await ensureField(LIST_L2, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
await addViewFields(LIST_L2, ['Level1', 'TitleEn', 'SortOrder', 'Active']);
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
async function ensureWorkStatusColumn() {
if (await fieldExists(LIST_USERS, 'WorkStatus')) return;
const xml = "<Field Type='Choice' DisplayName='WorkStatus' Name='WorkStatus' StaticName='WorkStatus'" +
" Format='Dropdown'><Default>" + xmlEsc(WORK_STATUS_DEFAULT) + '</Default><CHOICES>' +
WORK_STATUS.map((c) => '<CHOICE>' + xmlEsc(c) + '</CHOICE>').join('') + '</CHOICES></Field>';
await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('WorkStatus')", { Title: '改廃ステータス' });
try { await addViewFields(LIST_USERS, ['WorkStatus']); } catch { }
}
async function ensureUserList(log) {
if (await listId(LIST_USERS)) return false;
log('「' + LIST_USERS + '」を作成中…');
await spPost('/_api/web/lists', { Title: LIST_USERS, BaseTemplate: 100, Description: '利用者の権限登録リスト(webreg)' });
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
await ensureField(LIST_USERS, 'L2All', '組織区分2のすべて', { FieldTypeKind: 8, DefaultValue: '0' });
await ensureWorkStatusColumn();
log(LABEL_L1 + 'の選択肢を更新中…');
await setChoices(LIST_USERS, 'OrgLevel1', LABEL_L1, activeL1.map((x) => x.Title), false);
try {
const pm = await spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Permission')?$select=Choices");
if ((pm.Choices || []).includes('参照者')) {
const used = await spGet(lt(LIST_USERS) + "/items?$select=Id&$filter=Permission eq '参照者'&$top=1");
if (!(used.value || []).length) {
await setChoices(LIST_USERS, 'Permission', '権限',
pm.Choices.filter((x) => x !== '参照者'), true);
}
}
} catch { }
log(LABEL_L2 + 'のチェック列を更新中…');
const existing = await spGet(lt(LIST_USERS) +
"/fields?$select=InternalName,Title,ClientValidationFormula&$filter=startswith(InternalName,'L2_')");
const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));
const cvfByInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.ClientValidationFormula || '']));
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
log('フォームの条件付き表示を更新中…');
for (const x of state.l2) {
if (!x.Level1 || !l1Title.has(x.Level1.Id)) continue;
const internal = 'L2_' + x.Id;
if (!byInternal.has(internal) && !newCols.includes(internal)) continue;
const cond = "=if([$OrgLevel1] == '" + String(l1Title.get(x.Level1.Id)).replace(/'/g, '') +
"' && [$L2All] != true, 'true', 'false')";
if (cvfByInternal.get(internal) !== cond) {
try {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')",
{ ClientValidationFormula: cond });
} catch (e) {
summary.condWarn = '条件付き表示(' + internal + '): ' + e.message;
}
}
}
try {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('L2All')",
{ ClientValidationFormula: "=if([$OrgLevel1] != '', 'true', 'false')" });
} catch (e) {
summary.condWarn = '条件付き表示(L2All): ' + e.message;
}
log('集計列(' + LABEL_L2 + ')を更新中…');
const FORMULA_LIMIT = 7000;
const LIT_MAX = 120;
const lit = (s) => {
const chunks = [];
for (let i = 0; i < s.length || i === 0; i += LIT_MAX) {
chunks.push('"' + s.slice(i, i + LIT_MAX).replace(/"/g, '""') + '"');
}
return chunks.join('&');
};
const subDefs = [];
for (const l1 of activeL1) {
const kids = activeL2.filter((x) => x.Level1.Id === l1.Id);
if (!kids.length) continue;
const perCheck = kids.map((x) => 'IF([' + displayOf(x) + '],"✅","☐")&' + lit(displayOf(x)))
.join('&" / "&');
const allChecked = lit(kids.map((x) => '✅' + displayOf(x)).join(' / '));
subDefs.push({
internal: 'O2S_' + l1.Id,
l1,
formula: '=IF([組織区分2のすべて],' + allChecked + ',' + perCheck + ')',
});
}
const finalFormula = subDefs.length
? '=' + subDefs.map((d) => 'IF([' + LABEL_L1 + ']="' + safeTitle(d.l1.Title) + '",[' + d.internal + '],"")').join('&')
: '=""';
const fitsCalc = finalFormula.length <= FORMULA_LIMIT &&
subDefs.every((d) => d.formula.length <= FORMULA_LIMIT);
let org2Type = '';
try {
const fr = await spGet(lt(LIST_USERS) +
"/fields?$select=TypeAsString&$filter=InternalName eq 'OrgLevel2'");
org2Type = ((fr.value || [])[0] || {}).TypeAsString || '';
} catch { }
if (fitsCalc) {
try {
const existingSubs = await spGet(lt(LIST_USERS) +
"/fields?$select=InternalName,Formula&$filter=startswith(InternalName,'O2S_')");
const subByName = new Map((existingSubs.value || []).map((f) => [f.InternalName, f.Formula || '']));
for (const d of subDefs) {
if (!subByName.has(d.internal)) {
const refs = "<FieldRef Name='L2All'/>" +
activeL2.filter((x) => x.Level1.Id === d.l1.Id)
.map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
const xml = "<Field Type='Calculated' DisplayName='" + d.internal + "' Name='" + d.internal +
"' StaticName='" + d.internal + "' ResultType='Text' ReadOnly='TRUE'>" +
'<Formula>' + xmlEsc(d.formula) + '</Formula><FieldRefs>' + refs + '</FieldRefs></Field>';
await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
} else if (subByName.get(d.internal) !== d.formula) {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + d.internal + "')",
{ Formula: d.formula });
}
}
for (const name of subByName.keys()) {
if (!subDefs.some((d) => d.internal === name)) {
try {
await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + name + "')");
} catch { }
}
}
if (org2Type && org2Type !== 'Calculated') {
await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')");
org2Type = '';
}
if (!org2Type) {
const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
" ResultType='Text' ReadOnly='TRUE'><Formula>=\"\"</Formula>" +
"<FieldRefs><FieldRef Name='OrgLevel1'/></FieldRefs></Field>";
await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2 });
}
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')",
{ Title: LABEL_L2, Formula: finalFormula });
summary.org2Mode = 'calc';
} catch (e) {
summary.formulaWarn = e.message + '(統合式 ' + finalFormula.length + '文字)';
}
}
if (summary.org2Mode !== 'calc') {
if (org2Type === 'Note') {
summary.org2Mode = 'text';
} else {
log(LABEL_L2 + '列をテキスト方式へ移行中…');
try {
if (org2Type) {
await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')");
}
await ensureField(LIST_USERS, 'OrgLevel2', LABEL_L2, { FieldTypeKind: 3 });
try {
await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')",
{ RichText: false });
} catch { }
try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowinnewform(false)"); } catch { }
try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowineditform(false)"); } catch { }
summary.org2Mode = 'text';
summary.org2Migrated = '集計式が上限を超えるため、' + LABEL_L2 + '列をツールが書き込むテキスト列に切替えました';
} catch (e2) {
summary.formulaWarn = (summary.formulaWarn || '') + ' / テキスト移行失敗: ' + e2.message;
}
}
}
if (summary.org2Mode === 'text') {
log(LABEL_L2 + 'の表示値を更新中…');
try {
const items = await spGet(lt(LIST_USERS) + '/items?$select=*&$top=4999');
for (const it of (items.value || [])) {
const txt = userOrg2Text(state, it);
if ((it.OrgLevel2 || '') !== txt) {
await spMerge(lt(LIST_USERS) + '/items(' + it.Id + ')', { OrgLevel2: txt });
}
}
} catch (e) {
summary.formulaWarn = LABEL_L2 + 'の表示値更新: ' + e.message;
}
}
await addViewFields(LIST_USERS, ['OrgLevel1', 'OrgLevel2']);
log('SPリストの表示設定を更新中…');
try {
await applyListFormatting(state);
} catch (e) {
summary.formatWarn = e.message;
}
const orderedManaged = ['OrgLevel1', 'L2All', 'OrgLevel2'].concat(activeL2.map((x) => 'L2_' + x.Id));
try {
log('列の並び順を更新中…');
await applyColumnOrder(orderedManaged);
} catch (e) {
summary.orderWarn = e.message;
}
log('反映完了');
return summary;
}
const LIT_MAX = 120;
function calcLit(s) {
const chunks = [];
for (let i = 0; i < s.length || i === 0; i += LIT_MAX) {
chunks.push('"' + s.slice(i, i + LIT_MAX).replace(/"/g, '""') + '"');
}
return chunks.join('&');
}
async function syncEnglishUserList(state, log) {
const summary = { built: false, users: 0 };
const enL1 = state.l1.filter((x) => x.Active !== false && goesToEn(assignOf(state, x.Title)));
if (!enL1.length) return summary;
summary.built = true;
const l1Order = new Map(state.l1.map((x, i) => [x.Id, i]));
const enL1Ids = new Set(enL1.map((x) => x.Id));
const enL2 = state.l2
.filter((x) => x.Active !== false && x.Level1 && enL1Ids.has(x.Level1.Id))
.sort((a, b) => (l1Order.get(a.Level1.Id) - l1Order.get(b.Level1.Id)) ||
((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
const nameL1 = (x) => safeTitle(x.TitleEn || x.Title);
const l1NameById = new Map(state.l1.map((x) => [x.Id, x.TitleEn || x.Title]));
if (!(await listId(LIST_USERS_EN))) {
log('「' + LIST_USERS_EN + '」を作成中…');
await spPost('/_api/web/lists', { Title: LIST_USERS_EN, BaseTemplate: 100, Description: EN_LIST_DESC });
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('Title')", { Title: EN_FIELD_TITLE.Title });
await ensureField(LIST_USERS_EN, 'Company', EN_FIELD_TITLE.Company, { FieldTypeKind: 2 });
await ensureField(LIST_USERS_EN, 'Email', EN_FIELD_TITLE.Email, { FieldTypeKind: 2 });
await createChoiceField(LIST_USERS_EN, 'ChangeType', EN_FIELD_TITLE.ChangeType,
CHANGE_TYPE_DEFAULTS.map(toEnChangeType), true);
await createChoiceField(LIST_USERS_EN, 'Permission', EN_FIELD_TITLE.Permission,
PERMISSION_DEFAULTS.map(toEnPermission), true);
await ensureField(LIST_USERS_EN, 'Notes', EN_FIELD_TITLE.Notes, { FieldTypeKind: 3 });
await ensureField(LIST_USERS_EN, 'AppliedDate', EN_FIELD_TITLE.AppliedDate, { FieldTypeKind: 4 });
await ensureField(LIST_USERS_EN, 'SystemDeleted', EN_FIELD_TITLE.SystemDeleted, { FieldTypeKind: 8, DefaultValue: '0' });
}
await ensureField(LIST_USERS_EN, 'L2All', EN_FIELD_TITLE.L2All, { FieldTypeKind: 8, DefaultValue: '0' });
if (!(await fieldExists(LIST_USERS_EN, 'WorkStatus'))) {
const xml = "<Field Type='Choice' DisplayName='WorkStatus' Name='WorkStatus' StaticName='WorkStatus'" +
" Format='Dropdown'><Default>" + xmlEsc(toEnWorkStatus(WORK_STATUS_DEFAULT)) + '</Default><CHOICES>' +
WORK_STATUS.map((c) => '<CHOICE>' + xmlEsc(toEnWorkStatus(c)) + '</CHOICE>').join('') + '</CHOICES></Field>';
await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('WorkStatus')", { Title: EN_FIELD_TITLE.WorkStatus });
}
log(LIST_USERS_EN + ': 選択肢を更新中…');
await setChoices(LIST_USERS_EN, 'OrgLevel1', EN_FIELD_TITLE.OrgLevel1, enL1.map(nameL1), false);
await setChoices(LIST_USERS_EN, 'ChangeType', EN_FIELD_TITLE.ChangeType,
state.choices.changeType.map(toEnChangeType), true);
await setChoices(LIST_USERS_EN, 'Permission', EN_FIELD_TITLE.Permission,
state.choices.permission.map(toEnPermission), true);
log(LIST_USERS_EN + ': チェック列を更新中…');
const existing = await spGet(lt(LIST_USERS_EN) +
"/fields?$select=InternalName,Title,ClientValidationFormula&$filter=startswith(InternalName,'L2_')");
const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));
const cvfByInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.ClientValidationFormula || '']));
const enName2 = (x) => x.TitleEn || x.Title;
const titleCount = new Map();
enL2.forEach((x) => titleCount.set(enName2(x), (titleCount.get(enName2(x)) || 0) + 1));
const displayOf = (x) => safeTitle(titleCount.get(enName2(x)) > 1
? enName2(x) + '(' + (l1NameById.get(x.Level1.Id)) + ')' : enName2(x));
const newCols = [];
for (const x of enL2) {
const internal = 'L2_' + x.Id;
const display = displayOf(x);
if (!byInternal.has(internal)) {
const xml = "<Field Type='Boolean' DisplayName='" + internal + "' Name='" + internal +
"' StaticName='" + internal + "'><Default>0</Default></Field>";
await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
newCols.push(internal);
} else if (byInternal.get(internal) !== display) {
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
}
}
for (const x of enL2) {
const internal = 'L2_' + x.Id;
if (!byInternal.has(internal) && !newCols.includes(internal)) continue;
const cond = "=if([$OrgLevel1] == '" + String(l1NameById.get(x.Level1.Id)).replace(/'/g, '') +
"' && [$L2All] != true, 'true', 'false')";
if (cvfByInternal.get(internal) !== cond) {
try { await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { ClientValidationFormula: cond }); } catch { }
}
}
try { await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('L2All')", { ClientValidationFormula: "=if([$OrgLevel1] != '', 'true', 'false')" }); } catch { }
log(LIST_USERS_EN + ': 集計列を更新中…');
const subDefs = [];
for (const l1 of enL1) {
const kids = enL2.filter((x) => x.Level1.Id === l1.Id);
if (!kids.length) continue;
const perCheck = kids.map((x) => 'IF([' + displayOf(x) + '],"✅","☐")&' + calcLit(displayOf(x))).join('&" / "&');
const allChecked = calcLit(kids.map((x) => '✅' + displayOf(x)).join(' / '));
subDefs.push({ internal: 'O2S_' + l1.Id, l1, formula: '=IF([' + EN_FIELD_TITLE.L2All + '],' + allChecked + ',' + perCheck + ')' });
}
const finalFormula = subDefs.length
? '=' + subDefs.map((d) => 'IF([' + EN_FIELD_TITLE.OrgLevel1 + ']="' + nameL1(d.l1) + '",[' + d.internal + '],"")').join('&')
: '=""';
try {
const existingSubs = await spGet(lt(LIST_USERS_EN) + "/fields?$select=InternalName,Formula&$filter=startswith(InternalName,'O2S_')");
const subByName = new Map((existingSubs.value || []).map((f) => [f.InternalName, f.Formula || '']));
for (const d of subDefs) {
if (!subByName.has(d.internal)) {
const refs = "<FieldRef Name='L2All'/>" + enL2.filter((x) => x.Level1.Id === d.l1.Id).map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
const xml = "<Field Type='Calculated' DisplayName='" + d.internal + "' Name='" + d.internal +
"' StaticName='" + d.internal + "' ResultType='Text' ReadOnly='TRUE'><Formula>" + xmlEsc(d.formula) + '</Formula><FieldRefs>' + refs + '</FieldRefs></Field>';
await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
} else if (subByName.get(d.internal) !== d.formula) {
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + d.internal + "')", { Formula: d.formula });
}
}
for (const name of subByName.keys()) {
if (!subDefs.some((d) => d.internal === name)) {
try { await spDelete(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + name + "')"); } catch { }
}
}
if (!(await fieldExists(LIST_USERS_EN, 'OrgLevel2'))) {
const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
" ResultType='Text' ReadOnly='TRUE'><Formula>=\"\"</Formula><FieldRefs><FieldRef Name='OrgLevel1'/></FieldRefs></Field>";
await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
}
await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: EN_FIELD_TITLE.OrgLevel2, Formula: finalFormula });
} catch (e) { summary.formulaWarn = e.message; }
await applyListFormatting(state, LIST_USERS_EN, 'en');
await addViewFields(LIST_USERS_EN, ['OrgLevel1', 'OrgLevel2'].concat(newCols));
try { await applyColumnOrder(['OrgLevel1', 'L2All', 'OrgLevel2'].concat(enL2.map((x) => 'L2_' + x.Id)), LIST_USERS_EN); } catch { }
log(LIST_USERS_EN + ': 利用者を反映中…');
try {
const cur = (await spGet(lt(LIST_USERS_EN) + '/items?$select=Id&$top=5000')).value || [];
for (const it of cur) { try { await spDelete(lt(LIST_USERS_EN) + '/items(' + it.Id + ')'); } catch { } }
const enTitleSet = new Set(enL1.map((x) => x.Title));
const targets = state.users.filter((u) => enTitleSet.has(u.OrgLevel1 || ''));
let n = 0;
for (const u of targets) {
log(LIST_USERS_EN + ': 利用者を反映中… (' + (++n) + '/' + targets.length + ')');
const l1 = state.l1.find((x) => x.Title === (u.OrgLevel1 || ''));
const body = {
Title: u.Title || '', Company: u.Company || '', Email: u.Email || '',
ChangeType: u.ChangeType ? toEnChangeType(u.ChangeType) : '',
Permission: u.Permission ? toEnPermission(u.Permission) : '',
OrgLevel1: l1 ? (l1.TitleEn || l1.Title) : (u.OrgLevel1 || ''),
Notes: u.Notes || '', SystemDeleted: u.SystemDeleted === true, L2All: u.L2All === true,
WorkStatus: toEnWorkStatus(u.WorkStatus || WORK_STATUS_DEFAULT),
};
for (const k of Object.keys(u)) { if (/^L2_\d+$/.test(k) && u[k] === true) body[k] = true; }
try { await spPost(lt(LIST_USERS_EN) + '/items', body); summary.users++; } catch { }
}
} catch (e) { summary.usersWarn = e.message; }
return summary;
}
const CHIP_ADD = 'rgb(202,240,204)';
const CHIP_UPD = 'rgb(212,231,246)';
const CHIP_DEL = 'rgb(250,187,195)';
const CHIP_GRAY = 'rgb(229,229,229)';
function chipFormatterJson(colorMap, deflt) {
const entries = Object.entries(colorMap);
let col = "'" + deflt + "'";
for (let i = entries.length - 1; i >= 0; i--) {
col = "if(@currentField == '" + entries[i][0] + "', '" + entries[i][1] + "', " + col + ")";
}
return JSON.stringify({
$schema: 'https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json',
elmType: 'div',
txtContent: '@currentField',
style: {
display: 'inline-block',
'box-sizing': 'border-box',
padding: '2px 10px',
'border-radius': '16px',
'white-space': 'nowrap',
'background-color': "=if(@currentField == '', 'transparent', " + col + ')',
},
});
}
async function applyListFormatting(state, listTitle, lang) {
const target = listTitle || LIST_USERS;
const tr = (lang === 'en');
const ctMap = {};
ctMap[tr ? toEnChangeType('追加') : '追加'] = CHIP_ADD;
ctMap[tr ? toEnChangeType('新規') : '新規'] = CHIP_ADD;
ctMap[tr ? toEnChangeType('更新') : '更新'] = CHIP_UPD;
ctMap[tr ? toEnChangeType('変更') : '変更'] = CHIP_UPD;
ctMap[tr ? toEnChangeType('削除') : '削除'] = CHIP_DEL;
ctMap[tr ? toEnChangeType('変更なし') : '変更なし'] = CHIP_GRAY;
const pmMap = {};
pmMap[tr ? toEnPermission('更新者') : '更新者'] = CHIP_UPD;
pmMap[tr ? toEnPermission('閲覧者') : '閲覧者'] = CHIP_GRAY;
const setFmt = async (internal, json) => {
try {
await spMerge(lt(target) + "/fields/getbyinternalnameortitle('" + internal + "')",
{ CustomFormatter: json });
} catch { }
};
await setFmt('ChangeType', chipFormatterJson(ctMap, CHIP_GRAY));
await setFmt('Permission', chipFormatterJson(pmMap, CHIP_GRAY));
const calcCols = ['OrgLevel2'];
try {
const subs = await spGet(lt(target) +
"/fields?$select=InternalName&$filter=startswith(InternalName,'O2S_')");
for (const f of (subs.value || [])) calcCols.push(f.InternalName);
} catch { }
for (const c of calcCols) {
try { await spPost(lt(target) + "/fields/getbyinternalnameortitle('" + c + "')/setshowinnewform(false)"); } catch { }
try { await spPost(lt(target) + "/fields/getbyinternalnameortitle('" + c + "')/setshowineditform(false)"); } catch { }
}
}
async function applyColumnOrder(orderedManaged, listTitle) {
const target = listTitle || LIST_USERS;
const TITLE_ALIAS = new Set(['LinkTitle', 'Title', 'LinkTitleNoMenu']);
const DESIRED = ['LinkTitle', 'Company', 'Email', 'ChangeType', 'Permission',
'OrgLevel1', 'OrgLevel2', 'Notes', 'AppliedDate', 'SystemDeleted', 'Modified', 'Editor'];
let current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];
const counts = new Map();
current.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
let hadDupes = false;
for (const [n, c] of counts) {
if (c <= 1) continue;
hadDupes = true;
for (let i = 0; i < c; i++) {
try {
await spPost(lt(target) + "/defaultview/viewfields/removeviewfield('" + n + "')");
} catch { break; }
}
await spPost(lt(target) + "/defaultview/viewfields/addviewfield('" + n + "')");
}
if (hadDupes) current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];
const titleField = current.find((n) => TITLE_ALIAS.has(n)) || 'LinkTitle';
const desired = DESIRED.map((n) => (n === 'LinkTitle' ? titleField : n));
const desiredSet = new Set(desired);
for (const n of current) {
if (desiredSet.has(n) || TITLE_ALIAS.has(n)) continue;
try { await spPost(lt(target) + "/defaultview/viewfields/removeviewfield('" + n + "')"); } catch { }
}
current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];
for (const n of desired) {
if (!current.includes(n)) {
try { await spPost(lt(target) + "/defaultview/viewfields/addviewfield('" + n + "')"); } catch { }
}
}
for (let i = 0; i < desired.length; i++) {
try {
await spPost(lt(target) + '/defaultview/viewfields/moveviewfieldto', { field: desired[i], index: i });
} catch { }
}
const managedSet = new Set(orderedManaged);
const cts = await spGet(lt(target) + "/contenttypes?$select=StringId");
const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
if (!ct) return;
const links = await spGet(lt(target) + "/contenttypes('" + ct.StringId + "')/fieldlinks?$select=Name");
const names = (links.value || []).map((f) => f.Name);
const ordered = names.filter((n) => !managedSet.has(n))
.concat(orderedManaged.filter((n) => names.includes(n)));
await spReorderContentTypeFields(target, ordered);
}
const CONF_KEY_ADMIN_GROUPS = 'adminGroups';
let _siteGroupsCache = null;
async function fetchSiteGroups(force) {
if (_siteGroupsCache && !force) return _siteGroupsCache;
const j = await spGet('/_api/web/sitegroups?$select=Id,Title&$top=999');
_siteGroupsCache = (j.value || [])
.filter((g) => !/^(SharingLinks\.|Limited Access System Group)/.test(g.Title))
.sort((a, b) => a.Title.localeCompare(b.Title, 'ja'));
return _siteGroupsCache;
}
async function fetchPermRoles() {
const j = await spGet('/_api/web/roledefinitions?$select=Id,Name,RoleTypeKind');
const defs = j.value || [];
const byKind = (k) => defs.find((d) => d.RoleTypeKind === k);
const read = byKind(2);
const edit = byKind(3) || byKind(6);
const full = byKind(5);
if (!read || !edit || !full) {
throw new Error('サイトのロール定義(読み取り/投稿/フルコントロール)を取得できません');
}
return { read, edit, full };
}
const parseGroupIds = (s) => {
try {
const a = JSON.parse(s || '[]');
return Array.isArray(a) ? a.map(Number).filter((n) => n > 0) : [];
} catch { return []; }
};
const permGroupIdsOf = (l1) =>
[...new Set(parseGroupIds(l1.PermEdit).concat(parseGroupIds(l1.PermRead)))];
async function ensurePermColumns() {
await ensureField(LIST_L1, 'PermEdit', '権限グループ', { FieldTypeKind: 3 });
}
async function ensureConfList() {
await ensureList(LIST_CONF, 'WebReg の共有設定(キー/値)');
await ensureField(LIST_CONF, 'Value', '値', { FieldTypeKind: 3 });
}
async function getConfItem(key) {
if (!(await listId(LIST_CONF))) return null;
const j = await spGet(lt(LIST_CONF) + "/items?$select=Id,Value&$filter=Title eq '" + key + "'&$top=1");
return (j.value || [])[0] || null;
}
async function loadAdminGroupIds() {
try {
const it = await getConfItem(CONF_KEY_ADMIN_GROUPS);
return it ? parseGroupIds(it.Value) : [];
} catch { return []; }
}
async function saveAdminGroupIds(ids) {
await ensureConfList();
const it = await getConfItem(CONF_KEY_ADMIN_GROUPS);
const body = { Title: CONF_KEY_ADMIN_GROUPS, Value: JSON.stringify(ids) };
if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', body);
else await spPost(lt(LIST_CONF) + '/items', body);
}
const hasAnyPermConfig = (state) => state.l1.some((x) => permGroupIdsOf(x).length);
const CONF_KEY_SYNC_FP = 'syncFingerprint';
async function loadSyncState() {
try {
if (!(await listId(LIST_CONF))) return { adminIds: [], fp: null };
const j = await spGet(lt(LIST_CONF) + '/items?$select=Title,Value&$top=50');
const map = new Map((j.value || []).map((x) => [x.Title, x.Value]));
let fp = null;
try { fp = JSON.parse(map.get(CONF_KEY_SYNC_FP) || 'null'); } catch { }
return { adminIds: parseGroupIds(map.get(CONF_KEY_ADMIN_GROUPS)), fp };
} catch { return { adminIds: [], fp: null }; }
}
async function saveSyncFp(part, value) {
try {
await ensureConfList();
const it = await getConfItem(CONF_KEY_SYNC_FP);
let fp = {};
try { fp = JSON.parse((it && it.Value) || '{}') || {}; } catch { }
fp[part] = value;
const body = { Title: CONF_KEY_SYNC_FP, Value: JSON.stringify(fp) };
if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', body);
else await spPost(lt(LIST_CONF) + '/items', body);
} catch { }
}
async function buildPermContext(state) {
const roles = await fetchPermRoles();
const adminIds = await loadAdminGroupIds();
const me = await spGet('/_api/web/currentuser?$select=Id,IsSiteAdmin');
let myGroupIds = [];
try { myGroupIds = ((await spGet('/_api/web/currentuser/groups?$select=Id')).value || []).map((g) => g.Id); }
catch { }
const adminSet = new Set(adminIds);
const keepExecutor = !(me.IsSiteAdmin || myGroupIds.some((id) => adminSet.has(id)));
const cfgByTitle = new Map();
for (const x of state.l1) cfgByTitle.set(x.Title, permGroupIdsOf(x));
return { roles, adminIds, cfgByTitle, currentUserId: me.Id, keepExecutor };
}
async function applyPermToItem(ctx, itemId, l1Title) {
const groupIds = ctx.cfgByTitle.get(l1Title || '') || [];
const base = lt(LIST_USERS) + '/items(' + itemId + ')';
await spPost(base + '/breakroleinheritance(copyroleassignments=false,clearsubscopes=true)');
const assign = (gid, roleId) =>
spPost(base + '/roleassignments/addroleassignment(principalid=' + gid + ',roledefid=' + roleId + ')');
const keep = new Set();
for (const gid of ctx.adminIds) {
if (keep.has(gid)) continue;
await assign(gid, ctx.roles.full.Id);
keep.add(gid);
}
for (const gid of groupIds) {
if (keep.has(gid)) continue;
await assign(gid, ctx.roles.edit.Id);
keep.add(gid);
}
const current = (await spGet(base + '/roleassignments?$select=PrincipalId')).value || [];
for (const ra of current) {
if (keep.has(ra.PrincipalId)) continue;
if (ctx.keepExecutor && ra.PrincipalId === ctx.currentUserId) continue;
await spDelete(base + '/roleassignments/getbyprincipalid(' + ra.PrincipalId + ')');
}
return 'applied';
}
async function applyPermissionsToItems(state, targets, log) {
const ctx = await buildPermContext(state);
const summary = { applied: 0, adminOnly: 0, errors: [] };
let done = 0;
for (const t of targets) {
done++;
log('権限を反映中… (' + done + '/' + targets.length + ')');
try {
await applyPermToItem(ctx, t.id, t.l1);
const hasGroups = (ctx.cfgByTitle.get(t.l1 || '') || []).length > 0;
summary[hasGroups ? 'applied' : 'adminOnly']++;
} catch (e) {
summary.errors.push({ id: t.id, msg: e.message });
}
}
return summary;
}
async function applyPermissionsAll(state, log) {
const items = (await spGet(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=4999')).value || [];
return applyPermissionsToItems(state, items.map((it) => ({ id: it.Id, l1: it.OrgLevel1 })), log);
}
const PERM_APPLY_VER = 2;
async function applyPermissionsChanged(state, fp, adminIds, log) {
const permsSnap = fp && typeof fp.perms === 'object' ? fp.perms : null;
const verOk = !!(fp && fp.permsVer === PERM_APPLY_VER);
let targetTitles = null;
if (permsSnap && verOk) {
const oldG = new Map((permsSnap.g || []).map(([id, ids]) => [id, JSON.stringify(ids.slice().sort((a, b) => a - b))]));
const oldAdmins = JSON.stringify((permsSnap.admins || []).slice().sort((a, b) => a - b));
const curAdmins = JSON.stringify((adminIds || []).slice().sort((a, b) => a - b));
if (oldAdmins === curAdmins) {
const titles = new Set();
for (const x of state.l1) {
const cur = JSON.stringify(permGroupIdsOf(x).slice().sort((a, b) => a - b));
if ((oldG.get(x.Id) || '[]') !== cur) titles.add(x.Title);
}
targetTitles = titles;
}
}
const items = (await spGet(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=4999')).value || [];
const targets = (targetTitles === null ? items
: items.filter((it) => targetTitles.has(it.OrgLevel1 || '')))
.map((it) => ({ id: it.Id, l1: it.OrgLevel1 }));
if (!targets.length) {
return { applied: 0, adminOnly: 0, errors: [], scanned: items.length, skipped: true };
}
const r = await applyPermissionsToItems(state, targets, log);
r.scanned = items.length;
r.skipped = false;
return r;
}
async function applyPermAfterWrite(state, itemId, l1Title) {
if (!hasAnyPermConfig(state)) return;
try {
const ctx = await buildPermContext(state);
await applyPermToItem(ctx, itemId, l1Title);
} catch (e) {
toast('warn', '行の権限設定に失敗しました(データは保存済み) — ' + e.message);
}
}
function permChecksHtml(field, groups, checkedIds) {
const set = new Set(checkedIds);
return groups.map((g) => `
    <label class="pr-check"><input type="checkbox" data-pg="${field}" value="${g.Id}"
      ${set.has(g.Id) ? 'checked' : ''}>${esc(g.Title)}</label>`).join('') ||
'<span class="pr-note">権限グループがありません</span>';
}
const collectPermIds = (back, field) =>
[...back.querySelectorAll('input[data-pg="' + field + '"]:checked')].map((x) => +x.value);
function openL1PermModal(state, l1) {
return new Promise((resolve) => {
let groups = [];
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="権限グループの割当">
          <h4>権限グループの割当 — ${esc(l1.Title)}</h4>
          <span class="pr-note">この${esc(LABEL_L1)}の行を参照・更新できる SP 権限グループを選びます
            (投稿のアクセス権を付与。更新には参照が含まれます)。反映は「権限を反映」ボタンで実行します。</span>
          <div class="pr-field">
            <label>参照・更新できるグループ</label>
            <input type="text" class="pr-input" data-pgfilter placeholder="グループ名で絞り込み" aria-label="グループ名で絞り込み">
            <div class="pr-checks pr-checks--perm" data-pglist="g"><span class="pr-note">グループを取得中…</span></div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok" disabled>保存</button>
          </div>
        </div>
      </div>`);
back.querySelector('[data-pgfilter]').addEventListener('input', (ev) => {
const q = ev.target.value.trim().toLowerCase();
back.querySelectorAll('[data-pglist="g"] .pr-check').forEach((lb) => {
lb.style.display = !q || lb.textContent.toLowerCase().includes(q) ? '' : 'none';
});
});
(async () => {
try {
groups = await fetchSiteGroups();
const assigned = new Set(permGroupIdsOf(l1));
const sorted = [...groups].sort((a, b) =>
(assigned.has(b.Id) ? 1 : 0) - (assigned.has(a.Id) ? 1 : 0));
back.querySelector('[data-pglist="g"]').innerHTML =
permChecksHtml('g', sorted, [...assigned]);
back.querySelector('[data-mact="ok"]').disabled = false;
} catch (e) {
back.querySelectorAll('.pr-checks--perm').forEach((p) => {
p.innerHTML = '<span class="pr-note">権限グループを取得できません — ' + esc(e.message) + '</span>';
});
}
})();
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
const save = async () => {
const okBtn = back.querySelector('[data-mact="ok"]');
okBtn.disabled = true;
try {
await ensurePermColumns();
const body = { PermEdit: JSON.stringify(collectPermIds(back, 'g')) };
if (l1.PermRead !== undefined) body.PermRead = '[]';
await spMerge(lt(LIST_L1) + '/items(' + l1.Id + ')', body);
auditLog('権限グループ割当', '「' + l1.Title + '」の権限グループを ' +
collectPermIds(back, 'g').length + '件に設定');
toast('ok', '「' + l1.Title + '」の権限グループを保存しました(反映は「リストへ反映」)');
done(true);
} catch (e) {
toast('err', '保存に失敗しました — ' + e.message);
okBtn.disabled = false;
}
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) done(false);
return;
}
const b = e.target.closest('[data-mact]');
if (b) (b.dataset.mact === 'ok' ? save() : done(false));
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(false); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
});
}
function computeMasterSnap(state) {
return {
l1: state.l1.map((x) => ({ id: x.Id, t: x.Title, o: x.SortOrder || 0, a: x.Active !== false })),
l2: state.l2.map((x) => ({
id: x.Id, t: x.Title, o: x.SortOrder || 0, a: x.Active !== false,
p: x.Level1 ? x.Level1.Id : null,
})),
};
}
function computePermsSnap(state, adminIds) {
return {
g: state.l1.map((x) => [x.Id, permGroupIdsOf(x).slice().sort((a, b) => a - b)]),
admins: (adminIds || []).slice().sort((a, b) => a - b),
};
}
function diffSyncState(state, adminIds, fp) {
const res = {
pending: false, canDiscard: false,
l1Badges: new Map(), l2Badges: new Map(),
l1Reorder: false, l2Reorder: false,
removed: [], adminsChanged: false, summary: [],
masterUnknown: false, permsUnknown: false,
};
const counts = {};
const bump = (k, n) => { counts[k] = (counts[k] || 0) + (n == null ? 1 : n); };
const badge = (map, id, label) => {
if (!map.has(id)) map.set(id, []);
map.get(id).push(label);
bump(label);
};
const masterSnap = fp && typeof fp.master === 'object' ? fp.master : null;
if (!masterSnap) {
res.masterUnknown = true;
res.pending = true;
} else {
const cur = computeMasterSnap(state);
const cmp = (kind, curArr, oldArr) => {
const oldBy = new Map(oldArr.map((x) => [x.id, x]));
const curIds = new Set(curArr.map((x) => x.id));
const map = kind === 'l1' ? res.l1Badges : res.l2Badges;
for (const c of curArr) {
const o = oldBy.get(c.id);
if (!o) { badge(map, c.id, '追加'); continue; }
if (o.t !== c.t) badge(map, c.id, '名称変更');
if (o.a !== c.a) badge(map, c.id, c.a ? '有効化' : '無効化');
if (kind === 'l2' && o.p !== c.p) badge(map, c.id, '移動');
}
for (const o of oldArr) {
if (!curIds.has(o.id)) {
res.removed.push((kind === 'l1' ? LABEL_L1 : LABEL_L2) + '「' + o.t + '」');
bump('削除');
}
}
const oldOrder = oldArr.filter((x) => curIds.has(x.id)).map((x) => x.id);
const curOrder = curArr.filter((x) => oldBy.has(x.id)).map((x) => x.id);
return JSON.stringify(oldOrder) !== JSON.stringify(curOrder);
};
res.l1Reorder = cmp('l1', cur.l1, masterSnap.l1 || []);
res.l2Reorder = cmp('l2', cur.l2, masterSnap.l2 || []);
if (res.l1Reorder || res.l2Reorder) bump('並び替え', 0);
}
const permsSnap = fp && typeof fp.perms === 'object' ? fp.perms : null;
const curPerms = computePermsSnap(state, adminIds);
if (!permsSnap) {
if (state.l1.some((x) => permGroupIdsOf(x).length) || (adminIds || []).length) {
res.permsUnknown = true;
res.pending = true;
for (const x of state.l1) {
if (permGroupIdsOf(x).length) badge(res.l1Badges, x.Id, '権限未反映');
}
}
} else {
const oldG = new Map((permsSnap.g || []).map(([id, ids]) => [id, JSON.stringify(ids)]));
for (const [id, ids] of curPerms.g) {
if ((oldG.get(id) || '[]') !== JSON.stringify(ids)) badge(res.l1Badges, id, '権限未反映');
}
res.adminsChanged = JSON.stringify(curPerms.admins) !== JSON.stringify(permsSnap.admins || []);
if (res.adminsChanged) bump('管理者グループ変更');
}
res.pending = res.pending || res.l1Badges.size > 0 || res.l2Badges.size > 0 ||
res.l1Reorder || res.l2Reorder || res.removed.length > 0 || res.adminsChanged;
res.canDiscard = res.pending && !!masterSnap &&
(!res.permsUnknown) && (permsSnap != null ||
!(res.adminsChanged || [...res.l1Badges.values()].some((b) => b.includes('権限未反映'))));
if (res.l1Reorder || res.l2Reorder) res.summary.push('並び替え');
for (const [k, n] of Object.entries(counts)) {
if (k === '並び替え') continue;
res.summary.push(k + (n > 1 ? ' ' + n + '件' : ''));
}
if (res.masterUnknown) res.summary.push('(前回反映の記録なし — 反映で記録されます)');
return res;
}
async function revertSyncState(state, fp, log) {
const out = { reverted: 0, deleted: 0, missing: [] };
const masterSnap = fp.master;
const cur = computeMasterSnap(state);
const permsSnap = (typeof fp.perms === 'object' && fp.perms) || null;
const oldG = permsSnap ? new Map((permsSnap.g || []).map(([id, ids]) => [id, ids])) : null;
const doList = async (kind, listTitle, curArr, oldArr) => {
const oldBy = new Map(oldArr.map((x) => [x.id, x]));
for (const c of curArr) {
log('変更を破棄中…');
const o = oldBy.get(c.id);
if (!o) {
await spDelete(lt(listTitle) + '/items(' + c.id + ')');
out.deleted++;
continue;
}
const body = {};
if (o.t !== c.t) body.Title = o.t;
if ((o.o || 0) !== (c.o || 0)) body.SortOrder = o.o || 0;
if (o.a !== c.a) body.Active = o.a;
if (kind === 'l2' && o.p !== c.p && o.p != null) body.Level1Id = o.p;
if (kind === 'l1' && oldG) {
const item = state.l1.find((x) => x.Id === c.id);
const curIds = item ? permGroupIdsOf(item).slice().sort((a, b) => a - b) : [];
const oldIds = (oldG.get(c.id) || []).slice().sort((a, b) => a - b);
if (JSON.stringify(curIds) !== JSON.stringify(oldIds)) {
await ensurePermColumns();
body.PermEdit = JSON.stringify(oldIds);
if (item && item.PermRead !== undefined) body.PermRead = '[]';
}
}
if (Object.keys(body).length) {
await spMerge(lt(listTitle) + '/items(' + c.id + ')', body);
out.reverted++;
}
}
for (const o of oldArr) {
if (!curArr.some((c) => c.id === o.id)) out.missing.push(o.t);
}
};
await doList('l2', LIST_L2, cur.l2, masterSnap.l2 || []);
await doList('l1', LIST_L1, cur.l1, masterSnap.l1 || []);
if (permsSnap) {
const curAdmins = await loadAdminGroupIds();
const oldAdmins = (permsSnap.admins || []).slice().sort((a, b) => a - b);
if (JSON.stringify(curAdmins.slice().sort((a, b) => a - b)) !== JSON.stringify(oldAdmins)) {
await saveAdminGroupIds(oldAdmins);
out.reverted++;
}
}
return out;
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
'key': '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
'external': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>',
'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
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
#${ROOT_ID} .pr-name-en{ margin-left:var(--s-3); font-size:var(--fs-xs); color:var(--ink-4); }
#${ROOT_ID} .pr-assign-row{ display:flex; align-items:center; gap:var(--s-4); padding:var(--s-2) 0; }
#${ROOT_ID} .pr-assign-row span{ flex:1; min-width:0; font-size:var(--fs-md); }
#${ROOT_ID} .pr-assign-row select{ width:110px; flex:none; }
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
let _prog = null;
const progFmtDur = (ms) => {
const s = Math.max(1, Math.round(ms / 1000));
if (s < 60) return s + '秒';
return Math.floor(s / 60) + '分' + (s % 60 ? (s % 60) + '秒' : '');
};
function progressArm(label) {
progressDone();
_prog = { label, opened: false, el: null, phase: '', phaseStart: Date.now(), counts: null };
_prog.openTimer = setTimeout(progressShow, 600);
_prog.tick = setInterval(progressRender, 1000);
}
function progressShow() {
if (!_prog || _prog.opened) return;
_prog.opened = true;
_prog.el = el(`
    <div class="pr-backdrop pr-prog-back">
      <div class="pr-modal pr-prog" role="dialog" aria-modal="true" aria-label="処理中">
        <h4></h4>
        <div class="pr-prog-msg">処理中…</div>
        <div class="pr-prog-track"><div class="pr-prog-fill ind"></div></div>
        <div class="pr-prog-meta"><span class="pr-prog-count"></span><span class="pr-prog-eta"></span></div>
        <span class="pr-note">このまま閉じずにお待ちください(進捗と残り時間は目安です)</span>
      </div>
    </div>`);
_prog.el.querySelector('h4').textContent = _prog.label + '…';
document.getElementById(ROOT_ID).appendChild(_prog.el);
progressRender();
}
function progressFeed(msg) {
if (!_prog) return;
const m = String(msg).match(/^(.*?)\s*\((\d+)\/(\d+)\)\s*$/);
const phase = m ? m[1] : String(msg);
if (phase !== _prog.phase) {
_prog.phase = phase;
_prog.phaseStart = Date.now();
_prog.counts = null;
}
if (m) {
const n = +m[2];
const total = +m[3];
if (!_prog.counts) _prog.counts = { firstN: n - 1, firstT: Date.now() };
_prog.counts.n = n;
_prog.counts.total = total;
if (!_prog.opened && total - n > 1) {
clearTimeout(_prog.openTimer);
progressShow();
}
}
progressRender();
}
function progressRender() {
if (!_prog || !_prog.opened) return;
const e = _prog.el;
e.querySelector('.pr-prog-msg').textContent = _prog.phase || '処理中…';
const c = _prog.counts;
const fill = e.querySelector('.pr-prog-fill');
if (c && c.total) {
fill.classList.remove('ind');
fill.style.width = Math.min(100, Math.round((c.n / c.total) * 100)) + '%';
e.querySelector('.pr-prog-count').textContent = c.n + ' / ' + c.total + '件';
const span = c.n - c.firstN;
let eta = '';
if (c.n >= c.total) eta = 'まもなく完了…';
else if (span >= 2) {
const per = (Date.now() - c.firstT) / span;
eta = '残り 約' + progFmtDur(per * (c.total - c.n));
} else eta = '残り時間を計測中…';
e.querySelector('.pr-prog-eta').textContent = eta;
} else {
fill.classList.add('ind');
fill.style.width = '40%';
e.querySelector('.pr-prog-count').textContent = '';
e.querySelector('.pr-prog-eta').textContent = '経過 ' + progFmtDur(Date.now() - _prog.phaseStart);
}
}
function progressDone() {
if (!_prog) return;
clearTimeout(_prog.openTimer);
clearInterval(_prog.tick);
if (_prog.el) _prog.el.remove();
_prog = null;
}
function openRenameMasterModal(item) {
return new Promise((resolve) => {
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="名称変更">
          <h4>名称変更</h4>
          <div class="pr-field"><label>名称(日本語)</label>
            <input type="text" class="pr-input" id="rn-ja"></div>
          <div class="pr-field"><label>英語名(任意)</label>
            <input type="text" class="pr-input" id="rn-en"></div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
          </div>
        </div>
      </div>`);
back.querySelector('#rn-ja').value = item.Title || '';
back.querySelector('#rn-en').value = item.TitleEn || '';
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
const ok = () => {
const title = back.querySelector('#rn-ja').value.trim();
if (!title) { toast('warn', '日本語の名称は必須です'); return; }
done({ title, titleEn: back.querySelector('#rn-en').value.trim() });
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) { if (downOnBack) done(null); return; }
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
back.querySelector('#rn-ja').focus();
});
}
const GRID_W = 'webreg.colw.';
const GRID_O = 'webreg.colorder.';
const GRID_S = 'webreg.sort.';
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
const syncTableWidth = () => {
let total = 0;
cols.forEach((c, i) => {
const w = parseInt(c.style.width, 10);
total += Number.isFinite(w) ? w : Math.round(ths[i].getBoundingClientRect().width);
});
table.style.width = total + 'px';
};
syncTableWidth();
const suppressNextClick = () => {
table.dataset.dragJustEnded = '1';
setTimeout(() => { delete table.dataset.dragJustEnded; }, 0);
};
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
syncTableWidth();
};
const onUp = () => {
document.removeEventListener('pointermove', onMove);
document.removeEventListener('pointerup', onUp);
document.body.style.cursor = '';
handle.classList.remove('dragging');
suppressNextClick();
gridWriteWidth(opts.tableKey, key, Math.round(th.getBoundingClientRect().width));
syncTableWidth();
};
document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);
});
handle.addEventListener('dblclick', (e) => {
e.preventDefault();
e.stopPropagation();
if (cols[i]) cols[i].style.width = (opts.defaults && opts.defaults[i]) || '';
gridRemoveWidth(opts.tableKey, key);
suppressNextClick();
syncTableWidth();
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
suppressNextClick();
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
const GRID_F = 'webreg.filter.';
const FILTER_BLANK = '(空白)';
const FILTER_CAP = 2000;
function gridFilters(tableKey) {
try { return JSON.parse(localStorage.getItem(GRID_F + tableKey) || '{}') || {}; } catch (e) { return {}; }
}
function gridColExcluded(tableKey, colKey) {
return gridFilters(tableKey)[colKey] || [];
}
function gridSetExcluded(tableKey, colKey, excluded) {
const all = gridFilters(tableKey);
if (excluded && excluded.length) all[colKey] = excluded; else delete all[colKey];
try { localStorage.setItem(GRID_F + tableKey, JSON.stringify(all)); } catch (e) { }
}
function gridColFiltered(tableKey, colKey) {
return gridColExcluded(tableKey, colKey).length > 0;
}
function gridRowPasses(tableKey, valueOf) {
const all = gridFilters(tableKey);
for (const colKey in all) {
const ex = all[colKey];
if (!ex || !ex.length) continue;
if (ex.indexOf(valueOf(colKey)) !== -1) return false;
}
return true;
}
let _colMenu = null;
function closeGridColMenu() {
if (_colMenu) {
document.removeEventListener('mousedown', _colMenu._onDoc, true);
document.removeEventListener('keydown', _colMenu._onKey, true);
window.removeEventListener('resize', _colMenu._onWin, true);
_colMenu.remove();
_colMenu = null;
}
}
function openGridColMenu(opts) {
closeGridColMenu();
const distinct = Array.from(new Set(opts.values))
.sort((a, b) => String(a).localeCompare(String(b), 'ja'));
const capped = distinct.slice(0, FILTER_CAP);
const ex = new Set(gridColExcluded(opts.tableKey, opts.colKey));
const disp = (v) => (v === '' ? FILTER_BLANK : v);
let html = '';
if (opts.onSort) {
html += '<button class="pr-colmenu-item pr-colmenu-act" data-cm="asc">' +
ico('chevron-up') + '<span>昇順で並べ替え</span></button>';
html += '<button class="pr-colmenu-item pr-colmenu-act" data-cm="desc">' +
ico('chevron-down') + '<span>降順で並べ替え</span></button>';
html += '<div class="pr-colmenu-sep"></div>';
}
html += '<div class="pr-colmenu-head">' + esc(opts.label) + ' の値で絞り込み</div>';
html += '<input class="pr-colmenu-search" type="text" placeholder="値を検索">';
html += '<label class="pr-colmenu-item pr-colmenu-all"><input type="checkbox"><span>(すべて選択)</span></label>';
html += '<div class="pr-colmenu-vlist"></div>';
if (distinct.length > capped.length) {
html += '<div class="pr-colmenu-note">値が多いため先頭 ' + capped.length + ' 件のみ</div>';
}
html += '<div class="pr-colmenu-foot">' +
'<button class="pr-btn pr-btn--sm pr-btn--ghost" data-cm="clear">フィルタ解除</button>' +
'<span style="flex:1"></span>' +
'<button class="pr-btn pr-btn--sm pr-btn--primary" data-cm="close">閉じる</button></div>';
const menu = el('<div class="pr-colmenu" role="dialog" aria-label="列フィルター"></div>');
menu.innerHTML = html;
const vlist = menu.querySelector('.pr-colmenu-vlist');
const search = menu.querySelector('.pr-colmenu-search');
const allCb = menu.querySelector('.pr-colmenu-all input');
const apply = () => {
gridSetExcluded(opts.tableKey, opts.colKey, [...ex]);
opts.onChange();
};
const renderList = (query) => {
const ql = (query || '').trim().toLowerCase();
const shown = capped.filter((v) => !ql || disp(v).toLowerCase().indexOf(ql) !== -1);
vlist.innerHTML = shown.map((v) =>
'<label class="pr-colmenu-item"><input type="checkbox" data-v="' + esc(v) + '"' +
(ex.has(v) ? '' : ' checked') + '><span>' + esc(disp(v)) + '</span></label>').join('') ||
'<div class="pr-colmenu-note">該当する値がありません</div>';
const checked = shown.filter((v) => !ex.has(v)).length;
allCb.checked = shown.length > 0 && checked === shown.length;
allCb.indeterminate = checked > 0 && checked < shown.length;
menu._shown = shown;
};
renderList('');
vlist.addEventListener('change', (e) => {
const cb = e.target.closest('input[data-v]');
if (!cb) return;
const v = cb.dataset.v;
if (cb.checked) ex.delete(v); else ex.add(v);
apply();
renderList(search.value);
});
allCb.addEventListener('change', () => {
const shown = menu._shown || [];
if (allCb.checked) shown.forEach((v) => ex.delete(v));
else shown.forEach((v) => ex.add(v));
apply();
renderList(search.value);
});
search.addEventListener('input', () => renderList(search.value));
menu.addEventListener('click', (e) => {
const b = e.target.closest('[data-cm]');
if (!b) return;
const cm = b.dataset.cm;
if (cm === 'asc' || cm === 'desc') { closeGridColMenu(); opts.onSort(cm); return; }
if (cm === 'clear') { ex.clear(); apply(); renderList(search.value); return; }
if (cm === 'close') closeGridColMenu();
});
document.getElementById(ROOT_ID).appendChild(menu);
_colMenu = menu;
const place = () => {
const r = opts.anchor.getBoundingClientRect();
const mw = menu.offsetWidth, mh = menu.offsetHeight;
let left = r.left, top = r.bottom + 2;
if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 2);
menu.style.left = Math.round(left) + 'px';
menu.style.top = Math.round(top) + 'px';
};
place();
menu._onDoc = (e) => { if (!menu.contains(e.target) && !opts.anchor.contains(e.target)) closeGridColMenu(); };
menu._onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeGridColMenu(); } };
menu._onWin = () => closeGridColMenu();
document.addEventListener('mousedown', menu._onDoc, true);
document.addEventListener('keydown', menu._onKey, true);
window.addEventListener('resize', menu._onWin, true);
search.focus();
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
const userFilter = { q: '', showDeleted: false };
const USER_COLS = [
{ key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
{ key: 'company', label: '会社名', w: '140px', val: (u) => u.Company || '' },
{ key: 'email', label: 'メールアドレス', w: '180px', val: (u) => u.Email || '' },
{ key: 'changeType', label: '変更区分', w: '90px', val: (u) => u.ChangeType || '' },
{ key: 'permission', label: '権限', w: '90px', val: (u) => u.Permission || '' },
{ key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },
{ key: 'org2', label: '', w: '220px', val: null },
{ key: 'listKind', label: '区分', w: '90px', val: null },
{ key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];
function userRegionLabel(state, u) {
const a = (state.listAssign && state.listAssign[u.OrgLevel1 || '']) || 'ja';
return a === 'en' ? '海外' : a === 'both' ? '国内・海外' : '国内';
}
function regionChipHtml(label) {
const cls = label === '海外' ? 'pr-spchip--upd' : label === '国内・海外' ? 'pr-spchip--add' : 'pr-spchip--gray';
return '<span class="pr-spchip ' + cls + '">' + esc(label) + '</span>';
}
function userOrg2Text(state, item) {
return activeL2Of(state, item.OrgLevel1 || '')
.map((m) => (item.L2All === true || item['L2_' + m.Id] === true ? '✅' : '☐') + m.Title)
.join(' / ');
}
function userColLabel(c) {
if (c.key === 'org1') return LABEL_L1;
if (c.key === 'org2') return LABEL_L2;
return c.label;
}
function ctChipHtml(v) {
if (!v) return '';
const cls = (v === '追加' || v === '新規') ? 'pr-spchip--add'
: (v === '更新' || v === '変更') ? 'pr-spchip--upd'
: (v === '削除') ? 'pr-spchip--del' : 'pr-spchip--gray';
return '<span class="pr-spchip ' + cls + '">' + esc(v) + '</span>';
}
function pmChipHtml(v) {
if (!v) return '';
const cls = (v === '更新者') ? 'pr-spchip--upd' : 'pr-spchip--gray';
return '<span class="pr-spchip ' + cls + '">' + esc(v) + '</span>';
}
function userCellDisplay(state, c, u) {
if (c.key === 'changeType') return ctChipHtml(u.ChangeType || '');
if (c.key === 'permission') return pmChipHtml(u.Permission || '');
if (c.key === 'listKind') return regionChipHtml(userRegionLabel(state, u));
return esc(userCellText(state, c, u));
}
function userCellText(state, c, u) {
if (c.key === 'org2') return userOrg2Text(state, u);
if (c.key === 'listKind') return userRegionLabel(state, u);
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
if (!gridRowPasses(USERS_GRID_KEY, (k) => userCellText(state, USER_COLS.find((c) => c.key === k), u))) return false;
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
        <p>マスタ管理で組織区分を登録して「リストへ反映」を実行するか、<br>
          CSVインポートから始めると必要なリスト・マスタを自動作成します。</p>
        <div style="display:flex; gap:var(--s-3)">
          <button class="pr-btn pr-btn--primary" data-act="user-import">CSVインポートから始める</button>
          <button class="pr-btn pr-btn--secondary" data-act="nav" data-view="master">マスタ管理を開く</button>
        </div>
      </div>`;
}
const ids = new Set(state.users.map((u) => u.Id));
for (const id of [...selectedUserIds]) if (!ids.has(id)) selectedUserIds.delete(id);
const list = visibleUsers(state);
const sel = selectedUserIds.size;
const sort = gridSort(USERS_GRID_KEY, 'modified');
const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
const cols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);
const badgeHtml = (u) => (u.SystemDeleted === true ? '<span class="pr-badge pr-badge--del">削除済</span>' : '');
const thHtml = cols.map((c) => {
const active = sort.by === c.key;
const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
const filtered = gridColFiltered(USERS_GRID_KEY, c.key);
return '<th class="pr-th-sort' + (active ? ' active' : '') + (filtered ? ' pr-th-filtered' : '') +
'" data-col="' + c.key + '">' + esc(userColLabel(c)) + arrow +
'<span class="pr-th-funnel">' + ico('filter') + '</span></th>';
}).join('');
const rowHtml = (u) => `
    <tr data-uid="${u.Id}" class="${u.SystemDeleted === true ? 'pr-udel' : ''}">
      <td class="pr-uchk"><input type="checkbox" data-usel="${u.Id}" aria-label="選択" ${selectedUserIds.has(u.Id) ? 'checked' : ''}></td>
      ${cols.map((c) => '<td>' + (c.key === 'name' ? badgeHtml(u) : '') + userCellDisplay(state, c, u) + '</td>').join('')}
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
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" title="「${esc(LIST_USERS)}」のSPリストを新しいタブで開く">${ico('external')}SPで開く</button>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-export" title="${esc(LABEL_L1)}を選んで現在の登録状況を .xlsx で出力">Excel出力</button>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-import-xlsx" title="Excel出力と同じ形式のファイルから追加・更新・論理削除を取込">Excel取込</button>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-import" title="CSVで現行の登録状況を一括取込">CSVインポート</button>
      <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-add">${ico('plus')}新規登録</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-ufilter-q" placeholder="検索(全列)" value="${esc(userFilter.q)}">
      <span class="pr-note">列名をクリックでその列の値で絞り込み(Excelのオートフィルター)</span>
      <span style="flex:1"></span>
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
const orderedCols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);
attachGrid(table, {
tableKey: USERS_GRID_KEY,
colKeys: [null].concat(order),
defaults: ['34px'].concat(orderedCols.map((c) => c.w)),
onReorder: (fromKey, toKey) => {
if (fromKey && toKey) {
const cur = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
gridWriteOrder(USERS_GRID_KEY, cur);
}
ctx.rerender();
},
});
const reflow = () => {
const tmp = document.createElement('div');
tmp.innerHTML = usersViewHtml(state);
table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
};
table.querySelector('thead').addEventListener('click', (e) => {
if (table.dataset.dragJustEnded) return;
if (e.target.closest('[data-usel-all]') || e.target.closest('.pr-col-resize')) return;
const th = e.target.closest('th[data-col]');
if (!th) return;
const colKey = th.dataset.col;
const col = USER_COLS.find((c) => c.key === colKey);
const base = state.users.filter((u) => userFilter.showDeleted || u.SystemDeleted !== true);
openGridColMenu({
tableKey: USERS_GRID_KEY,
colKey,
label: userColLabel(col),
values: base.map((u) => userCellText(state, col, u)),
anchor: th,
onSort: (dir) => { gridSetSort(USERS_GRID_KEY, colKey, dir); ctx.rerender(); },
onChange: () => { reflow(); th.classList.toggle('pr-th-filtered', gridColFiltered(USERS_GRID_KEY, colKey)); },
});
});
app.querySelector('#pr-ufilter-q').addEventListener('input', (e) => {
userFilter.q = e.target.value;
reflow();
});
app.querySelector('#pr-ufilter-del').addEventListener('change', (e) => {
userFilter.showDeleted = e.target.checked;
ctx.rerender();
});
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
const ctOpts = (opts, cur) => {
let h = '<option value=""' + (cur ? '' : ' selected') + '>（空欄）</option>';
opts.forEach((c) => {
h += '<option' + (cur === c ? ' selected' : '') + '>' + esc(c) + '</option>';
});
return h;
};
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="${isEdit ? '利用者の編集' : '利用者の新規登録'}">
          <h4>${isEdit ? '利用者の編集' : '利用者の新規登録'}</h4>
          ${fieldRow('利用者名 <span class="pr-req">*</span>', '<input type="text" class="pr-input" id="uf-name">')}
          ${fieldRow('会社名', '<input type="text" class="pr-input" id="uf-company">')}
          ${fieldRow('メールアドレス', '<input type="text" class="pr-input" id="uf-email">')}
          ${fieldRow('変更区分', `<select class="pr-input" id="uf-changetype">${ctOpts(state.choices.changeType, existing && existing.ChangeType)}</select>`)}
          ${fieldRow('権限', `<select class="pr-input" id="uf-perm">${selOpts(state.choices.permission, existing && existing.Permission)}</select>`)}
          ${fieldRow(esc(LABEL_L1), `<select class="pr-input" id="uf-l1">${
activeL1.map((x) => '<option' + (existing && existing.OrgLevel1 === x.Title ? ' selected' : '') + '>' + esc(x.Title) + '</option>').join('')}</select>`)}
          <div class="pr-field">
            <div class="pr-field-row">
              <label>${esc(LABEL_L2)}</label>
              <button type="button" class="pr-btn pr-btn--ghost pr-btn--sm" data-ufact="all">すべて</button>
            </div>
            <label class="pr-check"><input type="checkbox" id="uf-l2all" ${existing && existing.L2All === true ? 'checked' : ''}>
              ${esc(LABEL_L2)}のすべて(チェックすると全${esc(LABEL_L2)}を選択した扱いになります)</label>
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
const l2AllChk = back.querySelector('#uf-l2all');
const applyL2All = () => {
const on = l2AllChk.checked;
l2Box.style.display = on ? 'none' : '';
back.querySelector('[data-ufact="all"]').style.display = on ? 'none' : '';
};
l2AllChk.addEventListener('change', applyL2All);
applyL2All();
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
body.L2All = l2AllChk.checked;
if (!l2AllChk.checked) {
for (const cb of l2Box.querySelectorAll('input[data-l2]')) {
if (cb.checked) body['L2_' + cb.dataset.l2] = true;
}
}
if (isEdit) {
if (!l2AllChk.checked) {
for (const k of Object.keys(existing)) {
if (k.startsWith('L2_') && existing[k] === true && !(k in body)) body[k] = false;
}
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
const BLANK = '（空欄にする）';
const sel = (id, opts) => `<select class="pr-input" id="${id}">` +
['<option>' + KEEP + '</option>'].concat(opts.map((o) => '<option>' + esc(o) + '</option>')).join('') +
'</select>';
const selCt = `<select class="pr-input" id="bk-ct">` +
['<option>' + KEEP + '</option>', '<option>' + BLANK + '</option>']
.concat(state.choices.changeType.map((o) => '<option>' + esc(o) + '</option>')).join('') + '</select>';
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="一括変更">
          <h4>一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更区分</label>${selCt}</div>
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
if (ct === BLANK) changes.ChangeType = '';
else if (ct !== KEEPV) changes.ChangeType = ct;
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
const REQS_GRID_KEY = 'reqs';
const reqFilter = { q: '', hideVerified: true };
const selectedReqIds = new Set();
const isReqTarget = (u) => {
const ct = (u.ChangeType || '').trim();
return !!ct && ct !== NO_CHANGE;
};
const reqStatusOf = (u) => u.WorkStatus || WORK_STATUS_DEFAULT;
const REQ_COLS = [
{ key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
{ key: 'company', label: '会社名', w: '130px', val: (u) => u.Company || '' },
{ key: 'email', label: 'メールアドレス', w: '170px', val: (u) => u.Email || '' },
{ key: 'changeType', label: '変更区分', w: '80px', val: (u) => u.ChangeType || '' },
{ key: 'permission', label: '権限', w: '80px', val: (u) => u.Permission || '' },
{ key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },
{ key: 'org2', label: '', w: '200px', val: null },
{ key: 'listKind', label: '区分', w: '90px', val: null },
{ key: 'status', label: '改廃ステータス', w: '130px', val: (u) => reqStatusOf(u) },
{ key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];
const reqColLabel = (c) => (c.key === 'org1' ? LABEL_L1 : c.key === 'org2' ? LABEL_L2 : c.label);
const reqCellText = (state, c, u) =>
(c.key === 'org2' ? userOrg2Text(state, u)
: c.key === 'listKind' ? userRegionLabel(state, u)
: c.key === 'modified' ? userCellText(state, USER_COLS.find((x) => x.key === 'modified'), u)
: c.val(u));
function visibleReqs(state) {
const f = reqFilter;
const q = f.q.trim().toLowerCase();
let list = state.users.filter((u) => {
if (!isReqTarget(u)) return false;
if (f.hideVerified && reqStatusOf(u) === WORK_STATUS_DONE) return false;
if (!gridRowPasses(REQS_GRID_KEY, (k) => reqCellText(state, REQ_COLS.find((c) => c.key === k), u))) return false;
if (q) {
const hay = REQ_COLS.map((c) => reqCellText(state, c, u)).join(' ').toLowerCase();
if (!hay.includes(q)) return false;
}
return true;
});
const s = gridSort(REQS_GRID_KEY, 'modified');
const col = REQ_COLS.find((c) => c.key === s.by) || REQ_COLS[REQ_COLS.length - 1];
const dir = s.dir === 'asc' ? 1 : -1;
return [...list].sort((a, b) =>
reqCellText(state, col, a).localeCompare(reqCellText(state, col, b), 'ja') * dir || (a.Id - b.Id) * dir);
}
function reqStatusClass(s) {
if (s === WORK_STATUS_DONE) return 'pr-rst--verified';
if (s === '改廃済み') return 'pr-rst--done';
return 'pr-rst--wait';
}
function reqViewHtml(state) {
if (!state.usersReady) {
return '<div class="pr-hero"><h4>「' + esc(LIST_USERS) + '」リストがまだありません</h4>' +
'<p>利用者一覧で登録するとここに改廃依頼が表示されます。</p></div>';
}
const list = visibleReqs(state);
const listIds = new Set(list.map((u) => u.Id));
for (const id of [...selectedReqIds]) if (!listIds.has(id)) selectedReqIds.delete(id);
const order = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
const cols = order.map((k) => REQ_COLS.find((c) => c.key === k)).filter(Boolean);
const sort = gridSort(REQS_GRID_KEY, 'modified');
const total = state.users.filter(isReqTarget).length;
const sel = selectedReqIds.size;
const thHtml = cols.map((c) => {
const active = sort.by === c.key;
const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
const filtered = gridColFiltered(REQS_GRID_KEY, c.key);
return '<th class="pr-th-sort' + (active ? ' active' : '') + (filtered ? ' pr-th-filtered' : '') +
'" data-col="' + c.key + '">' + esc(reqColLabel(c)) + arrow +
'<span class="pr-th-funnel">' + ico('filter') + '</span></th>';
}).join('');
const statusCell = (u) => {
const cur = reqStatusOf(u);
return '<select class="pr-chipsel ' + reqStatusClass(cur) + '" data-reqstatus="' + u.Id + '">' +
WORK_STATUS.map((s) => '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
'</select>';
};
const cellHtml = (c, u) => c.key === 'changeType' ? ctChipHtml(u.ChangeType || '')
: c.key === 'permission' ? pmChipHtml(u.Permission || '')
: c.key === 'listKind' ? regionChipHtml(userRegionLabel(state, u))
: esc(reqCellText(state, c, u));
const rowHtml = (u) => '<tr data-uid="' + u.Id + '" class="' + (u.SystemDeleted === true ? 'pr-udel' : '') + '">' +
'<td class="pr-uchk"><input type="checkbox" data-rsel="' + u.Id + '" aria-label="選択" ' +
(selectedReqIds.has(u.Id) ? 'checked' : '') + '></td>' +
cols.map((c) => c.key === 'status'
? '<td>' + statusCell(u) + '</td>'
: '<td>' + cellHtml(c, u) + '</td>').join('') +
'</tr>';
return `
    <div class="pr-sub pr-sub--users">
      ${sel
? `<b>選択中 ${sel}件</b>
           <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="req-bulk-status">ステータス一括変更</button>
           <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="req-clear-sel">選択解除</button>`
: `<b>改廃依頼一覧</b><span class="pr-count">${list.length}件${list.length !== total ? ' / 対象' + total + '件' : ''}</span>
           <span class="pr-note">変更区分が「${esc(NO_CHANGE)}」以外＝実機への登録作業待ち</span>`}
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" title="SPリストを新しいタブで開く">${ico('external')}SPで開く</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-rfilter-q" placeholder="検索(全列)" value="${esc(reqFilter.q)}">
      <span class="pr-note">列名をクリックでその列の値で絞り込み(Excelのオートフィルター)</span>
      <span style="flex:1"></span>
      <label class="pr-check"><input type="checkbox" id="pr-rfilter-verified" ${reqFilter.hideVerified ? 'checked' : ''}>結果確認済みを隠す</label>
    </div>
    <div class="pr-rows">
      <table class="pr-utable" data-grid="reqs">
        <colgroup>
          <col style="width:34px">
          ${cols.map((c) => '<col style="width:' + gridColWidth(REQS_GRID_KEY, c.key, c.w) + '">').join('')}
        </colgroup>
        <thead><tr>
          <th class="pr-uchk"><input type="checkbox" data-rsel-all aria-label="すべて選択" ${list.length && list.every((u) => selectedReqIds.has(u.Id)) ? 'checked' : ''}></th>
          ${thHtml}
        </tr></thead>
        <tbody>${list.map(rowHtml).join('') ||
'<tr><td colspan="' + (cols.length + 1) + '" class="pr-empty">改廃依頼はありません</td></tr>'}</tbody>
      </table>
    </div>`;
}
function reqAfterRender(app, state, ctx) {
const table = app.querySelector('.pr-utable[data-grid="reqs"]');
if (!table) return;
const order = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
const orderedCols = order.map((k) => REQ_COLS.find((c) => c.key === k)).filter(Boolean);
attachGrid(table, {
tableKey: REQS_GRID_KEY,
colKeys: [null].concat(order),
defaults: ['34px'].concat(orderedCols.map((c) => c.w)),
onReorder: (fromKey, toKey) => {
if (fromKey && toKey) {
const cur = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
gridWriteOrder(REQS_GRID_KEY, cur);
}
ctx.rerender();
},
});
const reflow = () => {
const tmp = document.createElement('div');
tmp.innerHTML = reqViewHtml(state);
table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
};
table.querySelector('thead').addEventListener('click', (e) => {
if (table.dataset.dragJustEnded) return;
if (e.target.closest('[data-rsel-all]') || e.target.closest('.pr-col-resize')) return;
const th = e.target.closest('th[data-col]');
if (!th) return;
const colKey = th.dataset.col;
const col = REQ_COLS.find((c) => c.key === colKey);
openGridColMenu({
tableKey: REQS_GRID_KEY,
colKey,
label: reqColLabel(col),
values: state.users.filter(isReqTarget).map((u) => reqCellText(state, col, u)),
anchor: th,
onSort: (dir) => { gridSetSort(REQS_GRID_KEY, colKey, dir); ctx.rerender(); },
onChange: () => { reflow(); th.classList.toggle('pr-th-filtered', gridColFiltered(REQS_GRID_KEY, colKey)); },
});
});
app.querySelector('#pr-rfilter-q').addEventListener('input', (e) => {
reqFilter.q = e.target.value;
reflow();
});
app.querySelector('#pr-rfilter-verified').addEventListener('change', (e) => {
reqFilter.hideVerified = e.target.checked;
ctx.rerender();
});
table.addEventListener('change', (e) => {
const sel = e.target.closest('[data-reqstatus]');
if (sel) ctx.onStatusChange(+sel.dataset.reqstatus, sel.value);
});
table.addEventListener('click', (e) => {
if (e.target.closest('[data-reqstatus]')) return;
const chkAll = e.target.closest('[data-rsel-all]');
if (chkAll) {
e.stopPropagation();
const list = visibleReqs(state);
const all = list.length && list.every((u) => selectedReqIds.has(u.Id));
list.forEach((u) => { all ? selectedReqIds.delete(u.Id) : selectedReqIds.add(u.Id); });
ctx.rerender();
return;
}
const chk = e.target.closest('[data-rsel]');
if (chk) {
e.stopPropagation();
const id = +chk.dataset.rsel;
chk.checked ? selectedReqIds.add(id) : selectedReqIds.delete(id);
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
function openReqStatusModal(count) {
return new Promise((resolve) => {
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="ステータス一括変更">
          <h4>改廃ステータスの一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更後のステータス</label>
            <select class="pr-input" id="rq-status">${
WORK_STATUS.map((s) => '<option>' + esc(s) + '</option>').join('')}</select></div>
          <span class="pr-note">「${esc(WORK_STATUS_DONE)}」にすると変更区分を空欄にし、改廃依頼一覧から外します。</span>
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
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) done(null);
return;
}
const b = e.target.closest('[data-mact]');
if (b) (b.dataset.mact === 'ok' ? done(back.querySelector('#rq-status').value) : done(null));
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(null); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done(back.querySelector('#rq-status').value);
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('#rq-status').focus();
});
}
function spOrg2Set(state, u) {
return activeL2Of(state, u.OrgLevel1 || '')
.filter((m) => u.L2All === true || u['L2_' + m.Id] === true)
.map((m) => m.Title);
}
function buildCompareResult(state, targets) {
const active = state.users.filter((u) => u.SystemDeleted !== true);
const idx = buildUserIndex(active);
const rows = [];
const matched = new Set();
for (const t of targets) {
const u = findExistingUser(idx, t.org1, t.email, t.name);
if (!u) {
rows.push({ type: 'リスト未登録', name: t.name, org1: t.org1,
detail: '実機にあるがリストに未登録(' + (t.permission || '権限なし') + ')' });
continue;
}
matched.add(u.Id);
const d = [];
if ((u.Permission || '') !== (t.permission || '')) {
d.push('権限: リスト「' + (u.Permission || '空') + '」/ 実機「' + (t.permission || '空') + '」');
}
if ((u.Company || '') !== (t.company || '')) {
d.push('会社名: リスト「' + (u.Company || '空') + '」/ 実機「' + (t.company || '空') + '」');
}
const sp = spOrg2Set(state, u).slice().sort();
const ex = (t.org2names || []).slice().sort();
if (JSON.stringify(sp) !== JSON.stringify(ex)) {
const onlySp = sp.filter((x) => !ex.includes(x));
const onlyEx = ex.filter((x) => !sp.includes(x));
d.push(LABEL_L2 + ': ' + [onlySp.map((x) => 'リストのみ「' + x + '」').join('、'),
onlyEx.map((x) => '実機のみ「' + x + '」').join('、')].filter(Boolean).join(' / '));
}
if (t.retired === true) d.push('在籍状態: 実機は退職、リストは有効のまま');
if (d.length) rows.push({ type: '差分あり', name: u.Title, org1: u.OrgLevel1, detail: d.join(' / ') });
}
for (const u of active) {
if (matched.has(u.Id)) continue;
rows.push({ type: '実機未登録', name: u.Title, org1: u.OrgLevel1,
detail: 'リストにあるが実機CSVに無い' });
}
const rank = { '差分あり': 0, 'リスト未登録': 1, '実機未登録': 2 };
rows.sort((a, b) => (rank[a.type] - rank[b.type]) ||
a.org1.localeCompare(b.org1, 'ja') || a.name.localeCompare(b.name, 'ja'));
return rows;
}
const COMPARE_TYPE_CLASS = {
'差分あり': 'pr-cmp--diff', 'リスト未登録': 'pr-cmp--add', '実機未登録': 'pr-cmp--miss',
};
function compareViewHtml(state) {
const res = state.compareResult;
const head = `
    <div class="pr-syncbar">
      <span>実機の利用者情報CSV(CSVインポートと同じ形式)を取り込み、「${esc(LIST_USERS)}」リストとの差分を表示します(読み取り専用)。</span>
      <button class="pr-btn pr-btn--primary" data-act="compare-import" ${state.usersReady ? '' : 'disabled'}>${ico('plus')}実機CSVを選んで比較</button>
    </div>`;
if (!res) {
return head + '<div class="pr-hero"><h4>実機CSVを取り込んでください</h4>' +
'<p>取込対象の権限(更新者/閲覧者に対応する区分)のみ比較します。</p></div>';
}
if (!res.rows.length) {
return head + '<div class="pr-hero"><h4>差分はありません</h4>' +
'<p>実機CSV ' + res.scanned + '件とリストの登録内容は一致しています。</p></div>';
}
const counts = { '差分あり': 0, 'リスト未登録': 0, '実機未登録': 0 };
for (const r of res.rows) counts[r.type]++;
const rowsHtml = res.rows.map((r) => `
    <tr>
      <td><span class="pr-cmp ${COMPARE_TYPE_CLASS[r.type] || ''}">${esc(r.type)}</span></td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.org1)}</td>
      <td>${esc(r.detail)}</td>
    </tr>`).join('');
return head + `
    <div class="pr-sub pr-sub--users">
      <b>差分 ${res.rows.length}件</b>
      <span class="pr-count">差分あり ${counts['差分あり']} / リスト未登録 ${counts['リスト未登録']} / 実機未登録 ${counts['実機未登録']}</span>
      <span class="pr-note">実機CSV ${res.scanned}件と比較</span>
    </div>
    <div class="pr-rows">
      <table class="pr-utable">
        <colgroup><col style="width:96px"><col style="width:160px"><col style="width:140px"><col></colgroup>
        <thead><tr><th>区分</th><th>利用者名</th><th>${esc(LABEL_L1)}</th><th>内容</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}
function helpViewHtml() {
const sec = (title, items) => `
    <div class="pr-help-sec">
      <h5>${title}</h5>
      <ul>${items.map((t) => '<li>' + t + '</li>').join('')}</ul>
    </div>`;
return `
    <div class="pr-help">
      <div class="pr-sub pr-sub--users"><b>ヘルプ</b><span class="pr-note">このツールの使い方(要点)</span></div>
      <div class="pr-help-body">
        ${sec('はじめに', [
'このツールは SharePoint 上の「利用者の権限登録リスト」を管理する補助ツールです。',
'まず<b>マスタ管理</b>で組織区分を登録 →「リストへ反映」、または<b>利用者一覧</b>の「CSVインポート」から始めると、必要なリストを自動作成します。',
'更新作業はすべて SharePoint のリストに保存されます(このツールは表示と操作の補助)。',
])}
        ${sec('利用者一覧', [
'登録状況の確認・編集の画面。行をクリックで編集、<b>新規登録</b>で追加。',
'チェックして<b>一括変更</b>(変更区分・権限・システム削除)/<b>物理削除</b>。',
'<b>CSVインポート</b>=現在の登録状況を一括取込(変更区分は空欄)。<b>Excel出力/取込</b>=' + esc(LABEL_L1) + 'ごとの表で入出力。',
'<b>SPで開く</b>=SharePoint のリストを新しいタブで表示。',
])}
        ${sec('改廃依頼一覧', [
'変更区分が「' + esc(NO_CHANGE) + '」以外＝実機への登録作業待ちの一覧。',
'改廃ステータス(<b>作業待ち→改廃済み→結果確認済み</b>)をその場で変更、または選択して一括変更。',
'「結果確認済み」にすると変更区分が空欄に戻り、一覧から外れます(=対応完了)。',
])}
        ${sec('実機差分チェック', [
'実機の利用者情報CSV(取込と同じ形式)を読み込み、リストとの差分を表示(読み取り専用)。',
'リスト未登録 / 実機未登録 / 差分あり(権限・' + esc(LABEL_L2) + '・会社名・在籍)を一覧します。',
])}
        ${sec('マスタ管理', [
esc(LABEL_L1) + ' / ' + esc(LABEL_L2) + 'の登録・改名・並べ替え・有効無効。',
'各' + esc(LABEL_L1) + 'の<b>鍵アイコン</b>で、その行を参照・更新できる SP 権限グループを割当。',
'<b>リストへ反映</b>=マスタの内容(選択肢・チェック列・集計・権限)を利用者一覧へ一括適用。未反映の変更はバッジで表示され「破棄」も可能。',
])}
        ${sec('設定', [
'<b>リスト名の接頭辞</b>(共通設定)=全員で共有。複数の運用を分けたいときに使用。',
'<b>変更区分/権限の選択肢</b>・<b>管理者グループ</b>(全行にフルコントロール)を共通設定で編集。',
'<b>操作ログ</b>=このツールから行った更新作業の記録を確認(参照は記録しません)。',
])}
        ${sec('運用の流れ(例)', [
'マスタ登録 →「リストへ反映」→ CSVで現状取込 → 変更があった人の変更区分を設定 →' +
' 改廃依頼一覧で実機作業を進め、ステータスを更新 → 結果確認済みで完了。',
])}
      </div>
    </div>`;
}
async function ensureCommonList() {
await ensureList(LIST_COMMON, 'WebReg の共通設定(全員で共有。リスト接頭辞など)');
await ensureField(LIST_COMMON, 'Value', '値', { FieldTypeKind: 3 });
}
async function getCommonItem(key) {
if (!(await listId(LIST_COMMON))) return null;
const j = await spGet(lt(LIST_COMMON) + "/items?$select=Id,Value&$filter=Title eq '" + key + "'&$top=1");
return (j.value || [])[0] || null;
}
async function getCommonSetting(key) {
try {
const it = await getCommonItem(key);
return it ? (it.Value || '') : null;
} catch { return null; }
}
async function setCommonSetting(key, value) {
await ensureCommonList();
const it = await getCommonItem(key);
const body = { Title: key, Value: value };
if (it) await spMerge(lt(LIST_COMMON) + '/items(' + it.Id + ')', body);
else await spPost(lt(LIST_COMMON) + '/items', body);
}
async function bootstrapPrefixFromCommon() {
const remote = await getCommonSetting('listPrefix');
if (remote == null) return false;
const cur = listPrefix();
if (remote === cur) return false;
try { localStorage.setItem(LS_LIST_PREFIX, remote); } catch { }
applyListPrefix();
return true;
}
async function loadListAssign() {
try {
const v = await getCommonSetting('listAssign');
return v ? (JSON.parse(v) || {}) : {};
} catch { return {}; }
}
async function saveListAssign(map) {
await setCommonSetting('listAssign', JSON.stringify(map || {}));
}
const assignOf = (state, org1Title) => (state.listAssign && state.listAssign[org1Title]) || 'ja';
const goesToJa = (a) => a === 'ja' || a === 'both' || !a;
const goesToEn = (a) => a === 'en' || a === 'both';
const anyEnAssigned = (state) => state.l1.some((x) => goesToEn(assignOf(state, x.Title)));
async function ensureAuditList() {
if (await listId(LIST_AUDIT)) return false;
await ensureList(LIST_AUDIT, 'WebReg の操作ログ(更新作業の記録)');
await spMerge(lt(LIST_AUDIT) + "/fields/getbyinternalnameortitle('Title')", { Title: '操作' });
await ensureField(LIST_AUDIT, 'ActedAt', '日時', { FieldTypeKind: 4 });
await ensureField(LIST_AUDIT, 'Actor', '実行者', { FieldTypeKind: 2 });
await ensureField(LIST_AUDIT, 'Detail', '内容', { FieldTypeKind: 3 });
try { await addViewFields(LIST_AUDIT, ['ActedAt', 'Actor', 'Detail']); } catch { }
return true;
}
let _auditActor = null;
async function auditActor() {
if (_auditActor != null) return _auditActor;
try {
const me = await spGet('/_api/web/currentuser?$select=Title,Email');
_auditActor = me.Title || me.Email || '';
} catch { _auditActor = ''; }
return _auditActor;
}
async function auditLog(action, detail) {
try {
await ensureAuditList();
const actor = await auditActor();
await spPost(lt(LIST_AUDIT) + '/items', {
Title: action,
ActedAt: new Date().toISOString(),
Actor: actor,
Detail: detail || '',
});
} catch (e) {
if (isDebug()) console.warn('[WebReg] 操作ログの記録に失敗:', e.message);
}
}
async function loadAuditLog(limit) {
if (!(await listId(LIST_AUDIT))) return [];
const top = Math.min(Math.max(limit || 200, 1), 2000);
const j = await spGet(lt(LIST_AUDIT) +
'/items?$select=Title,ActedAt,Actor,Detail&$orderby=ActedAt desc,Id desc&$top=' + top);
return j.value || [];
}
function openAuditLogModal() {
return new Promise((resolve) => {
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="操作ログ">
          <h4>操作ログ(更新作業)</h4>
          <span class="pr-note">このツールから行った更新操作の記録です(参照操作は記録されません)。新しい順に最大200件。</span>
          <div class="pr-rows" style="max-height:50vh">
            <table class="pr-utable">
              <colgroup><col style="width:140px"><col style="width:120px"><col style="width:110px"><col></colgroup>
              <thead><tr><th>日時</th><th>操作</th><th>実行者</th><th>内容</th></tr></thead>
              <tbody><tr><td colspan="4" class="pr-empty">読み込み中…</td></tr></tbody>
            </table>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          </div>
        </div>
      </div>`);
const done = () => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve();
};
const fmt = (iso) => {
const d = new Date(iso || '');
if (isNaN(+d)) return '';
const p = (n) => String(n).padStart(2, '0');
return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' +
p(d.getHours()) + ':' + p(d.getMinutes());
};
(async () => {
let rows;
try { rows = await loadAuditLog(200); } catch (e) {
back.querySelector('tbody').innerHTML =
'<tr><td colspan="4" class="pr-empty">取得に失敗しました — ' + esc(e.message) + '</td></tr>';
return;
}
back.querySelector('tbody').innerHTML = rows.length
? rows.map((r) => '<tr><td>' + esc(fmt(r.ActedAt)) + '</td><td>' + esc(r.Title || '') +
'</td><td>' + esc(r.Actor || '') + '</td><td>' + esc(r.Detail || '') + '</td></tr>').join('')
: '<tr><td colspan="4" class="pr-empty">記録された操作ログはありません</td></tr>';
})();
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) { if (downOnBack) done(); return; }
if (e.target.closest('[data-mact]')) done();
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(); }
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
});
}
const BACKUP_VERSION = 1;
function backupDownload(obj, filename) {
const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = filename;
document.body.appendChild(a);
a.click();
setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function pickJsonFile() {
return new Promise((resolve) => {
const inp = document.createElement('input');
inp.type = 'file';
inp.accept = '.json,application/json';
inp.style.display = 'none';
let settled = false;
const settle = (v) => { if (!settled) { settled = true; resolve(v); inp.remove(); } };
inp.addEventListener('change', () => settle(inp.files && inp.files[0] ? inp.files[0] : null));
window.addEventListener('focus', () => setTimeout(() => settle(null), 500), { once: true });
document.body.appendChild(inp);
inp.click();
});
}
async function dumpList(title) {
if (!(await listId(title))) return null;
const fields = (await spGet(lt(title) +
'/fields?$select=InternalName,Title,TypeAsString,Formula,ClientValidationFormula,' +
'CustomFormatter,Choices,DefaultValue,Hidden,ReadOnlyField&$filter=Hidden eq false')).value || [];
let view = [];
try { view = (await spGet(lt(title) + '/defaultview/viewfields')).Items || []; } catch { }
const items = (await spGet(lt(title) + '/items?$select=*&$top=5000')).value || [];
return {
name: title,
fields: fields.map((f) => ({
internal: f.InternalName, title: f.Title, type: f.TypeAsString,
formula: f.Formula || null, condition: f.ClientValidationFormula || null,
formatter: f.CustomFormatter || null, choices: f.Choices || null,
defaultValue: f.DefaultValue || null,
})),
view, items,
};
}
async function buildBackup(state, stamp) {
const lists = {};
for (const [key, title] of [['l1', LIST_L1], ['l2', LIST_L2], ['users', LIST_USERS],
['conf', LIST_CONF], ['audit', LIST_AUDIT], ['common', LIST_COMMON]]) {
lists[key] = await dumpList(title);
}
return { version: BACKUP_VERSION, exportedAt: stamp || '', prefix: listPrefix(), lists };
}
async function resetAllItems(log, opts) {
const includeMasters = !!(opts && opts.includeMasters);
const targets = [['利用者一覧', LIST_USERS], ['利用者一覧(英語)', LIST_USERS_EN]];
if (includeMasters) targets.push([LABEL_L2, LIST_L2], [LABEL_L1, LIST_L1]);
const summary = {};
for (const [label, title] of targets) {
if (!(await listId(title))) { summary[label] = 0; continue; }
const items = (await spGet(lt(title) + '/items?$select=Id&$top=5000')).value || [];
let n = 0;
for (const it of items) {
log(label + 'を空にしています… (' + (++n) + '/' + items.length + ')');
try { await spDelete(lt(title) + '/items(' + it.Id + ')'); } catch { }
}
summary[label] = items.length;
}
if (includeMasters) {
log('派生列を整理中…');
try { await dropDerivedUserColumns(); } catch { }
}
return summary;
}
function openResetModal() {
return new Promise((resolve) => {
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="リストのリセット">
          <h4>リストのリセット</h4>
          <span class="pr-note">SP 上のリストのアイテムを削除して空にします(リストの構造は残ります)。
            この操作は元に戻せません。先に「バックアップ取得」を推奨します。操作ログ・共通設定は残ります。</span>
          <div class="pr-field" style="margin-top:var(--s-3)">
            <label class="pr-check"><input type="radio" name="rst-mode" value="users" checked>
              利用者データのみ削除(マスタは残す)</label>
            <span class="pr-note" style="margin-left:24px">利用者一覧 / 利用者一覧(英語)を空にします。${esc(LABEL_L1)}・${esc(LABEL_L2)}マスタは保持。</span>
            <label class="pr-check" style="margin-top:var(--s-2)"><input type="radio" name="rst-mode" value="all">
              マスタも含めて全削除</label>
            <span class="pr-note" style="margin-left:24px">利用者データに加えて${esc(LABEL_L1)}・${esc(LABEL_L2)}マスタも削除し、派生列も一掃します。</span>
          </div>
          <label class="pr-check" style="margin-top:var(--s-3)"><input type="checkbox" id="rst-confirm">
            上記を理解し、削除を実行します</label>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--danger" data-mact="ok" disabled>削除を実行</button>
          </div>
        </div>
      </div>`);
const okBtn = back.querySelector('[data-mact="ok"]');
back.querySelector('#rst-confirm').addEventListener('change', (e) => { okBtn.disabled = !e.target.checked; });
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) { if (downOnBack) done(null); return; }
const b = e.target.closest('[data-mact]');
if (!b) return;
if (b.dataset.mact !== 'ok') { done(null); return; }
if (!back.querySelector('#rst-confirm').checked) return;
const mode = back.querySelector('input[name="rst-mode"]:checked').value;
done({ includeMasters: mode === 'all' });
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(null); }
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
});
}
async function restoreBackup(state, backup, log, reflectFn) {
if (!backup || !backup.lists) throw new Error('バックアップ形式が不正です');
const L = backup.lists;
log('マスタリストを準備中…');
await setup(log);
log(LABEL_L1 + 'を復元中…');
const curL1 = (await spGet(lt(LIST_L1) + '/items?$select=Id,Title')).value || [];
const l1ByTitle = new Map(curL1.map((x) => [x.Title, x.Id]));
const oldL1IdToTitle = new Map((L.l1 ? L.l1.items : []).map((x) => [x.Id, x.Title]));
for (const x of (L.l1 ? L.l1.items : [])) {
if (l1ByTitle.has(x.Title)) continue;
const body = { Title: x.Title, SortOrder: x.SortOrder || 0, Active: x.Active !== false };
if (x.PermEdit) body.PermEdit = x.PermEdit;
if (x.PermRead) body.PermRead = x.PermRead;
const j = await spPost(lt(LIST_L1) + '/items', body);
l1ByTitle.set(x.Title, j.Id);
}
log(LABEL_L2 + 'を復元中…');
const curL2 = (await spGet(lt(LIST_L2) + '/items?$select=Id,Title,Level1/Id&$expand=Level1')).value || [];
const l2Key = (parentTitle, title) => parentTitle + ' ' + title;
const l2Have = new Set(curL2.map((x) => {
const pt = x.Level1 ? [...l1ByTitle.entries()].find(([, id]) => id === x.Level1.Id) : null;
return l2Key(pt ? pt[0] : '', x.Title);
}));
const oldL2 = (L.l2 ? L.l2.items : []);
const oldL2IdInfo = new Map();
for (const x of oldL2) {
const parentTitle = oldL1IdToTitle.get(x.Level1Id || (x.Level1 && x.Level1.Id)) || '';
oldL2IdInfo.set(x.Id, { parentTitle, title: x.Title });
if (l2Have.has(l2Key(parentTitle, x.Title))) continue;
const newParentId = l1ByTitle.get(parentTitle);
if (!newParentId) continue;
await spPost(lt(LIST_L2) + '/items', {
Title: x.Title, SortOrder: x.SortOrder || 0, Active: x.Active !== false, Level1Id: newParentId,
});
l2Have.add(l2Key(parentTitle, x.Title));
}
log('派生列を整理中…');
await dropDerivedUserColumns();
log('スキーマを再構築中…');
await loadAllForRestore(state);
await reflectFn(state, log);
log('利用者を復元中…');
const newL2 = (await spGet(lt(LIST_L2) + '/items?$select=Id,Title,Level1/Id&$expand=Level1')).value || [];
const l1IdToTitle = new Map([...l1ByTitle.entries()].map(([t, id]) => [id, t]));
const l2ColByKey = new Map(newL2.map((x) =>
[l2Key(x.Level1 ? l1IdToTitle.get(x.Level1.Id) : '', x.Title), 'L2_' + x.Id]));
const users = (L.users ? L.users.items : []);
let restored = 0;
for (const u of users) {
log('利用者を復元中… (' + (++restored) + '/' + users.length + ')');
const body = {
Title: u.Title, Company: u.Company || '', Email: u.Email || '',
ChangeType: u.ChangeType || '', Permission: u.Permission || '', OrgLevel1: u.OrgLevel1 || '',
Notes: u.Notes || '', SystemDeleted: u.SystemDeleted === true, L2All: u.L2All === true,
WorkStatus: u.WorkStatus || WORK_STATUS_DEFAULT,
};
for (const k of Object.keys(u)) {
if (!k.startsWith('L2_') || u[k] !== true) continue;
const info = oldL2IdInfo.get(+k.slice(3));
if (!info) continue;
const col = l2ColByKey.get(l2Key(info.parentTitle, info.title));
if (col) body[col] = true;
}
try { await spPost(lt(LIST_USERS) + '/items', body); } catch { }
}
log('設定を復元中…');
try {
for (const it of (L.conf ? L.conf.items : [])) {
if (it.Title && it.Value != null) await setConfValue(it.Title, it.Value);
}
for (const it of (L.common ? L.common.items : [])) {
if (it.Title && it.Value != null) await setCommonSetting(it.Title, it.Value);
}
} catch { }
return { l1: l1ByTitle.size, users: restored };
}
async function dropDerivedUserColumns() {
if (!(await listId(LIST_USERS))) return;
for (const pre of ['L2_', 'O2S_']) {
const fields = (await spGet(lt(LIST_USERS) +
"/fields?$select=InternalName&$filter=startswith(InternalName,'" + pre + "')")).value || [];
for (const f of fields) {
try { await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + f.InternalName + "')"); } catch { }
}
}
try { await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')"); } catch { }
}
async function loadAllForRestore(state) {
const [r1, r2] = await Promise.all([
spGet(lt(LIST_L1) + '/items?$select=*&$orderby=SortOrder,Id&$top=4999'),
spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
]);
state.l1 = r1.value || [];
state.l2 = r2.value || [];
}
async function setConfValue(key, value) {
await ensureList(LIST_CONF, 'WebReg の設定');
await ensureField(LIST_CONF, 'Value', '値', { FieldTypeKind: 3 });
const j = await spGet(lt(LIST_CONF) + "/items?$select=Id&$filter=Title eq '" + key + "'&$top=1");
const it = (j.value || [])[0];
if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', { Title: key, Value: value });
else await spPost(lt(LIST_CONF) + '/items', { Title: key, Value: value });
}
function openSettingsModal(state, handlers) {
return new Promise((resolve) => {
openSettingsModalInner(state, resolve, handlers || {});
});
}
function openSettingsModalInner(state, resolve, handlers) {
const srcInfo = (window.__webregSource && window.__webregSource.base) || '直接実行(埋め込み/開発コンソール)';
const isLocal = localStorage.getItem(LS_DEV_SOURCE) === 'local';
const localBase = localStorage.getItem(LS_DEV_BASE) || DEFAULT_LOCAL_BASE;
const back = el(`
    <div class="pr-backdrop">
      <div class="pr-modal pr-modal--hub" role="dialog" aria-modal="true" aria-label="設定">
        <h4>設定</h4>
        <div class="pr-hub-body">
          <nav class="pr-hub-nav" aria-label="設定メニュー">
            <button class="pr-nav-item active" data-hub="personal">個人設定<small>この端末に保存</small></button>
            <button class="pr-nav-item" data-hub="shared">共通設定<small>SP リストに保存(全員に適用)</small></button>
            <button class="pr-nav-item" data-hub="dev">開発者<small>配信元 / バージョン</small></button>
          </nav>
          <div class="pr-hub-panels">
            <div class="pr-hub-panel" data-hubpanel="personal">
              <div class="pr-field">
                <label>操作ログ(このツールからの更新作業の記録)</label>
                <button class="pr-btn pr-btn--secondary" data-sact="audit">${ico('refresh-cw')}操作ログを開く</button>
                <span class="pr-note">参照操作は記録されません。更新作業だけを新しい順に表示します(全員共有)。</span>
              </div>
            </div>
            <div class="pr-hub-panel" data-hubpanel="shared" style="display:none">
              <div class="pr-field">
                <label>リスト名の接頭辞(このツールが作成/参照する SP リスト名の先頭。全員で共有)</label>
                <input type="text" class="pr-input" id="pr-list-prefix" value="${esc(listPrefix())}" placeholder="例: WebReg_">
                <span class="pr-note">現在の対象: ${esc(LIST_L1)} / ${esc(LIST_L2)} / ${esc(LIST_USERS)}。
                  「${esc(LIST_COMMON)}」リストに保存し、起動時に全員がこの接頭辞を参照します。
                  変更しても既存リストの名前は変わりません(以後は新しい接頭辞のリストを参照/作成)。</span>
              </div>
              <div class="pr-field">
                <label>「変更区分」の選択肢(1行1件)</label>
                <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-ct" rows="4" ${state.usersReady ? '' : 'disabled'}></textarea>
              </div>
              <div class="pr-field">
                <label>「権限」の選択肢(1行1件)</label>
                <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-pm" rows="3" ${state.usersReady ? '' : 'disabled'}></textarea>
                ${state.usersReady ? '' : '<span class="pr-note">「リストへ反映」で利用者一覧リストを作成すると編集できます。</span>'}
              </div>
              <span class="pr-note">保存すると利用者一覧リストの列の選択肢に即反映されます(全員に適用)。</span>
              <div class="pr-field">
                <label>管理者グループ(「権限を反映」時に全行へフルコントロールを付与)</label>
                <div class="pr-checks pr-checks--perm" id="pr-admin-groups"><span class="pr-note">権限グループを取得中…</span></div>
                <span class="pr-note">「${esc(LIST_CONF)}」リストに保存します(全員共有)。行の参照/更新グループの割当はマスタ管理の鍵アイコンから。</span>
              </div>
              <div class="pr-field">
                <label>利用者リストの振り分け(${esc(LABEL_L1)}ごとに 国内/海外/両方)</label>
                <div class="pr-checks" id="pr-list-assign" style="display:block; max-height:200px; overflow:auto">
                  ${state.l1.filter((x) => x.Active !== false).map((x) => {
const a = (state.listAssign && state.listAssign[x.Title]) || 'ja';
return '<div class="pr-assign-row"><span>' + esc(x.Title) +
(x.TitleEn ? ' <small>(' + esc(x.TitleEn) + ')</small>' : '') + '</span>' +
'<select class="pr-input pr-fsel" data-assign="' + esc(x.Title) + '">' +
['ja', 'en', 'both'].map((v) => '<option value="' + v + '"' + (a === v ? ' selected' : '') + '>' +
(v === 'ja' ? '国内' : v === 'en' ? '海外' : '両方') + '</option>').join('') +
'</select></div>';
}).join('') || '<span class="pr-note">' + esc(LABEL_L1) + 'がありません</span>'}
                </div>
                <span class="pr-note">国内=日本語リスト / 海外=英語リスト / 両方=両方に登録。「${esc(LIST_COMMON)}」に保存(全員共有)。</span>
              </div>
              <div class="pr-field">
                <label>データ管理(バックアップ / リストア)</label>
                <div style="display:flex; gap:var(--s-3); flex-wrap:wrap">
                  <button class="pr-btn pr-btn--secondary" data-sact="backup">バックアップ取得</button>
                  <button class="pr-btn pr-btn--secondary" data-sact="restore">リストア(復元)</button>
                </div>
                <span class="pr-note">バックアップ=管理用を含む全リストの内容・集計式・条件式・書式をJSONで保存。
                  リストア=そのJSONから復元(空のリストからでも戻せます)。リセットは「開発者」タブにあります。</span>
              </div>
            </div>
            <div class="pr-hub-panel" data-hubpanel="dev" style="display:none">
              <div class="pr-kv">バージョン: <code>${esc(BUILD)}</code> / 今回の読込元: <code>${esc(srcInfo)}</code></div>
              <div class="pr-field">
                <label>リストのリセット</label>
                <button class="pr-btn pr-btn--danger" data-sact="reset">リストをリセット…</button>
                <span class="pr-note">SP 上のリストのアイテムを削除して空にします(構造は残る)。
                  「利用者データのみ(マスタは残す)」か「マスタも含めて全削除」を選べます。操作ログ・共通設定は残ります。
                  元に戻せないため、先にバックアップ取得を推奨。</span>
              </div>
              <div class="pr-field">
                <label>bundle の配信元(ブックマークレット起動時にどこから本体を読むか)</label>
                <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${isLocal ? '' : 'checked'}>
                  SharePoint (ドキュメント/webreg/ に配置した dist)</label>
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
                <span class="pr-note">webreg.bundle.js を含むフォルダの絶対パス。保存で即切替(サーバ再起動で既定の dist/ に戻る)。</span>
              </div>
              <label class="pr-check"><input type="checkbox" id="pr-debug" ${isDebug() ? 'checked' : ''}>
                詳細ログをブラウザのコンソールに出力(全RESTリクエスト。エラーは常時出力)</label>
              <span class="pr-note">通常運用は「SharePoint」を選べばサーバ類は一切不要です(dist を ドキュメント/webreg/ に配置)。
                ローカル開発サーバと配信フォルダは開発時のみ使用。配信設定は次回のブックマークレット起動から反映されます。</span>
              <div class="pr-field">
                <label>利用OSS・ライセンス</label>
                <div class="pr-oss">このツールは<b>外部のOSS・ライブラリを実行時に一切使用していません</b>(ランタイム依存ゼロ／
                  ブラウザ標準APIのみ)。.xlsx の読み書き・ZIP 展開・CSV 解析・UI もすべて自前実装で、
                  CDN 等から外部コードを取得することもありません。ビルドは Python 標準ライブラリのみ(外部パッケージ不要)。
                  したがって第三者OSSのライセンス表記の対象はありません。</div>
              </div>
            </div>
          </div>
        </div>
        <div class="pr-modal-actions">
          <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
        </div>
      </div>
    </div>`);
back.querySelector('.pr-hub-nav').addEventListener('click', (e) => {
const item = e.target.closest('[data-hub]');
if (!item) return;
back.querySelectorAll('.pr-hub-nav .pr-nav-item').forEach((n) => n.classList.toggle('active', n === item));
back.querySelectorAll('.pr-hub-panel').forEach((p) => {
p.style.display = p.dataset.hubpanel === item.dataset.hub ? '' : 'none';
});
});
back.querySelector('[data-sact="audit"]').addEventListener('click', () => { openAuditLogModal(); });
back.querySelector('[data-sact="backup"]').addEventListener('click', () => { if (handlers.onBackup) handlers.onBackup(); });
back.querySelector('[data-sact="restore"]').addEventListener('click', () => { close(); if (handlers.onRestore) handlers.onRestore(); });
back.querySelector('[data-sact="reset"]').addEventListener('click', () => { close(); if (handlers.onReset) handlers.onReset(); });
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
const adminBox = back.querySelector('#pr-admin-groups');
let adminLoadedIds = null;
(async () => {
try {
const [groups, ids] = await Promise.all([fetchSiteGroups(), loadAdminGroupIds()]);
adminLoadedIds = ids;
adminBox.innerHTML = permChecksHtml('a', groups, ids);
} catch (e) {
adminBox.innerHTML = '<span class="pr-note">権限グループを取得できません — ' + esc(e.message) + '</span>';
}
})();
const close = () => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve();
};
const save = async () => {
const prefix = back.querySelector('#pr-list-prefix').value.trim();
if (/[\\/:*?"<>|#%]/.test(prefix)) {
toast('warn', '接頭辞に \\ / : * ? " < > | # % は使えません');
return;
}
const prefixChanged = prefix !== listPrefix();
if (prefixChanged) {
try {
await setCommonSetting('listPrefix', prefix);
auditLog('接頭辞の変更', 'リスト接頭辞を「' + (prefix || '(なし)') + '」に設定');
} catch (e) {
toast('err', '接頭辞の保存に失敗しました — ' + e.message);
return;
}
localStorage.setItem(LS_LIST_PREFIX, prefix);
applyListPrefix();
}
if (state.usersReady && !prefixChanged) {
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
auditLog('選択肢の変更', [changedCt ? '変更区分' : '', changedPm ? '権限' : ''].filter(Boolean).join(' / ') + 'を更新');
} catch (e) {
toast('err', '選択肢の更新に失敗しました — ' + e.message);
return;
}
}
}
if (adminLoadedIds && !prefixChanged) {
const ids = collectPermIds(back, 'a');
if (JSON.stringify(ids) !== JSON.stringify(adminLoadedIds)) {
try {
await saveAdminGroupIds(ids);
auditLog('管理者グループの変更', '管理者グループを ' + ids.length + '件に設定');
adminLoadedIds = ids;
} catch (e) {
toast('err', '管理者グループの保存に失敗しました — ' + e.message);
return;
}
}
}
if (!prefixChanged) {
const assign = {};
back.querySelectorAll('[data-assign]').forEach((s) => {
if (s.value !== 'ja') assign[s.dataset.assign] = s.value;
});
if (JSON.stringify(assign) !== JSON.stringify(state.listAssign || {})) {
try {
await saveListAssign(assign);
state.listAssign = assign;
auditLog('利用者リスト振り分けの変更', Object.keys(assign).length + '件の' + LABEL_L1 + 'を国内以外に設定');
} catch (e) {
toast('err', '振り分けの保存に失敗しました — ' + e.message);
return;
}
}
}
if (back.querySelector('#pr-debug').checked) localStorage.setItem(LS_DEBUG, '1');
else localStorage.removeItem(LS_DEBUG);
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
back.querySelector('#pr-list-prefix').focus();
}
const CSV_PERM_MAP = {
'事業場ITセキュリティ責任者': '更新者',
'情報閲覧者': '閲覧者',
};
const uOrg1 = (s) => String(s == null ? '' : s).trim();
const uEmailKey = (org1, email) => {
const e = String(email == null ? '' : email).trim().toLowerCase();
return e ? uOrg1(org1) + ' m ' + e : null;
};
const uNameKey = (org1, name) => uOrg1(org1) + ' n ' + String(name == null ? '' : name).trim();
function buildUserIndex(users) {
const byEmail = new Map();
const byName = new Map();
for (const u of users) {
const ek = uEmailKey(u.OrgLevel1, u.Email);
if (ek && !byEmail.has(ek)) byEmail.set(ek, u);
const nk = uNameKey(u.OrgLevel1, u.Title);
if (!byName.has(nk)) byName.set(nk, u);
}
return { byEmail, byName };
}
const findExistingUser = (idx, org1, email, name) =>
(email && idx.byEmail.get(uEmailKey(org1, email))) || idx.byName.get(uNameKey(org1, name)) || null;
function decodeCsvBuffer(buf) {
try {
return new TextDecoder('utf-8', { fatal: true }).decode(buf);
} catch {
return new TextDecoder('shift_jis').decode(buf);
}
}
function parseCsvText(text) {
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const rows = [];
let row = [];
let field = '';
let inQ = false;
for (let i = 0; i < text.length; i++) {
const c = text[i];
if (inQ) {
if (c === '"') {
if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
} else field += c;
} else if (c === '"') {
inQ = true;
} else if (c === ',') {
row.push(field); field = '';
} else if (c === '\n') {
row.push(field); field = '';
rows.push(row); row = [];
} else if (c !== '\r') {
field += c;
}
}
if (field !== '' || row.length) { row.push(field); rows.push(row); }
return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}
const normHeader = (s) => String(s || '').replace(/[\s　「」]/g, '');
const CSV_HEADERS = {
name: ['名前', '氏名'],
company: ['会社名'],
email: ['メールアドレス'],
perm: ['権限'],
org1: ['組織区分第1階層'],
org2: ['組織区分第2階層'],
region: ['地域区分'],
retired: ['退職者フラグ'],
firstBy: ['初回登録者'],
firstAt: ['初回登録日時'],
lastBy: ['最終更新者'],
lastAt: ['最終更新日時'],
};
function buildImportPlan(state, rows) {
if (rows.length < 3) throw new Error('データ行がありません(1行目ヘッダー/2行目説明/3行目以降データ)');
const header = rows[0].map(normHeader);
const idx = {};
for (const [key, labels] of Object.entries(CSV_HEADERS)) {
idx[key] = -1;
for (const label of labels) {
const i = header.indexOf(label);
if (i >= 0) { idx[key] = i; break; }
}
}
for (const required of ['name', 'perm', 'org1']) {
if (idx[required] < 0) throw new Error('ヘッダー「' + CSV_HEADERS[required][0] + '」が見つかりません');
}
const cell = (r, key) => (idx[key] >= 0 ? String(r[idx[key]] || '').trim() : '');
const targets = [];
let skippedPerm = 0;
let retired = 0;
const dupErrors = [];
const seenEmail = new Set();
const seenName = new Set();
for (const r of rows.slice(2)) {
const name = cell(r, 'name');
if (!name) continue;
const mapped = CSV_PERM_MAP[cell(r, 'perm')];
if (!mapped) { skippedPerm++; continue; }
const org1 = cell(r, 'org1');
const email = cell(r, 'email');
const ek = uEmailKey(org1, email);
const nk = uNameKey(org1, name);
if ((ek && seenEmail.has(ek)) || seenName.has(nk)) {
dupErrors.push({ name, org1, reason: ek && seenEmail.has(ek) ? '同じメールアドレス' : '同じ氏名' });
continue;
}
if (ek) seenEmail.add(ek);
seenName.add(nk);
const isRetired = cell(r, 'retired') === '1';
if (isRetired) retired++;
targets.push({
name,
company: cell(r, 'company'),
email,
permission: mapped,
org1,
org2names: cell(r, 'org2').split(/[，、,]/).map((x) => x.trim()).filter(Boolean),
region: cell(r, 'region'),
retired: isRetired,
firstBy: cell(r, 'firstBy'),
firstAt: cell(r, 'firstAt'),
lastBy: cell(r, 'lastBy'),
lastAt: cell(r, 'lastAt'),
});
}
const l1ByTitle = new Map(state.l1.map((x) => [x.Title, x]));
const l2Keys = new Set(state.l2.filter((x) => x.Level1).map((x) => {
const l1 = state.l1.find((y) => y.Id === x.Level1.Id);
return (l1 ? l1.Title : '') + ' ' + x.Title;
}));
const missingL1 = [];
const missingL2 = [];
for (const t of targets) {
if (t.org1 && !l1ByTitle.has(t.org1) && !missingL1.includes(t.org1)) missingL1.push(t.org1);
for (const nm of t.org2names) {
const key = t.org1 + ' ' + nm;
if (!l2Keys.has(key)) {
l2Keys.add(key);
missingL2.push({ l1: t.org1, name: nm });
}
}
}
return { targets, skippedPerm, retired, missingL1, missingL2, dupErrors };
}
function buildImportBody(state, t) {
const body = {
Title: t.name,
Company: t.company,
Email: t.email,
ChangeType: '',
Permission: t.permission,
OrgLevel1: t.org1,
SystemDeleted: t.retired === true,
L2All: false,
};
const l1 = state.l1.find((x) => x.Title === t.org1);
if (l1) {
for (const nm of t.org2names) {
const m = state.l2.find((x) => x.Level1 && x.Level1.Id === l1.Id && x.Title === nm);
if (m) body['L2_' + m.Id] = true;
}
}
return body;
}
function openImportConfirmModal(plan) {
return new Promise((resolve) => {
const missing = [];
for (const t of plan.missingL1) missing.push(esc(LABEL_L1) + ': ' + esc(t));
for (const m of plan.missingL2) missing.push(esc(LABEL_L2) + ': ' + esc(m.name) + '(' + esc(m.l1) + ')');
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="CSVインポートの確認">
          <h4>CSVインポートの確認</h4>
          <div class="pr-kv">取込対象: <code>${plan.targets.length}件</code>
            (うち退職者 ${plan.retired}件は論理削除として取込)
            ${plan.skippedPerm ? ' / 対象外の権限 ' + plan.skippedPerm + '件はスキップ' : ''}</div>
          ${plan.dupErrors && plan.dupErrors.length ? `
          <span class="pr-note" style="color:var(--danger)">⚠ 同じ${esc(LABEL_L1)}内で重複のためスキップする行 ${plan.dupErrors.length}件:
            ${plan.dupErrors.slice(0, 5).map((d) => esc(d.name) + '(' + esc(d.org1) + '・' + esc(d.reason) + ')').join('、')}${plan.dupErrors.length > 5 ? ' ほか' : ''}</span>` : ''}
          ${missing.length ? `
          <div class="pr-field">
            <label>マスタ未登録の組織(OK でマスタへ自動登録してから取り込みます)</label>
            <div class="pr-checks" style="display:block; max-height:180px; overflow:auto;">
              ${missing.map((m) => '<div>' + m + '</div>').join('')}
            </div>
          </div>` : '<span class="pr-note">マスタ未登録の組織はありません。</span>'}
          <span class="pr-note">同じ${esc(LABEL_L1)}内で同じメールアドレス(無ければ氏名)の既存行は上書き更新されます。
            ${esc(LABEL_L1)}が異なる場合は別の行として登録されます。</span>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">${missing.length ? 'マスタ登録して取り込む' : '取り込む'}</button>
          </div>
        </div>
      </div>`);
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) done(false);
return;
}
const b = e.target.closest('[data-mact]');
if (b) done(b.dataset.mact === 'ok');
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(false); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done(true);
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('[data-mact="ok"]').focus();
});
}
function pickCsvFile() {
return new Promise((resolve) => {
const inp = document.createElement('input');
inp.type = 'file';
inp.accept = '.csv,text/csv';
inp.style.display = 'none';
let settled = false;
const settle = (v) => { if (!settled) { settled = true; resolve(v); inp.remove(); } };
inp.addEventListener('change', () => settle(inp.files && inp.files[0] ? inp.files[0] : null));
window.addEventListener('focus', () => setTimeout(() => settle(null), 500), { once: true });
document.body.appendChild(inp);
inp.click();
});
}
const XLSX_CRC_TABLE = (() => {
const t = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
let c = n;
for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
t[n] = c >>> 0;
}
return t;
})();
function xlsxCrc32(bytes) {
let c = 0xFFFFFFFF;
for (let i = 0; i < bytes.length; i++) c = XLSX_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
return (c ^ 0xFFFFFFFF) >>> 0;
}
const xlsxXmlEsc = (s) => String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function xlsxColName(i) {
let s = '';
i++;
while (i > 0) {
const m = (i - 1) % 26;
s = String.fromCharCode(65 + m) + s;
i = (i - 1 - m) / 26;
}
return s;
}
const XST_BORDER = 1;
const XST_LABEL = 2;
const XST_HEAD = 3;
const XST_CENTER = 4;
const XLSX_STYLES_XML =
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
'<fonts count="3">' +
'<font><sz val="11"/><name val="Yu Gothic"/></font>' +
'<font><b/><sz val="11"/><name val="Yu Gothic"/></font>' +
'<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Yu Gothic"/></font>' +
'</fonts>' +
'<fills count="4">' +
'<fill><patternFill patternType="none"/></fill>' +
'<fill><patternFill patternType="gray125"/></fill>' +
'<fill><patternFill patternType="solid"><fgColor rgb="FF7A8A78"/><bgColor indexed="64"/></patternFill></fill>' +
'<fill><patternFill patternType="solid"><fgColor rgb="FFEDF0EA"/><bgColor indexed="64"/></patternFill></fill>' +
'</fills>' +
'<borders count="2">' +
'<border><left/><right/><top/><bottom/><diagonal/></border>' +
'<border>' +
'<left style="thin"><color rgb="FF9AA096"/></left>' +
'<right style="thin"><color rgb="FF9AA096"/></right>' +
'<top style="thin"><color rgb="FF9AA096"/></top>' +
'<bottom style="thin"><color rgb="FF9AA096"/></bottom>' +
'<diagonal/></border>' +
'</borders>' +
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
'<cellXfs count="5">' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
'<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
'<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"' +
' applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"' +
' applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
'</cellXfs>' +
'<cellStyles count="1"><cellStyle name="標準" xfId="0" builtinId="0"/></cellStyles>' +
'</styleSheet>';
function xlsxBuild(sheets) {
const enc = new TextEncoder();
const sheetXml = (sh) => {
const rows = sh.rows;
const rowsXml = rows.map((cells, ri) => {
const cellsXml = cells.map((raw, ci) => {
const isObj = raw != null && typeof raw === 'object';
const v = isObj ? raw.v : raw;
const st = isObj && raw.s ? ' s="' + raw.s + '"' : '';
const ref = xlsxColName(ci) + (ri + 1);
if (typeof v === 'number' && isFinite(v)) {
return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
}
const s = String(v == null ? '' : v);
if (s === '') return st ? '<c r="' + ref + '"' + st + '/>' : '';
return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xlsxXmlEsc(s) + '</t></is></c>';
}).join('');
return '<row r="' + (ri + 1) + '">' + cellsXml + '</row>';
}).join('');
let views = '';
if (sh.freeze) {
const x = xlsxColIndex(sh.freeze);
const y = parseInt(sh.freeze.replace(/^[A-Z]+/, ''), 10) - 1;
views = '<sheetViews><sheetView workbookViewId="0">' +
'<pane xSplit="' + x + '" ySplit="' + y + '" topLeftCell="' + sh.freeze +
'" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>';
}
const cols = (sh.colWidths && sh.colWidths.length)
? '<cols>' + sh.colWidths.map((w, i) => w
? '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>' : '')
.join('') + '</cols>'
: '';
const vals = (sh.validations && sh.validations.length)
? '<dataValidations count="' + sh.validations.length + '">' +
sh.validations.map((dv) => '<dataValidation type="list" allowBlank="1" showInputMessage="1"' +
' showErrorMessage="1" sqref="' + dv.sqref + '"><formula1>' +
xlsxXmlEsc('"' + dv.list.join(',') + '"') + '</formula1></dataValidation>').join('') +
'</dataValidations>'
: '';
return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
views + cols + '<sheetData>' + rowsXml + '</sheetData>' + vals + '</worksheet>';
};
const files = [];
files.push(['[Content_Types].xml',
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
'<Default Extension="xml" ContentType="application/xml"/>' +
'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
'</Types>']);
files.push(['_rels/.rels',
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
'</Relationships>']);
files.push(['xl/workbook.xml',
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
sheets.map((sh, i) => '<sheet name="' + xlsxXmlEsc(sh.name) + '" sheetId="' + (i + 1) +
'" r:id="rId' + (i + 1) + '"/>').join('') +
'</sheets></workbook>']);
files.push(['xl/_rels/workbook.xml.rels',
'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) +
'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
'<Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
'</Relationships>']);
files.push(['xl/styles.xml', XLSX_STYLES_XML]);
sheets.forEach((sh, i) => files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sh)]));
const parts = [];
const central = [];
let offset = 0;
const num16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
const num32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
for (const [name, xml] of files) {
const nameB = enc.encode(name);
const data = enc.encode(xml);
const crc = xlsxCrc32(data);
const head = new Uint8Array([
0x50, 0x4B, 0x03, 0x04, ...num16(20), ...num16(0x0800), ...num16(0), ...num16(0), ...num16(0),
...num32(crc), ...num32(data.length), ...num32(data.length), ...num16(nameB.length), ...num16(0),
]);
central.push(new Uint8Array([
0x50, 0x4B, 0x01, 0x02, ...num16(20), ...num16(20), ...num16(0x0800), ...num16(0), ...num16(0), ...num16(0),
...num32(crc), ...num32(data.length), ...num32(data.length), ...num16(nameB.length), ...num16(0), ...num16(0),
...num16(0), ...num16(0), ...num32(0), ...num32(offset),
]), nameB);
parts.push(head, nameB, data);
offset += head.length + nameB.length + data.length;
}
const centralStart = offset;
let centralLen = 0;
for (const c of central) { parts.push(c); centralLen += c.length; }
parts.push(new Uint8Array([
0x50, 0x4B, 0x05, 0x06, ...num16(0), ...num16(0), ...num16(files.length), ...num16(files.length),
...num32(centralLen), ...num32(centralStart), ...num16(0),
]));
return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
async function xlsxUnzip(buf) {
const u8 = new Uint8Array(buf);
const dv = new DataView(buf);
let eocd = -1;
for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
if (u8[i] === 0x50 && u8[i + 1] === 0x4B && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
}
if (eocd < 0) throw new Error('xlsx(ZIP)形式ではありません');
const count = dv.getUint16(eocd + 10, true);
let p = dv.getUint32(eocd + 16, true);
const dec = new TextDecoder();
const out = new Map();
for (let n = 0; n < count; n++) {
if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('ZIP セントラルディレクトリが壊れています');
const method = dv.getUint16(p + 10, true);
const csize = dv.getUint32(p + 20, true);
const nameLen = dv.getUint16(p + 28, true);
const extraLen = dv.getUint16(p + 30, true);
const cmtLen = dv.getUint16(p + 32, true);
const lho = dv.getUint32(p + 42, true);
const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
const lNameLen = dv.getUint16(lho + 26, true);
const lExtraLen = dv.getUint16(lho + 28, true);
const start = lho + 30 + lNameLen + lExtraLen;
const raw = u8.subarray(start, start + csize);
let data;
if (method === 0) {
data = raw;
} else if (method === 8) {
if (typeof DecompressionStream === 'undefined') {
throw new Error('このブラウザは圧縮された xlsx の展開に対応していません(DecompressionStream 非対応)');
}
const ds = new DecompressionStream('deflate-raw');
const stream = new Blob([raw]).stream().pipeThrough(ds);
data = new Uint8Array(await new Response(stream).arrayBuffer());
} else {
throw new Error('未対応の ZIP 圧縮方式: ' + method);
}
out.set(name, data);
p += 46 + nameLen + extraLen + cmtLen;
}
return out;
}
const xlsxParseXml = (bytes) => {
const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
if (doc.querySelector('parsererror')) throw new Error('xlsx 内の XML を解析できません');
return doc;
};
function xlsxColIndex(ref) {
let c = 0;
for (const ch of ref) {
if (ch < 'A' || ch > 'Z') break;
c = c * 26 + (ch.charCodeAt(0) - 64);
}
return c - 1;
}
async function xlsxParse(buf) {
const files = await xlsxUnzip(buf);
if (!files.has('xl/workbook.xml')) throw new Error('xlsx ではありません(workbook.xml 無し)');
const wb = xlsxParseXml(files.get('xl/workbook.xml'));
const rels = files.has('xl/_rels/workbook.xml.rels')
? xlsxParseXml(files.get('xl/_rels/workbook.xml.rels')) : null;
const relMap = new Map();
if (rels) {
for (const r of rels.getElementsByTagName('*')) {
if (r.localName === 'Relationship') {
relMap.set(r.getAttribute('Id'), r.getAttribute('Target').replace(/^\//, ''));
}
}
}
const textOf = (node) => {
let s = '';
for (const ch of node.children) {
if (ch.localName === 'rPh' || ch.localName === 'phoneticPr') continue;
if (ch.localName === 't') s += ch.textContent;
else s += textOf(ch);
}
return s;
};
const shared = [];
if (files.has('xl/sharedStrings.xml')) {
const ss = xlsxParseXml(files.get('xl/sharedStrings.xml'));
for (const si of ss.getElementsByTagName('*')) {
if (si.localName === 'si' && si.parentElement && si.parentElement.localName === 'sst') {
shared.push(textOf(si));
}
}
}
const sheets = [];
let idx = 0;
for (const el of wb.getElementsByTagName('*')) {
if (el.localName !== 'sheet') continue;
idx++;
const rid = el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
let target = (rid && relMap.get(rid)) || ('worksheets/sheet' + idx + '.xml');
if (!target.startsWith('xl/')) target = 'xl/' + target;
if (!files.has(target)) continue;
const doc = xlsxParseXml(files.get(target));
const rows = [];
for (const rowEl of doc.getElementsByTagName('*')) {
if (rowEl.localName !== 'row') continue;
const ri = (parseInt(rowEl.getAttribute('r'), 10) || (rows.length + 1)) - 1;
const row = [];
let autoCol = 0;
for (const c of rowEl.children) {
if (c.localName !== 'c') continue;
const ref = c.getAttribute('r');
const ci = ref ? xlsxColIndex(ref) : autoCol;
autoCol = ci + 1;
const t = c.getAttribute('t') || '';
let v = '';
if (t === 'inlineStr') {
for (const isEl of c.children) if (isEl.localName === 'is') v += textOf(isEl);
} else {
let vEl = null;
for (const ch of c.children) if (ch.localName === 'v') vEl = ch;
const raw = vEl ? vEl.textContent : '';
if (t === 's') v = shared[parseInt(raw, 10)] || '';
else if (t === 'b') v = raw === '1' ? '1' : '0';
else v = raw;
}
row[ci] = v;
}
for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = '';
rows[ri] = row;
}
for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
sheets.push({ name: el.getAttribute('name') || ('Sheet' + idx), rows });
}
return sheets;
}
const XLSX_LBL_L1 = '組織区分1';
const XLSX_LBL_NAME = '利用者名';
const XLSX_LBL_COMP = '会社名';
const XLSX_LBL_MAIL = 'メールアドレス';
const XLSX_LBL_PERM = '権限';
const XLSX_LBL_ACTION = '更新内容';
const XLSX_LBL_L2ALL = LABEL_L2 + 'のすべて';
const XLSX_ACTIONS = ['変更なし', '追加', '削除', '更新'];
const XLSX_CHECK = '✓';
const XLSX_EXTRA_COLS = 3;
const xlsxIsCheck = (s) => /^(✓|✔|○|◯|レ|1|true|はい)$/i.test(String(s == null ? '' : s).trim());
function xlsxSheetName(title, used) {
let base = String(title).replace(/[\\/?*:[\]]/g, '_').slice(0, 31) || 'シート';
let name = base;
let n = 2;
while (used.has(name)) {
const suf = '(' + n + ')';
name = base.slice(0, 31 - suf.length) + suf;
n++;
}
used.add(name);
return name;
}
function xlsxSheetForL1(state, l1) {
const users = state.users
.filter((u) => (u.OrgLevel1 || '') === l1.Title && u.SystemDeleted !== true)
.sort((a, b) => a.Id - b.Id);
const l2list = activeL2Of(state, l1.Title);
const cols = users.length + XLSX_EXTRA_COLS;
const label = (v) => ({ v, s: XST_LABEL });
const head = (v) => ({ v, s: XST_HEAD });
const cellRow = (vals, style) => {
const row = [];
for (let i = 0; i < cols; i++) row.push({ v: vals ? (vals[i] != null ? vals[i] : '') : '', s: style });
return row;
};
const rows = [];
rows.push([label(XLSX_LBL_L1), head(l1.Title)]);
rows.push([label(XLSX_LBL_NAME)].concat(cellRow(users.map((u) => u.Title || ''), XST_HEAD)));
rows.push([label(XLSX_LBL_COMP)].concat(cellRow(users.map((u) => u.Company || ''), XST_BORDER)));
rows.push([label(XLSX_LBL_MAIL)].concat(cellRow(users.map((u) => u.Email || ''), XST_BORDER)));
rows.push([label(XLSX_LBL_PERM)].concat(cellRow(users.map((u) => u.Permission || ''), XST_CENTER)));
rows.push([label(XLSX_LBL_ACTION)].concat(cellRow(users.map(() => '変更なし'), XST_CENTER)));
for (const m of l2list) {
rows.push([label(m.Title)].concat(cellRow(
users.map((u) => (u.L2All === true || u['L2_' + m.Id] === true) ? XLSX_CHECK : ''), XST_CENTER)));
}
const last = xlsxColName(cols);
return {
rows,
users,
colWidths: [24].concat(Array.from({ length: cols }, () => 16)),
freeze: 'B3',
validations: [
{ sqref: 'B5:' + last + '5', list: state.choices.permission },
{ sqref: 'B6:' + last + '6', list: XLSX_ACTIONS },
{ sqref: 'B7:' + last + (6 + l2list.length), list: [XLSX_CHECK] },
],
};
}
function buildExportXlsx(state, l1Titles) {
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
'-' + pad(now.getHours()) + pad(now.getMinutes());
const used = new Set();
const sheets = [];
let count = 0;
for (const t of l1Titles) {
const l1 = state.l1.find((x) => x.Title === t);
if (!l1) continue;
const sh = xlsxSheetForL1(state, l1);
count += sh.users.length;
sheets.push({
name: xlsxSheetName(t, used),
rows: sh.rows,
colWidths: sh.colWidths,
freeze: sh.freeze,
validations: sh.validations,
});
}
return { blob: xlsxBuild(sheets), filename: LIST_USERS + '_' + stamp + '.xlsx', count };
}
function xlsxDownload(blob, filename) {
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = filename;
document.body.appendChild(a);
a.click();
setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function openExportModal(state) {
return new Promise((resolve) => {
const counts = new Map();
for (const u of state.users) {
if (u.SystemDeleted === true) continue;
const k = u.OrgLevel1 || '';
counts.set(k, (counts.get(k) || 0) + 1);
}
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="Excelエクスポート">
          <h4>Excelエクスポート</h4>
          <span class="pr-note">出力する${esc(LABEL_L1)}を選択してください(複数可。1つにつき1シート)。
            ファイルを編集して「Excel取込」すると、各列の「更新内容」に応じて
            追加・更新・削除(論理削除)を反映できます。システム削除済みの行は出力されません。</span>
          <div class="pr-field">
            <label class="pr-check" style="display:inline-flex">
              <input type="checkbox" data-xall checked>すべて選択</label>
            <div class="pr-checks pr-checks--perm">
              ${state.l1.map((x) => `
                <label class="pr-check"><input type="checkbox" data-xl1 value="${esc(x.Title)}" checked>
                  ${esc(x.Title)}<span class="pr-childcount">${counts.get(x.Title) || 0}</span></label>`).join('') ||
'<span class="pr-note">マスタ未登録</span>'}
            </div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">エクスポート</button>
          </div>
        </div>
      </div>`);
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
const ok = () => {
const titles = [...back.querySelectorAll('input[data-xl1]:checked')].map((x) => x.value);
if (!titles.length) {
toast('warn', LABEL_L1 + 'を1件以上選択してください');
return;
}
done(titles);
};
back.querySelector('[data-xall]').addEventListener('change', (e) => {
back.querySelectorAll('input[data-xl1]').forEach((c) => { c.checked = e.target.checked; });
});
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
back.querySelector('[data-mact="ok"]').focus();
});
}
function pickXlsxFile() {
return new Promise((resolve) => {
const inp = document.createElement('input');
inp.type = 'file';
inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
inp.style.display = 'none';
let settled = false;
const settle = (v) => { if (!settled) { settled = true; resolve(v); inp.remove(); } };
inp.addEventListener('change', () => settle(inp.files && inp.files[0] ? inp.files[0] : null));
window.addEventListener('focus', () => setTimeout(() => settle(null), 500), { once: true });
document.body.appendChild(inp);
inp.click();
});
}
function buildXlsxImportPlan(state, sheets) {
const entries = [];
const warnings = [];
const missingL1 = [];
const missingL2 = [];
const l1Titles = new Set(state.l1.map((x) => x.Title));
const l2Keys = new Set(state.l2.filter((x) => x.Level1).map((x) => {
const l1 = state.l1.find((y) => y.Id === x.Level1.Id);
return (l1 ? l1.Title : '') + ' ' + x.Title;
}));
let found = 0;
for (const sh of sheets) {
const rows = sh.rows;
const cellAt = (r, c) => String((rows[r] && rows[r][c] != null) ? rows[r][c] : '').trim();
if (cellAt(0, 0) !== XLSX_LBL_L1) continue;
const l1Title = cellAt(0, 1);
if (!l1Title) continue;
found++;
const findRow = (lbl) => rows.findIndex((r) => String((r || [])[0] || '').trim() === lbl);
const rName = findRow(XLSX_LBL_NAME);
const rComp = findRow(XLSX_LBL_COMP);
const rMail = findRow(XLSX_LBL_MAIL);
const rPerm = findRow(XLSX_LBL_PERM);
const rAct = findRow(XLSX_LBL_ACTION);
const rAll = findRow(XLSX_LBL_L2ALL);
if (rName < 0 || rPerm < 0 || rAct < 0) {
throw new Error('シート「' + sh.name + '」の形式が想定と異なります(利用者名/権限/更新内容の行が必要)');
}
const l2rows = [];
for (let r = (rAll >= 0 ? rAll : rAct) + 1; r < rows.length; r++) {
const nm = String((rows[r] || [])[0] || '').trim();
if (nm) l2rows.push({ r, name: nm });
}
if (l1Title && !l1Titles.has(l1Title) && !missingL1.includes(l1Title)) missingL1.push(l1Title);
for (const x of l2rows) {
const key = l1Title + ' ' + x.name;
if (!l2Keys.has(key)) {
l2Keys.add(key);
missingL2.push({ l1: l1Title, name: x.name });
}
}
const width = Math.max(0, ...rows.map((r) => (r || []).length));
for (let c = 1; c < width; c++) {
const name = cellAt(rName, c);
const e = {
l1: l1Title,
name,
company: rComp >= 0 ? cellAt(rComp, c) : '',
email: rMail >= 0 ? cellAt(rMail, c) : '',
permission: cellAt(rPerm, c),
action: cellAt(rAct, c),
l2all: rAll >= 0 && xlsxIsCheck(cellAt(rAll, c)),
org2names: l2rows.filter((x) => xlsxIsCheck(cellAt(x.r, c))).map((x) => x.name),
};
const hasContent = !!(name || e.company || e.email || e.permission || e.action ||
e.l2all || e.org2names.length);
if (!hasContent) continue;
const reasons = [];
if (!name) reasons.push('利用者名が空');
if (!e.action) reasons.push('更新内容が未選択');
else if (!XLSX_ACTIONS.includes(e.action)) reasons.push('更新内容の値が不正: ' + e.action);
if (e.action === '追加' || e.action === '更新') {
if (!e.email) reasons.push('メールアドレスが空');
if (!e.permission) reasons.push('権限が空');
else if (!state.choices.permission.includes(e.permission)) {
reasons.push('権限の値が選択肢にありません: ' + e.permission);
}
if (!e.l2all && !e.org2names.length) reasons.push(LABEL_L2 + 'のチェックがありません');
}
if (reasons.length) {
warnings.push({
name: name || '(利用者名なし)',
where: sh.name + 'シート ' + xlsxColName(c) + '列',
reasons,
});
continue;
}
entries.push(e);
}
}
if (!found) throw new Error('このツールのエクスポート形式のシート(A1が「' + XLSX_LBL_L1 + '」)が見つかりません');
if (!entries.length && !warnings.length) throw new Error('取込対象の利用者がいません(利用者名の行が空)');
const idx = buildUserIndex(state.users);
const adds = [];
const updates = [];
const deletes = [];
const notFound = [];
let skipped = 0;
const seenEmail = new Set();
const seenName = new Set();
for (const e of entries) {
if (e.action === '追加' || e.action === '更新' || e.action === '削除') {
const ek = uEmailKey(e.l1, e.email);
const nk = uNameKey(e.l1, e.name);
if ((ek && seenEmail.has(ek)) || seenName.has(nk)) {
warnings.push({ name: e.name, where: e.l1,
reasons: ['同じ' + LABEL_L1 + '内で' + (ek && seenEmail.has(ek) ? '同じメールアドレス' : '同じ利用者名') +
'の列がファイル内に複数あります'] });
continue;
}
if (ek) seenEmail.add(ek);
seenName.add(nk);
}
if (e.action === '追加') {
const dup = findExistingUser(idx, e.l1, e.email, e.name);
if (dup) {
warnings.push({ name: e.name, where: e.l1,
reasons: ['同じ' + LABEL_L1 + 'に既存の利用者(' + dup.Title + ')と重複します。更新する場合は「更新」を選んでください'] });
continue;
}
adds.push(e);
} else if (e.action === '更新' || e.action === '削除') {
const u = findExistingUser(idx, e.l1, e.email, e.name);
if (!u) notFound.push(e);
else if (e.action === '削除') {
if (u.SystemDeleted === true) skipped++;
else deletes.push({ e, u });
} else updates.push({ e, u });
} else {
skipped++;
}
}
return { entries, adds, updates, deletes, notFound, warnings, missingL1, missingL2, skipped };
}
function buildXlsxBody(state, e, existing) {
const body = {
Title: e.name,
Company: e.company,
Email: e.email,
Permission: e.permission,
OrgLevel1: e.l1,
L2All: e.l2all,
};
if (!existing) {
body.ChangeType = state.choices.changeType.includes('新規') ? '新規' : state.choices.changeType[0];
body.SystemDeleted = false;
}
const l1 = state.l1.find((x) => x.Title === e.l1);
if (l1) {
for (const nm of e.org2names) {
const m = state.l2.find((x) => x.Level1 && x.Level1.Id === l1.Id && x.Title === nm);
if (m) body['L2_' + m.Id] = true;
}
}
if (existing) {
for (const k of Object.keys(existing)) {
if (k.startsWith('L2_') && existing[k] === true && !(k in body)) body[k] = false;
}
}
return body;
}
function xlsxDiffLines(state, e, u) {
const lines = [];
const f = (label, before, after) => {
if ((before || '') !== (after || '')) {
lines.push(label + ': ' + (before || '(空)') + ' → ' + (after || '(空)'));
}
};
f('利用者名', u.Title, e.name);
f('会社名', u.Company, e.company);
f('メールアドレス', u.Email, e.email);
f('権限', u.Permission, e.permission);
f(LABEL_L1, u.OrgLevel1, e.l1);
const beforeSet = new Set(activeL2Of(state, u.OrgLevel1 || '')
.filter((m) => u.L2All === true || u['L2_' + m.Id] === true).map((m) => m.Title));
const afterSet = new Set(e.org2names);
if ((u.OrgLevel1 || '') !== e.l1) {
lines.push(LABEL_L2 + ': ' + ([...afterSet].join('、') || '(なし)'));
} else {
const plus = [...afterSet].filter((x) => !beforeSet.has(x)).map((x) => '+' + x);
const minus = [...beforeSet].filter((x) => !afterSet.has(x)).map((x) => '−' + x);
if (plus.length || minus.length) lines.push(LABEL_L2 + ': ' + plus.concat(minus).join('、'));
}
return lines;
}
function openXlsxConfirmModal(state, plan, changed) {
return new Promise((resolve) => {
const missing = plan.missingL1.map((t) => esc(LABEL_L1) + ': ' + esc(t))
.concat(plan.missingL2.map((m) => esc(LABEL_L2) + ': ' + esc(m.name) + '(' + esc(m.l1) + ')'));
const addHtml = plan.adds.map((e) => `
      <div class="pr-diff-item"><b>${esc(e.name)}</b><span class="pr-diff-tag pr-diff-tag--add">追加</span><br>
        ${esc([e.company, e.email, e.permission, e.l1].filter(Boolean).join(' / '))}
        ${e.org2names.length ? '<br>' + esc(LABEL_L2 + ': ' + e.org2names.join('、')) : ''}</div>`).join('');
const updHtml = changed.map(({ e, u }) => `
      <div class="pr-diff-item"><b>${esc(u.Title)}</b><span class="pr-diff-tag">更新</span><br>
        ${xlsxDiffLines(state, e, u).map(esc).join('<br>')}</div>`).join('');
const delHtml = plan.deletes.map(({ u }) => `
      <div class="pr-diff-item"><b>${esc(u.Title)}</b><span class="pr-diff-tag pr-diff-tag--del">論理削除</span>
        ${esc(u.OrgLevel1 || '')}</div>`).join('');
const warnHtml = plan.warnings.map((w) => `
      <div class="pr-diff-item"><b>${esc(w.name)}</b><span class="pr-diff-tag pr-diff-tag--warn">スキップ</span>
        <small>${esc(w.where)}</small><br>${esc(w.reasons.join(' / '))}</div>`).join('');
const actionCount = plan.adds.length + changed.length + plan.deletes.length;
const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="Excelインポートの確認">
          <h4>Excelインポートの確認</h4>
          <div class="pr-kv">追加 <code>${plan.adds.length}件</code> / 更新 <code>${changed.length}件</code>
            (差分なし ${plan.updates.length - changed.length}件はスキップ) /
            論理削除 <code>${plan.deletes.length}件</code>
            ${plan.skipped ? ' / 変更なし ' + plan.skipped + '件' : ''}</div>
          <span class="pr-note">最新のリストを読み直した上での差分です。内容を確認してから取り込んでください。</span>
          ${(addHtml || updHtml || delHtml) ? `
          <div class="pr-field">
            <label>取り込まれる変更(変更前 → 変更後)</label>
            <div class="pr-checks pr-diff-list">${addHtml}${updHtml}${delHtml}</div>
          </div>` : ''}
          ${plan.warnings.length ? `
          <div class="pr-field">
            <label style="color:var(--warn)">⚠ 入力不備のため取り込まずスキップする列(${plan.warnings.length}件)。
              取り込む場合はキャンセルしてExcelを修正してください</label>
            <div class="pr-checks pr-diff-list">${warnHtml}</div>
          </div>` : ''}
          ${plan.notFound.length ? `<span class="pr-note" style="color:var(--danger)">
            ⚠ 更新/削除の対象が見つからない列 ${plan.notFound.length}件(スキップされます):
            ${plan.notFound.slice(0, 5).map((x) => esc(x.name)).join('、')}${plan.notFound.length > 5 ? ' ほか' : ''}</span>` : ''}
          ${missing.length ? `
          <div class="pr-field">
            <label>マスタ未登録の組織(OK でマスタへ自動登録してから取り込みます)</label>
            <div class="pr-checks" style="display:block; max-height:140px; overflow:auto;">
              ${missing.map((m) => '<div>' + m + '</div>').join('')}
            </div>
          </div>` : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok" ${actionCount ? '' : 'disabled'}>${
plan.warnings.length ? '不備の列をスキップして取り込む' : '取り込む'}</button>
          </div>
        </div>
      </div>`);
const done = (val) => {
document.removeEventListener('keydown', onKey, true);
back.remove();
resolve(val);
};
let downOnBack = false;
back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
back.addEventListener('click', (e) => {
if (e.target === back) {
if (downOnBack) done(false);
return;
}
const b = e.target.closest('[data-mact]');
if (b) done(b.dataset.mact === 'ok');
});
const onKey = (e) => {
if (e.isComposing || e.keyCode === 229) return;
if (e.key === 'Escape') { e.stopPropagation(); done(false); }
else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done(true);
};
document.addEventListener('keydown', onKey, true);
document.getElementById(ROOT_ID).appendChild(back);
back.querySelector('[data-mact="ok"]').focus();
});
}
const CHECK_INTERVAL = 30000;
function applyUpdate(src, ver) {
window.__webregSource = Object.assign({}, src, { ver });
if (src.dev) {
fetch(src.base + '/webreg.bundle.js?v=' + encodeURIComponent(ver))
.then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
.then((t) => { (0, eval)(t); })
.catch((e) => toast('err', '自動更新に失敗しました — ' + (e && e.message || e)));
} else {
const o = document.getElementById('webreg-script');
if (o) o.remove();
const s = document.createElement('script');
s.id = 'webreg-script';
s.src = src.base + '/webreg.bundle.js?v=' + encodeURIComponent(ver);
s.onerror = () => toast('err', '自動更新に失敗しました (script load error)');
document.body.appendChild(s);
}
}
function startUpdateWatcher(build) {
if (window.__webregWatcher) clearInterval(window.__webregWatcher);
if (window.__webregOnVisible) document.removeEventListener('visibilitychange', window.__webregOnVisible);
const src = window.__webregSource;
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
window.__webregWatcher = setInterval(() => { if (!document.hidden) check(); }, CHECK_INTERVAL);
window.__webregOnVisible = () => { if (!document.hidden) check(); };
document.addEventListener('visibilitychange', window.__webregOnVisible);
window.__webregCheckNow = check;
}
(() => {
'use strict';
const prev = document.getElementById(ROOT_ID);
if (prev) prev.remove();
const state = {
view: 'users',
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
async function loadL2() {
const sel = (en) => lt(LIST_L2) + '/items?$select=Id,Title,' + (en ? 'TitleEn,' : '') +
'SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999';
try { return await spGet(sel(true)); } catch { return await spGet(sel(false)); }
}
async function loadAll() {
const [r1, r2, ru] = await Promise.all([
spGet(lt(LIST_L1) + '/items?$select=*&$orderby=SortOrder,Id&$top=4999'),
loadL2(),
state.usersReady
? spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999')
: Promise.resolve({ value: [] }),
]);
state.l1 = r1.value || [];
state.l2 = r2.value || [];
state.users = ru.value || [];
if (state.usersReady) {
try {
const fr = await spGet(lt(LIST_USERS) +
"/fields?$select=TypeAsString&$filter=InternalName eq 'OrgLevel2'");
const t = ((fr.value || [])[0] || {}).TypeAsString;
state.org2Mode = (t === 'Text' || t === 'Note') ? 'text' : 'calc';
} catch {
state.org2Mode = 'calc';
}
try {
const [ct, pm] = await Promise.all([
spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('ChangeType')?$select=Choices"),
spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Permission')?$select=Choices"),
]);
let pmChoices = (pm.Choices && pm.Choices.length) ? pm.Choices : PERMISSION_DEFAULTS;
if (!state.users.some((u) => u.Permission === '参照者')) {
pmChoices = pmChoices.filter((x) => x !== '参照者');
if (!pmChoices.length) pmChoices = PERMISSION_DEFAULTS;
}
state.choices = {
changeType: (ct.Choices && ct.Choices.length) ? ct.Choices : CHANGE_TYPE_DEFAULTS,
permission: pmChoices,
};
} catch { }
}
if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;
state.syncDiff = null;
state.syncFp = null;
try { state.listAssign = await loadListAssign(); } catch { state.listAssign = {}; }
if (state.usersReady) {
let ss = await loadSyncState();
if (!ss.fp || typeof ss.fp.master !== 'object') {
try {
await saveSyncFp('master', computeMasterSnap(state));
await saveSyncFp('perms', computePermsSnap(state, ss.adminIds));
ss = await loadSyncState();
} catch { }
}
state.adminGroupIds = ss.adminIds;
state.syncFp = ss.fp;
state.syncDiff = diffSyncState(state, ss.adminIds, ss.fp);
}
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
progressFeed(msg);
if (isDebug()) console.log('[WebReg] status:', msg);
}
const AUDIT_SKIP = new Set(['読込', '再読込']);
let _auditNote = '';
const auditNote = (text) => { _auditNote = text; };
async function run(label, fn) {
if (state.busy) return;
state.busy = true;
app.style.opacity = '0.55';
app.style.pointerEvents = 'none';
progressArm(label);
setStatus(label + '…');
_auditNote = '';
try {
if (isDebug()) console.log('[WebReg] ' + label + ' 開始');
await fn();
setStatus(label + ' 完了');
if (!AUDIT_SKIP.has(label)) auditLog(label, _auditNote);
} catch (e) {
console.error('[WebReg] ' + label + ' 失敗:', e);
setStatus('エラー: ' + e.message);
toast('err', label + 'に失敗しました — ' + e.message);
} finally {
progressDone();
state.busy = false;
app.style.opacity = '';
app.style.pointerEvents = '';
}
}
function withOrg2Text(body, baseItem) {
if (state.org2Mode !== 'text') return body;
body.OrgLevel2 = userOrg2Text(state, Object.assign({}, baseItem || {}, body));
return body;
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
const j = await addItem(LIST_USERS, withOrg2Text(body));
if (j && j.Id) await applyPermAfterWrite(state, j.Id, body.OrgLevel1);
return body.Title;
});
if (!result) return;
run('登録', async () => {
auditNote('利用者「' + result + '」を登録');
await reload();
toast('ok', '「' + result + '」を登録しました');
});
}
async function userEditFlow(item) {
const result = await openUserForm(state, async (body) => {
await ensureCheckedL2Cols(body);
await updateItem(LIST_USERS, item.Id, withOrg2Text(body, item));
await applyPermAfterWrite(state, item.Id, body.OrgLevel1);
return body.Title;
}, item);
if (!result) return;
run('保存', async () => {
auditNote('利用者「' + result + '」を編集');
await reload();
toast('ok', '「' + result + '」を保存しました');
});
}
async function userImportFlow(testText) {
let text = testText;
if (text == null) {
const file = await pickCsvFile();
if (!file) return;
try {
text = decodeCsvBuffer(await file.arrayBuffer());
} catch (e) {
toast('err', 'ファイルの読み込みに失敗しました — ' + e.message);
return;
}
}
let plan;
try {
plan = buildImportPlan(state, parseCsvText(text));
} catch (e) {
toast('err', 'CSVの解析に失敗しました — ' + e.message);
return;
}
if (!plan.targets.length) {
toast('warn', '取り込み対象の行がありません(権限が対象外、空データ、または' + LABEL_L1 + '内の重複)');
return;
}
const ok = await openImportConfirmModal(plan);
if (!ok) return;
run('インポート', async () => {
if (!state.ready) {
setStatus('マスタリストを作成中…');
await setup(setStatus);
state.ready = true;
}
if (plan.missingL1.length || plan.missingL2.length) {
setStatus('未登録マスタを登録中…');
let order1 = nextOrder(state.l1);
for (const t of plan.missingL1) {
try {
await addItem(LIST_L1, { Title: t, SortOrder: order1, Active: true });
} catch (e) {
throw new Error(LABEL_L1 + 'マスタ「' + t + '」の登録: ' + e.message);
}
order1 += 10;
}
if (plan.missingL1.length) await loadAll();
for (const m of plan.missingL2) {
const l1 = state.l1.find((x) => x.Title === m.l1);
if (!l1) continue;
const siblings = state.l2.filter((x) => x.Level1 && x.Level1.Id === l1.Id);
try {
await addItem(LIST_L2, { Title: m.name, SortOrder: nextOrder(siblings), Active: true, Level1Id: l1.Id });
} catch (e) {
throw new Error(LABEL_L2 + 'マスタ「' + m.name + '」の登録: ' + e.message);
}
await loadAll();
}
}
setStatus('マスタをリストへ反映中…');
const sres = await syncMastersToUserList(state, setStatus);
if (sres.org2Migrated) toast('warn', sres.org2Migrated);
if (sres.org2Mode) state.org2Mode = sres.org2Mode;
if (sres.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました(取込は継続) — ' + sres.formulaWarn);
if (sres.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました(取込は継続) — ' + sres.condWarn);
if (sres.orderWarn) toast('warn', '列の並び替えに失敗しました(取込は継続) — ' + sres.orderWarn);
const needPerms = [...new Set(plan.targets.map((t) => t.permission))]
.filter((pm) => !state.choices.permission.includes(pm));
if (needPerms.length) {
const merged = state.choices.permission.concat(needPerms);
await setChoices(LIST_USERS, 'Permission', '権限', merged, true);
state.choices = { changeType: state.choices.changeType, permission: merged };
}
const idx = buildUserIndex(state.users);
let added = 0;
let updated = 0;
const rowErrors = [];
const touched = [];
let done = 0;
for (const t of plan.targets) {
done++;
setStatus('利用者を取込中… (' + done + '/' + plan.targets.length + ')');
try {
const body = buildImportBody(state, t);
const exist = findExistingUser(idx, t.org1, t.email, t.name);
if (exist) {
for (const k of Object.keys(exist)) {
if (k.startsWith('L2_') && exist[k] === true && !(k in body)) body[k] = false;
}
await updateItem(LIST_USERS, exist.Id, withOrg2Text(body, exist));
touched.push({ id: exist.Id, l1: t.org1 });
updated++;
} else {
const j = await addItem(LIST_USERS, withOrg2Text(body));
if (j && j.Id) touched.push({ id: j.Id, l1: t.org1 });
added++;
}
} catch (e) {
rowErrors.push({ name: t.name, msg: e.message });
}
}
await reload();
if (hasAnyPermConfig(state) && touched.length) {
const ps = await applyPermissionsToItems(state, touched, setStatus);
if (ps.errors.length) {
toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
}
}
auditNote('CSVインポート: 追加 ' + added + '件 / 更新 ' + updated + '件');
toast('ok', 'インポート完了: 追加 ' + added + '件 / 更新 ' + updated + '件' +
(plan.skippedPerm ? '(対象外の権限 ' + plan.skippedPerm + '件はスキップ)' : '') +
(plan.dupErrors && plan.dupErrors.length ? '(' + LABEL_L1 + '内の重複 ' + plan.dupErrors.length + '件はスキップ)' : ''));
if (rowErrors.length) {
toast('err', '取込に失敗した行 ' + rowErrors.length + '件: ' +
rowErrors.slice(0, 5).map((x) => x.name).join('、') + (rowErrors.length > 5 ? ' ほか' : '') +
' — 最初のエラー: ' + rowErrors[0].msg);
}
});
}
async function userExportFlow() {
if (!state.users.length) {
toast('warn', 'エクスポートできる利用者がいません');
return;
}
const titles = await openExportModal(state);
if (!titles) return;
const { blob, filename, count } = buildExportXlsx(state, titles);
xlsxDownload(blob, filename);
toast('ok', filename + ' を出力しました(' + titles.length + 'シート / ' + count + '件)');
}
async function userImportXlsxFlow(testBuf) {
let buf = testBuf;
if (!buf) {
const file = await pickXlsxFile();
if (!file) return;
buf = await file.arrayBuffer();
}
let plan;
try {
setStatus('最新のリストを読み込み中…');
await loadAll();
plan = buildXlsxImportPlan(state, await xlsxParse(buf));
} catch (e) {
toast('err', 'Excelファイルの解析に失敗しました — ' + e.message);
return;
} finally {
setStatus(state.ready ? '準備OK / ' + BUILD : 'マスタリスト未作成');
}
const changed = plan.updates.filter(({ e, u }) => xlsxDiffLines(state, e, u).length > 0);
if (!plan.adds.length && !changed.length && !plan.deletes.length && !plan.warnings.length) {
toast(plan.notFound.length ? 'warn' : 'ok',
'取り込む変更はありません(更新内容が「追加/更新/削除」の列が無いか、最新のリストとの差分がありません)' +
(plan.notFound.length ? ' / 突合できない列 ' + plan.notFound.length + '件' : ''));
return;
}
const ok = await openXlsxConfirmModal(state, plan, changed);
if (!ok) return;
run('Excelインポート', async () => {
if (plan.missingL1.length || plan.missingL2.length) {
setStatus('未登録マスタを登録中…');
let order1 = nextOrder(state.l1);
for (const t of plan.missingL1) {
await addItem(LIST_L1, { Title: t, SortOrder: order1, Active: true });
order1 += 10;
}
if (plan.missingL1.length) await loadAll();
for (const m of plan.missingL2) {
const l1 = state.l1.find((x) => x.Title === m.l1);
if (!l1) continue;
const siblings = state.l2.filter((x) => x.Level1 && x.Level1.Id === l1.Id);
await addItem(LIST_L2, { Title: m.name, SortOrder: nextOrder(siblings), Active: true, Level1Id: l1.Id });
await loadAll();
}
setStatus('マスタをリストへ反映中…');
const sres = await syncMastersToUserList(state, setStatus);
if (sres.org2Mode) state.org2Mode = sres.org2Mode;
}
const total = plan.adds.length + changed.length + plan.deletes.length;
let done = 0;
const rowErrors = [];
const touched = [];
const step = () => setStatus('Excelを取込中… (' + (++done) + '/' + total + ')');
for (const e of plan.adds) {
step();
try {
const j = await addItem(LIST_USERS, withOrg2Text(buildXlsxBody(state, e)));
if (j && j.Id) touched.push({ id: j.Id, l1: e.l1 });
} catch (err) { rowErrors.push({ name: e.name, msg: err.message }); }
}
for (const { e, u } of changed) {
step();
try {
await updateItem(LIST_USERS, u.Id, withOrg2Text(buildXlsxBody(state, e, u), u));
touched.push({ id: u.Id, l1: e.l1 });
} catch (err) { rowErrors.push({ name: e.name, msg: err.message }); }
}
for (const { u } of plan.deletes) {
step();
try {
await updateItem(LIST_USERS, u.Id, { SystemDeleted: true });
} catch (err) { rowErrors.push({ name: u.Title, msg: err.message }); }
}
await reload();
if (hasAnyPermConfig(state) && touched.length) {
const ps = await applyPermissionsToItems(state, touched, setStatus);
if (ps.errors.length) {
toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
}
}
auditNote('Excelインポート: 追加 ' + plan.adds.length + '件 / 更新 ' + changed.length +
'件 / 論理削除 ' + plan.deletes.length + '件');
toast('ok', 'Excelインポート完了: 追加 ' + plan.adds.length + '件 / 更新 ' + changed.length +
'件 / 論理削除 ' + plan.deletes.length + '件');
if (plan.notFound.length) {
toast('warn', '更新/削除の対象が見つからずスキップした列 ' + plan.notFound.length + '件: ' +
plan.notFound.slice(0, 5).map((x) => x.name).join('、') + (plan.notFound.length > 5 ? ' ほか' : ''));
}
if (rowErrors.length) {
toast('err', '取込に失敗した行 ' + rowErrors.length + '件: ' +
rowErrors.slice(0, 5).map((x) => x.name).join('、') + (rowErrors.length > 5 ? ' ほか' : '') +
' — 最初のエラー: ' + rowErrors[0].msg);
}
});
}
async function compareImportFlow(testText) {
let text = testText;
if (text == null) {
const file = await pickCsvFile();
if (!file) return;
try {
text = decodeCsvBuffer(await file.arrayBuffer());
} catch (e) {
toast('err', 'ファイルの読み込みに失敗しました — ' + e.message);
return;
}
}
let plan;
try {
plan = buildImportPlan(state, parseCsvText(text));
} catch (e) {
toast('err', 'CSVの解析に失敗しました — ' + e.message);
return;
}
const rows = buildCompareResult(state, plan.targets);
state.compareResult = { rows, scanned: plan.targets.length };
state.view = 'compare';
render();
toast(rows.length ? 'warn' : 'ok',
rows.length ? '差分 ' + rows.length + '件が見つかりました' : '差分はありませんでした');
}
function backupFlow() {
run('バックアップ', async () => {
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
'-' + pad(now.getHours()) + pad(now.getMinutes());
const data = await buildBackup(state, now.toISOString());
const counts = Object.entries(data.lists)
.map(([k, v]) => v ? k + ':' + v.items.length : null).filter(Boolean).join(' / ');
backupDownload(data, 'WebReg_backup_' + (listPrefix() || '') + stamp + '.json');
auditNote('バックアップを取得(' + counts + ')');
toast('ok', 'バックアップを保存しました(' + counts + ')');
});
}
async function restoreFlow() {
const file = await pickJsonFile();
if (!file) return;
let backup;
try {
backup = JSON.parse(await file.text());
} catch (e) {
toast('err', 'JSONの読み込みに失敗しました — ' + e.message);
return;
}
const lc = backup.lists || {};
const ok = await modal({
title: 'リストアの確認',
message: 'バックアップから復元します: ' + LABEL_L1 + ' ' + ((lc.l1 && lc.l1.items.length) || 0) +
'件 / ' + LABEL_L2 + ' ' + ((lc.l2 && lc.l2.items.length) || 0) + '件 / 利用者 ' +
((lc.users && lc.users.items.length) || 0) + '件。既存の同名マスタ・利用者は重複追加しません' +
'(空のリストに復元するのが確実です)。集計列・条件式・書式は再構築されます。',
okLabel: '復元する',
});
if (!ok) return;
run('リストア', async () => {
auditNote('バックアップから復元(' + (backup.exportedAt || '') + ')');
const r = await restoreBackup(state, backup, setStatus, syncMastersToUserList);
await reload();
toast('ok', 'リストアが完了しました(利用者 ' + r.users + '件)');
});
}
async function resetFlow() {
const choice = await openResetModal();
if (!choice) return;
const label = choice.includeMasters ? 'マスタを含めて全削除' : '利用者データのみ削除(マスタは残す)';
run('リセット', async () => {
auditNote('リストのリセット: ' + label);
const s = await resetAllItems(setStatus, choice);
await reload();
const total = Object.values(s).reduce((a, b) => a + b, 0);
toast('ok', 'リセットしました(' + label + ' / 削除 ' + total + '件)');
});
}
async function userBulkFlow() {
const ids = [...selectedUserIds];
if (!ids.length) return;
const changes = await openBulkModal(state, ids.length);
if (!changes) return;
run('一括変更', async () => {
auditNote(ids.length + '件を一括変更: ' +
Object.entries(changes).map(([k, v]) => k + '=' + (v === true ? 'ON' : v === false ? 'OFF' : v)).join(', '));
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
auditNote('利用者 ' + ids.length + '件を物理削除');
for (const id of ids) await deleteItem(LIST_USERS, id);
selectedUserIds.clear();
await reload();
toast('ok', ids.length + '件を削除しました');
});
}
function masterView() {
const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
const sel = state.l1.find((x) => x.Id === state.selectedL1);
const permBtn = (x) => {
const n = permGroupIdsOf(x).length;
return `<button class="pr-btn pr-btn--icon pr-btn--icon-action${n ? ' pr-perm-on' : ''}" data-act="perm"
        aria-label="権限グループ" title="権限グループの割当${n ? '(' + n + '件)' : '(未設定)'}">${ico('key')}</button>`;
};
const diff = state.syncDiff;
const staleHtml = (kind, x) => {
const labels = diff ? (kind === 'l1' ? diff.l1Badges : diff.l2Badges).get(x.Id) || [] : [];
return labels.map((b) => `<span class="pr-stale${b === '権限未反映' ? ' pr-stale--perm' : ''}">${esc(b)}</span>`).join('');
};
const rowHtml = (x, kind, extra) => `
      <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="上へ" title="上へ">${ico('chevron-up')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="下へ" title="下へ">${ico('chevron-down')}</button>
        <span class="pr-name" ${kind === 'l1' ? 'data-act="select"' : ''} title="${esc(x.Title)}">${esc(x.Title)}${
x.TitleEn ? '<span class="pr-name-en">' + esc(x.TitleEn) + '</span>' : ''}${
kind === 'l1' ? `<span class="pr-childcount">${l2of(x.Id).length}</span>` : ''}${staleHtml(kind, x)}</span>
        <label class="pr-active" title="有効/無効">
          <input type="checkbox" data-act="active" aria-label="有効" ${x.Active !== false ? 'checked' : ''}>
        </label>
        ${kind === 'l1' ? permBtn(x) : ''}
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
const pend = state.usersReady && diff && diff.pending;
return `
      ${pend ? `
      <div class="pr-pending"><span>⚠ 未反映の変更: ${esc(diff.summary.join(' / ') || '(内訳不明)')}${
diff.removed.length ? ' — 削除: ' + esc(diff.removed.slice(0, 3).join('、')) + (diff.removed.length > 3 ? ' ほか' : '') : ''}
        — 「リストへ反映」で適用できます</span>
        ${diff.canDiscard ? `<button class="pr-btn pr-btn--sm pr-btn--danger" data-act="discard-pending">変更を破棄して戻す</button>` : ''}
      </div>` : ''}
      <div class="pr-syncbar">
        <span>マスタの内容を「${esc(LIST_USERS)}」リストの列・選択肢・✅集計表示に反映します(無効はスキップ。列の削除はしません)。
          権限グループ割当があれば各行のアクセス権も適用します</span>
        <button class="pr-btn pr-btn--primary" data-act="sync-users">${ico('sync')}リストへ反映</button>
      </div>
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L1)}</b>${diff && diff.l1Reorder ? '<span class="pr-stale">並び替え</span>' : ''}<span class="pr-count">${state.l1.length}件</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="${esc(LABEL_L1)}の名称(日本語)">
            <input type="text" class="pr-input" id="pr-add-l1-en" placeholder="英語名(任意)">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l1" title="複数行でまとめて追加(日本語[タブ/カンマ]英語)">まとめて</button>
          </div>
          <div class="pr-rows">${state.l1.map((x) =>
rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
'<div class="pr-empty">未登録</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L2)}${sel ? ' — ' + esc(sel.Title) : ''}</b>${
diff && diff.l2Reorder ? '<span class="pr-stale">並び替え</span>' : ''}
            <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
          ${sel ? `
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称(日本語)">
            <input type="text" class="pr-input" id="pr-add-l2-en" placeholder="英語名(任意)">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l2" title="複数行でまとめて追加(日本語[タブ/カンマ]英語)">まとめて</button>
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
const views = {
users: usersView, master: masterView,
reqs: () => reqViewHtml(state), compare: () => compareViewHtml(state),
help: () => helpViewHtml(),
};
const navItem = (view, label, sub) => `
      <button class="pr-nav-item${state.view === view ? ' active' : ''}" data-act="nav" data-view="${view}">
        ${label}<small>${sub}</small></button>`;
app.innerHTML = `
      <div class="pr-topbar">
        <span class="pr-brand" aria-hidden="true">N</span><span class="pr-title">WebReg<small>利用者権限登録 管理</small></span>
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
          ${navItem('reqs', '改廃依頼一覧' + (reqPendingCount() ? '<span class="pr-navbadge">' + reqPendingCount() + '</span>' : ''), '実機への登録作業待ち')}
          ${navItem('compare', '実機差分チェック', '実機CSVとリストの差分')}
          ${navItem('master', 'マスタ管理', LABEL_L1 + ' / ' + LABEL_L2)}
          ${navItem('help', 'ヘルプ', '使い方')}
        </nav>
        <div class="pr-main">${views[state.view]()}</div>
      </div>
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'} / ${esc(BUILD)}</div>`;
if (state.view === 'users') {
usersAfterRender(app, state, { rerender: render, onEdit: userEditFlow });
} else if (state.view === 'reqs') {
reqAfterRender(app, state, { rerender: render, onEdit: userEditFlow, onStatusChange: userStatusChange });
}
}
function reqPendingCount() {
if (!state.usersReady) return 0;
return state.users.filter((u) => isReqTarget(u) && reqStatusOf(u) !== WORK_STATUS_DONE).length;
}
function userStatusChange(id, status) {
const clearCt = status === WORK_STATUS_DONE;
const body = clearCt ? { WorkStatus: status, ChangeType: '' } : { WorkStatus: status };
run('ステータス更新', async () => {
const u = state.users.find((x) => x.Id === id);
auditNote((u ? '「' + (u.Title || '') + '」' : '#' + id) + 'の改廃ステータスを「' + status + '」に変更');
await ensureWorkStatusColumn();
await updateItem(LIST_USERS, id, body);
await reload();
});
}
async function reqBulkStatusFlow() {
const ids = [...selectedReqIds];
if (!ids.length) return;
const status = await openReqStatusModal(ids.length);
if (!status) return;
const clearCt = status === WORK_STATUS_DONE;
const body = clearCt ? { WorkStatus: status, ChangeType: '' } : { WorkStatus: status };
run('ステータス一括変更', async () => {
auditNote(ids.length + '件の改廃ステータスを「' + status + '」に変更');
await ensureWorkStatusColumn();
for (const id of ids) await updateItem(LIST_USERS, id, body);
selectedReqIds.clear();
await reload();
toast('ok', ids.length + '件のステータスを「' + status + '」に変更しました' +
(clearCt ? '(変更区分を空欄にして改廃依頼から除外)' : ''));
});
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
const kindLabel = row.dataset.kind === 'l1' ? LABEL_L1 : LABEL_L2;
const listTitle = row.dataset.kind === 'l1' ? LIST_L1 : LIST_L2;
run('マスタ更新', async () => {
auditNote(kindLabel + 'マスタ(ID ' + row.dataset.id + ')を' + (t.checked ? '有効化' : '無効化'));
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
if (act === 'settings') {
openSettingsModal(state, { onBackup: backupFlow, onRestore: restoreFlow, onReset: resetFlow })
.then(() => run('再読込', reload));
return;
}
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
if (act === 'user-import') { userImportFlow(); return; }
if (act === 'user-export') { userExportFlow(); return; }
if (act === 'user-import-xlsx') { userImportXlsxFlow(); return; }
if (act === 'compare-import') { compareImportFlow(); return; }
if (act === 'user-bulk') { userBulkFlow(); return; }
if (act === 'user-del-selected') { userDeleteFlow(); return; }
if (act === 'user-clear-sel') { selectedUserIds.clear(); render(); return; }
if (act === 'req-bulk-status') { reqBulkStatusFlow(); return; }
if (act === 'req-clear-sel') { selectedReqIds.clear(); render(); return; }
if (act === 'sync-users') {
const activeL1 = state.l1.filter((x) => x.Active !== false);
const activeL1Ids = new Set(activeL1.map((x) => x.Id));
const activeL2 = state.l2.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id));
if (!activeL1.length) {
toast('warn', '有効な' + LABEL_L1 + 'がありません。先にマスタを登録してください');
return;
}
const permsConfigured = hasAnyPermConfig(state);
const admins = await loadAdminGroupIds();
if (permsConfigured && !admins.length) {
toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)。' +
'権限グループ割当があるため、未設定だと実行者以外の管理者がアクセスできなくなります');
return;
}
const ok = await modal({
title: 'リストへ反映',
message: '「' + LIST_USERS + '」リスト(無ければ作成)に反映します: ' +
LABEL_L1 + ' ' + activeL1.length + '件を選択肢に、' + LABEL_L2 + ' ' + activeL2.length +
'件をチェック列+✅集計表示に。マスタで無効/削除した分の列は消えません(データ保全)。' +
(permsConfigured ? ' あわせて、権限設定が変わった' + LABEL_L1 + 'の行にアクセス権を適用します' +
'(管理者グループ ' + admins.length + '件=フル / 割当グループ=投稿。未割当の' +
LABEL_L1 + 'の行は管理者のみ。変更がなければ再適用しません)。' : ''),
okLabel: '反映する',
});
if (!ok) return;
const prevFp = state.syncFp;
run('リストへ反映', async () => {
auditNote('マスタを利用者一覧へ反映(' + LABEL_L1 + ' ' + activeL1.length + '件 / ' +
LABEL_L2 + ' ' + activeL2.length + '件' + (permsConfigured ? ' / 行アクセス権も適用' : '') + ')');
const s = await syncMastersToUserList(state, setStatus);
await saveSyncFp('master', computeMasterSnap(state));
let permMsg = '';
if (permsConfigured) {
const ps = await applyPermissionsChanged(state, prevFp, admins, setStatus);
if (ps.errors.length) {
toast('err', '権限設定に失敗した行 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
} else {
await saveSyncFp('perms', computePermsSnap(state, admins));
await saveSyncFp('permsVer', PERM_APPLY_VER);
permMsg = ps.skipped ? ' / 権限は変更なし(再適用なし)'
: ' / 行のアクセス権を ' + (ps.applied + ps.adminOnly) + '件に適用';
}
} else {
await saveSyncFp('perms', computePermsSnap(state, admins));
await saveSyncFp('permsVer', PERM_APPLY_VER);
}
let enMsg = '';
if (anyEnAssigned(state)) {
const en = await syncEnglishUserList(state, setStatus);
if (en.built) enMsg = ' / 英語リストに ' + en.users + '件を反映';
if (en.formulaWarn) toast('warn', '英語リストの集計式: ' + en.formulaWarn);
if (en.usersWarn) toast('warn', '英語リストの利用者反映: ' + en.usersWarn);
}
await reload();
toast('ok', (s.createdList ? '「' + LIST_USERS + '」を作成し、' : '') +
LABEL_L1 + ' ' + s.l1Count + '件 / ' + LABEL_L2 + ' ' + s.l2Count + '件を反映しました' +
(s.added ? '(列追加 ' + s.added + ')' : '') + (s.renamed ? '(改名 ' + s.renamed + ')' : '') +
permMsg + enMsg);
if (s.orderWarn) toast('warn', '列の並び替えに一部失敗しました — ' + s.orderWarn);
if (s.org2Migrated) toast('warn', s.org2Migrated);
if (s.org2Mode) state.org2Mode = s.org2Mode;
if (s.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました — ' + s.formulaWarn);
if (s.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました — ' + s.condWarn);
});
return;
}
if (act === 'discard-pending') {
if (!state.syncFp || !state.syncDiff || !state.syncDiff.canDiscard) return;
const d = state.syncDiff;
const ok = await modal({
title: '未反映の変更を破棄',
message: 'マスタと権限グループ割当を、前回「リストへ反映」した時点の状態に戻します: ' +
(d.summary.join(' / ') || '') + '。' +
(d.removed.length ? ' ※削除済みのマスタ行(' + d.removed.join('、') + ')は復元できません。' : '') +
'この操作は元に戻せません。',
okLabel: '破棄して戻す',
danger: true,
});
if (!ok) return;
run('変更の破棄', async () => {
auditNote('未反映のマスタ変更を破棄(' + (d.summary.join(' / ') || '') + ')');
const r = await revertSyncState(state, state.syncFp, setStatus);
await reload();
toast('ok', '未反映の変更を破棄しました(書き戻し ' + r.reverted + '件 / 追加分の削除 ' + r.deleted + '件)');
if (r.missing.length) {
toast('warn', '復元できなかった削除済みマスタ: ' + r.missing.join('、'));
}
});
return;
}
if (act === 'user-open-sp') {
try {
const j = await spGet(lt(LIST_USERS) + '?$select=DefaultViewUrl');
window.open(new URL(j.DefaultViewUrl, getWebUrl()).href, '_blank');
} catch (e) {
toast('err', 'SPリストを開けません — ' + e.message);
}
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
const entries = [];
let dup = 0;
for (const raw of text.split(/\r?\n/)) {
if (!raw.trim()) continue;
const parts = raw.split(/\t|,|，/);
const n = (parts[0] || '').trim();
const en = (parts[1] || '').trim();
if (!n) continue;
if (existing.has(n)) { dup++; continue; }
existing.add(n);
entries.push({ name: n, en });
}
if (!entries.length) {
toast('warn', '追加できる名称がありません' + (dup ? '(すべて既存と重複)' : ''));
return;
}
run('まとめて追加', async () => {
auditNote((isL1 ? LABEL_L1 : LABEL_L2) + 'マスタに ' + entries.length + '件をまとめて追加');
let order = nextOrder(pool);
for (const e of entries) {
const body = { Title: e.name, TitleEn: e.en, SortOrder: order, Active: true };
if (!isL1) body.Level1Id = state.selectedL1;
await addItem(isL1 ? LIST_L1 : LIST_L2, body);
order += 10;
}
await reload();
toast('ok', entries.length + '件追加しました' + (dup ? '(' + dup + '件は重複のためスキップ)' : ''));
});
return;
}
if (act === 'add-l1' || act === 'add-l2') {
const isL1 = act === 'add-l1';
const input = app.querySelector(isL1 ? '#pr-add-l1' : '#pr-add-l2');
const enInput = app.querySelector(isL1 ? '#pr-add-l1-en' : '#pr-add-l2-en');
const name = input.value.trim();
const nameEn = enInput ? enInput.value.trim() : '';
if (!name) return;
const pool = isL1 ? state.l1
: state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
if (pool.some((x) => x.Title === name)) {
toast('warn', '「' + name + '」は既に登録されています');
return;
}
run('マスタ追加', async () => {
auditNote((isL1 ? LABEL_L1 : LABEL_L2) + 'マスタに「' + name + '」を追加');
const body = { Title: name, TitleEn: nameEn, SortOrder: nextOrder(pool), Active: true };
if (!isL1) body.Level1Id = state.selectedL1;
await addItem(isL1 ? LIST_L1 : LIST_L2, body);
await reload();
toast('ok', '「' + name + '」を追加しました');
});
return;
}
if (!item) return;
if (act === 'perm') {
openL1PermModal(state, item).then((saved) => { if (saved) run('再読込', reload); });
return;
}
if (act === 'rename') {
const r = await openRenameMasterModal(item);
if (!r) return;
if (r.title === item.Title && r.titleEn === (item.TitleEn || '')) return;
run('名称変更', async () => {
auditNote((kind === 'l1' ? LABEL_L1 : LABEL_L2) + 'マスタ「' + item.Title + '」→「' + r.title +
'」(英:' + (r.titleEn || '-') + ')に変更');
await updateItem(listTitle, id, { Title: r.title, TitleEn: r.titleEn });
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
run('マスタ削除', async () => {
auditNote((kind === 'l1' ? LABEL_L1 : LABEL_L2) + 'マスタ「' + item.Title + '」を削除');
await deleteItem(listTitle, id);
await reload();
toast('ok', '「' + item.Title + '」を削除しました');
});
} else if (act === 'up' || act === 'down') {
run('並べ替え', async () => {
auditNote((kind === 'l1' ? LABEL_L1 : LABEL_L2) + 'マスタ「' + item.Title + '」を' + (act === 'up' ? '上へ' : '下へ') + '移動');
await moveItem(listTitle, items, item, act === 'up' ? -1 : 1);
await reload();
});
}
});
render();
run('読込', async () => {
try { await bootstrapPrefixFromCommon(); } catch { }
await reload();
});
window.__webreg = {
state,
build: BUILD,
importCsvText: (t) => userImportFlow(t),
exportXlsx: (titles) => buildExportXlsx(state, titles),
importXlsx: (buf) => userImportXlsxFlow(buf),
compareCsvText: (t) => compareImportFlow(t),
};
startUpdateWatcher(BUILD);
if (window.__webregUsersPoll) clearInterval(window.__webregUsersPoll);
const usersFingerprint = (arr) =>
arr.length + '|' + arr.map((u) => u.Id + ':' + (u.Modified || '')).sort().join(',');
const pollUsers = async () => {
if (document.hidden || state.busy || !state.usersReady) return;
if (root.querySelector('.pr-backdrop')) return;
try {
const r = await spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999');
const next = r.value || [];
if (usersFingerprint(state.users) === usersFingerprint(next)) return;
state.users = next;
const ae = document.activeElement;
if (ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
render();
} catch { }
};
window.__webregUsersPoll = setInterval(pollUsers, POLL_INTERVAL);
window.__webregPollNow = pollUsers;
})();
})();
