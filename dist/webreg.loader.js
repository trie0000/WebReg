(function () {
var d = document, w = window;
function spBase() {
try {
var c = w._spPageContextInfo;
if (c && c.webServerRelativeUrl) {
return c.webServerRelativeUrl.replace(/\/$/, '') + '/Shared%20Documents/webreg';
}
} catch (e) { }
var m = location.pathname.match(/^(\/(?:sites|teams)\/[^/]+)/);
return (m ? m[1] : '') + '/Shared%20Documents/webreg';
}
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
localStorage.removeItem(olds[j]);
}
}
} catch (e) { }
var dev = '';
try {
if (w.localStorage && localStorage.getItem('webreg.dev.bundle-source') === 'local') {
dev = (localStorage.getItem('webreg.dev.local-base') || 'http://127.0.0.1:18086/webreg').replace(/\/+$/, '');
}
} catch (e) { }
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
