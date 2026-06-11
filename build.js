// permreg ビルド: src/main.js → dist/app.js(そのまま) + dist/bookmarklet.txt + dist/install.html
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf8');

// esbuild があれば minify、無ければ素のまま bookmarklet 化する
let minified = src;
try {
  const esbuild = require('esbuild');
  minified = esbuild.transformSync(src, { minify: true, target: 'es2020' }).code;
} catch {
  console.warn('esbuild が見つからないため minify をスキップします (npm install で導入可)');
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/app.js'), src);

const bookmarklet = 'javascript:' + encodeURIComponent(minified);
fs.writeFileSync(path.join(__dirname, 'dist/bookmarklet.txt'), bookmarklet);

const installHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>permreg インストール</title>
<style>
body{font:14px/1.7 "Segoe UI","Yu Gothic UI",sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#222}
a.bm{display:inline-block;background:#0b5cab;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold}
textarea{width:100%;height:120px;font:11px/1.4 monospace}
ol li{margin:6px 0}
</style></head><body>
<h1>permreg — マスタ管理 bookmarklet</h1>
<ol>
<li>下のボタンをブックマークバーへ<strong>ドラッグ&ドロップ</strong>する</li>
<li>対象の SharePoint サイトのページを開く</li>
<li>ブックマークをクリックして起動 → 初回は「初期セットアップ」でマスタリストを作成</li>
</ol>
<p><a class="bm" href="${bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">permreg マスタ管理</a></p>
<p>ドラッグできない場合は、以下をコピーしてブックマークの URL に貼り付けてください。</p>
<textarea readonly>${bookmarklet.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
</body></html>
`;
fs.writeFileSync(path.join(__dirname, 'dist/install.html'), installHtml);

console.log('built: dist/app.js (' + src.length + ' bytes), dist/bookmarklet.txt (' +
  bookmarklet.length + ' bytes), dist/install.html');
