#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""開発者モード用の簡易配信サーバ(Python 標準ライブラリのみ / npm・Node 不要)。

配信フォルダ(既定 dist/)を CORS 付きで配信する。SP ページ(https)から
http://127.0.0.1 への fetch はブラウザの localhost 例外で許可される。
全リクエストを1行ログに出す(届いているかの切り分け用 — 全アプリ共通規約 §18)。

配信フォルダはアプリの設定画面から変更できる(§18 bundle-dir パターン):
  GET  /permreg/bundle-dir            … 現在の配信フォルダを返す {"dir": "..."}
  POST /permreg/bundle-dir {"dir":..} … 存在チェックの上で切替(再起動で既定に戻る)

使い方:  python3 dev/serve.py [port]
         (port 既定 18086 = PERMREG_DEV_PORT、フォルダ既定 dist/ = PERMREG_BUNDLE_DIR)
"""
import json
import os
import posixpath
import sys
import urllib.parse
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get('PERMREG_DEV_PORT') or (sys.argv[1] if len(sys.argv) > 1 else 18086))
DEFAULT_DIR = Path(os.environ.get('PERMREG_BUNDLE_DIR') or (Path(__file__).resolve().parent.parent / 'dist'))
STATE = {'dir': DEFAULT_DIR.resolve()}


class Handler(SimpleHTTPRequestHandler):
    def _clean(self):
        p = urllib.parse.unquote(self.path.split('?')[0])
        if p.startswith('/permreg/') or p == '/permreg':
            p = p[len('/permreg'):] or '/'
        return p

    def translate_path(self, path):
        clean = posixpath.normpath(self._clean())
        parts = [x for x in clean.split('/') if x and x not in ('.', '..')]
        return str(STATE['dir'].joinpath(*parts)) if parts else str(STATE['dir'])

    def _json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self._clean() == '/bundle-dir':
            return self._json(200, {'dir': str(STATE['dir'])})
        super().do_GET()

    def do_POST(self):
        if self._clean() != '/bundle-dir':
            return self.send_error(404)
        try:
            length = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
            d = Path(str(body.get('dir', ''))).expanduser()
        except Exception:
            return self._json(400, {'error': 'リクエストの形式が不正です'})
        if not d.is_dir():
            return self._json(400, {'error': 'フォルダが存在しません: ' + str(d)})
        if not (d / 'permreg.bundle.js').is_file():
            return self._json(400, {'error': 'permreg.bundle.js が見つかりません: ' + str(d)})
        STATE['dir'] = d.resolve()
        print(datetime.now().strftime('%H:%M:%S'), 'bundle-dir ->', STATE['dir'])
        return self._json(200, {'dir': str(STATE['dir'])})

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        origin = self.headers.get('Origin', '') if hasattr(self, 'headers') else ''
        print(datetime.now().strftime('%H:%M:%S'), fmt % args, origin)


if __name__ == '__main__':
    print(f'permreg dev server: http://127.0.0.1:{PORT}/permreg/ -> {STATE["dir"]}')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
