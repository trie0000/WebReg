/* permreg ローダ (= bookmarklet の中身)。memola/Spira と同方式。
 *
 * 起動時に version.txt を確認して permreg.bundle.js?v=<ver> を読み込む。
 *  - 既定: SP の「ドキュメント/permreg/」(<web>/Shared Documents/permreg/) から <script src> で読込
 *  - 開発者モード(localStorage permreg.dev.bundle-source === 'local'):
 *    ローカル開発サーバ(npm run dev)から CSP 回避のため fetch → (0,eval)() で読込
 *  - ローカル失敗は alert(loud)、SP 失敗はローカルへのフォールバックなし・alert で案内
 */
(function () {
  var d = document, w = window;

  function spBase() {
    try {
      var c = w._spPageContextInfo;
      if (c && c.webServerRelativeUrl) {
        return c.webServerRelativeUrl.replace(/\/$/, '') + '/Shared%20Documents/permreg';
      }
    } catch (e) { /* ignore */ }
    var m = location.pathname.match(/^(\/(?:sites|teams)\/[^/]+)/);
    return (m ? m[1] : '') + '/Shared%20Documents/permreg';
  }

  var dev = '';
  try {
    if (w.localStorage && localStorage.getItem('permreg.dev.bundle-source') === 'local') {
      dev = (localStorage.getItem('permreg.dev.local-base') || 'http://127.0.0.1:18086/permreg').replace(/\/+$/, '');
    }
  } catch (e) { /* ignore */ }

  var sp = spBase();
  var base = dev || sp;
  var isLocal = !!dev;

  function fail(why) {
    var msg = '[permreg] バンドル読込失敗: ' + base + (why ? ' (' + why + ')' : '') + '\n' +
      (isLocal
        ? 'npm run dev が起動しているか、設定のローカル配信URLを確認してください。'
        : 'SP の ドキュメント/permreg/ に dist 一式を配置するか、設定画面で開発者モードに切り替えてください。');
    alert(msg);
    console.error(msg);
  }

  function evalLoad(ver) {
    fetch(base + '/permreg.bundle.js?v=' + encodeURIComponent(ver))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) {
        try { (0, eval)(t); w.__permregSource = { base: base, dev: isLocal, ver: ver }; }
        catch (e) { fail('eval: ' + (e && e.message || e)); }
      })
      .catch(function (e) { fail(e && e.message || 'fetch error'); });
  }

  function scriptLoad(ver) {
    var o = d.getElementById('permreg-script');
    if (o) o.remove();
    var s = d.createElement('script');
    s.id = 'permreg-script';
    s.src = base + '/permreg.bundle.js?v=' + encodeURIComponent(ver);
    s.onload = function () { w.__permregSource = { base: base, dev: false, ver: ver }; };
    s.onerror = function () { fail('script load error'); };
    d.body.appendChild(s);
  }

  fetch(base + '/version.txt?t=' + Date.now(), { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (t) {
      var ver = (t || '').trim() || String(Date.now());
      isLocal ? evalLoad(ver) : scriptLoad(ver);
    })
    .catch(function (e) { fail(e && e.message || 'fetch error'); });
})();
