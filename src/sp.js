// SharePoint REST クライアント。本リポジトリの REST 呼び出しは必ずこのモジュール経由
// (odata=nometadata 統一 / digest 管理 / エラーメッセージ整形)
let _webUrl = '';
let _digest = null; // {value, exp}

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

// コンテンツタイプの FieldLinks 並び替え(SP標準の新規/編集フォームの項目順を決める)。
// REST v1 に reorder が無いため CSOM ProcessQuery を使う。orderedInternalNames は全列の並び。
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

// コレクション型プロパティ(SP.FieldChoice.Choices 等)の更新は verbose 形式が必要になる
// 場合があるため、__metadata 付きで MERGE する別経路を用意しておく
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
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}
