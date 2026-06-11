// 開発者モード用の簡易配信サーバ: dist/ を CORS 付きで配信する。
// SP ページ(https)から http://127.0.0.1 への fetch はブラウザの localhost 例外で許可される。
// 全リクエストを1行ログに出す(届いているかの切り分け用 — 全アプリ共通規約 §18)。
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +(process.env.PERMREG_DEV_PORT || process.argv[2] || 18086);
const DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const now = () => new Date().toISOString().slice(11, 19);

http.createServer((req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  // /permreg/xxx も /xxx も dist/xxx に解決する
  const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/permreg/, '') || '/';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403, headers);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    const status = err ? 404 : 200;
    console.log(now(), req.method, req.url, status, req.headers.origin || '');
    if (err) {
      res.writeHead(404, headers);
      res.end('not found');
      return;
    }
    res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }, headers));
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('permreg dev server: http://127.0.0.1:' + PORT + '/permreg/ -> dist/');
});
