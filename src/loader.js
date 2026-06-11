/* webreg ローダ (= bookmarklet の中身)。memola/Spira と同方式。
 *
 * 起動時に version.txt を確認して webreg.bundle.js?v=<ver> を読み込む。
 *  - 既定: SP の「ドキュメント/webreg/」(<web>/Shared Documents/webreg/) から <script src> で読込
 *  - 開発者モード(localStorage webreg.dev.bundle-source === 'local'):
 *    ローカル開発サーバ(npm run dev)から CSP 回避のため fetch → (0,eval)() で読込
 *  - ローカル失敗は alert(loud)、SP 失敗はローカルへのフォールバックなし・alert で案内
 */
(function () {
  var d = document, w = window;

  function spBase() {
    try {
      var c = w._spPageContextInfo;
      if (c && c.webServerRelativeUrl) {
        return c.webServerRelativeUrl.replace(/\/$/, '') + '/Shared%20Documents/webreg';
      }
    } catch (e) { /* ignore */ }
    var m = location.pathname.match(/^(\/(?:sites|teams)\/[^/]+)/);
    return (m ? m[1] : '') + '/Shared%20Documents/webreg';
  }

  // 旧ツール名(permreg)からの localStorage 設定移行。ローダが設定を読む「前」に
  // 行う必要がある(bundle 側に置くと、配信元が解決できず bundle 自体が読めない)
  try {
    if (w.localStorage) {
      var olds = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('permreg.') === 0) olds.push(k);
      }
      for (var j = 0; j < olds.length; j++) {
        var nk = 'webreg.' + olds[j].slice('permreg.'.length);
        if (localStorage.getItem(nk) == null) {
          localStorage.setItem(nk, String(localStorage.getItem(olds[j])).replace('/permreg', '/webreg'));
        }
      }
    }
  } catch (e) { /* ignore */ }

  var dev = '';
  try {
    if (w.localStorage && localStorage.getItem('webreg.dev.bundle-source') === 'local') {
      dev = (localStorage.getItem('webreg.dev.local-base') || 'http://127.0.0.1:18086/webreg').replace(/\/+$/, '');
    }
  } catch (e) { /* ignore */ }

  var sp = spBase();
  var base = dev || sp;
  var isLocal = !!dev;

  function fail(why) {
    var msg = '[WebReg] バンドル読込失敗: ' + base + (why ? ' (' + why + ')' : '') + '\n' +
      (isLocal
        ? 'npm run dev が起動しているか、設定のローカル配信URLを確認してください。'
        : 'SP の ドキュメント/webreg/ に dist 一式を配置するか、設定画面で開発者モードに切り替えてください。');
    alert(msg);
    console.error(msg);
  }

  // __webregSource は bundle 実行「前」に設定する。bundle 起動時の更新監視が
  // これを読むため、後から設定すると初回起動で監視が無効になる
  function evalLoad(ver) {
    w.__webregSource = { base: base, dev: isLocal, ver: ver };
    fetch(base + '/webreg.bundle.js?v=' + encodeURIComponent(ver))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) {
        try { (0, eval)(t); }
        catch (e) { fail('eval: ' + (e && e.message || e)); }
      })
      .catch(function (e) { fail(e && e.message || 'fetch error'); });
  }

  function scriptLoad(ver) {
    var o = d.getElementById('webreg-script');
    if (o) o.remove();
    w.__webregSource = { base: base, dev: false, ver: ver };
    var s = d.createElement('script');
    s.id = 'webreg-script';
    s.src = base + '/webreg.bundle.js?v=' + encodeURIComponent(ver);
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
