// SharePoint REST クライアント。本リポジトリの REST 呼び出しは必ずこのモジュール経由
// (odata=nometadata 統一 / digest 管理 / エラーメッセージ整形)
let _webUrl = '';
let _digest = null; // {value, exp}

export function setWebUrl(u) {
  _webUrl = String(u || '').replace(/\/+$/, '');
  _digest = null;
}
export function getWebUrl() {
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

export const spGet = (p) => sp('GET', p);
export const spPost = (p, b) => sp('POST', p, b);
export const spMerge = (p, b) => sp('POST', p, b, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
export const spDelete = (p) => sp('POST', p, null, { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' });
export const lt = (title) => "/_api/web/lists/getbytitle('" + encodeURIComponent(title.replace(/'/g, "''")) + "')";
