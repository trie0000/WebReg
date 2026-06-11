// permreg ビルド。配布物の命名は全アプリ共通規約(§17)に準拠:
//   dist/permreg.bundle.js   … 本体(minify、SP/ローカル開発サーバが配信)
//   dist/version.txt         … 安定識別子 <ver>-<srcSha8>(buildTime を含めない)
//   dist/permreg.loader.js   … ローダ JS(= bookmarklet の中身)
//   dist/bookmarklet.txt     … ローダの javascript: URL(コピー用)
//   dist/install-loader.html … ローダ型インストールページ(推奨・配布物)
//   dist/install.html        … 丸ごと埋込インストールページ(オフライン用)
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pkg = require('./package.json');

// 安定識別子: src/ 配下 + package.json のハッシュ(どのソース変更でも必ず変わる)
function srcSha() {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(path.join(__dirname, 'src'));
  files.push(path.join(__dirname, 'package.json'));
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f); h.update('\0'); h.update(fs.readFileSync(f));
  }
  return h.digest('hex').slice(0, 8);
}
const VERSION = pkg.version + '-' + srcSha();

// 本体: src/main.js をエントリにモジュールをバンドル(minify)
const bundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  define: { __BUILD__: JSON.stringify(VERSION) },
}).outputFiles[0].text;

// ローダ: 単体 minify(bookmarklet に収まる極小サイズ)
const loader = esbuild.transformSync(fs.readFileSync(path.join(__dirname, 'src/loader.js'), 'utf8'), {
  minify: true,
  target: 'es2017',
}).code;

const DIST = path.join(__dirname, 'dist');
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'permreg.bundle.js'), bundle);
fs.writeFileSync(path.join(DIST, 'version.txt'), VERSION + '\n');
fs.writeFileSync(path.join(DIST, 'permreg.loader.js'), loader);

const loaderBookmarklet = 'javascript:' + encodeURIComponent(loader);
const embedBookmarklet = 'javascript:' + encodeURIComponent(bundle);
fs.writeFileSync(path.join(DIST, 'bookmarklet.txt'), loaderBookmarklet);

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function installHtml(title, note, bm) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font:14px/1.7 "Meiryo","Segoe UI",sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#2a2a26;background:#fafaf7}
a.bm{display:inline-block;background:#7a8a78;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold}
textarea{width:100%;height:120px;font:11px/1.4 monospace}
ol li{margin:6px 0}
.note{color:#7a766c;font-size:13px}
</style></head><body>
<h1>${title}</h1>
<p class="note">${note}</p>
<ol>
<li>下のボタンをブックマークバーへ<strong>ドラッグ&ドロップ</strong>する</li>
<li>対象の SharePoint サイトのページを開く</li>
<li>ブックマークをクリックして起動</li>
</ol>
<p><a class="bm" href="${escAttr(bm)}">permreg 管理</a></p>
<p>ドラッグできない場合は、以下をコピーしてブックマークの URL に貼り付けてください。</p>
<textarea readonly>${escText(bm)}</textarea>
<p class="note">version: ${VERSION}</p>
</body></html>
`;
}

fs.writeFileSync(path.join(DIST, 'install-loader.html'), installHtml(
  'permreg インストール(ローダ版・推奨)',
  '本体は SP の ドキュメント/permreg/(または開発者モードのローカルサーバ)から毎回最新を読み込みます。dist 一式を SP に配置してから使ってください。',
  loaderBookmarklet));

fs.writeFileSync(path.join(DIST, 'install.html'), installHtml(
  'permreg インストール(埋め込み版・オフライン用)',
  '本体を丸ごと埋め込んだ版です。自動更新されないため、通常はローダ版(install-loader.html)を使ってください。',
  embedBookmarklet));

console.log('built: permreg.bundle.js ' + bundle.length + 'B / loader bookmarklet ' +
  loaderBookmarklet.length + 'B / version ' + VERSION);
