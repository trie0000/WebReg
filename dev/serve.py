#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""開発者モード用の簡易配信サーバ(Python 標準ライブラリのみ / npm・Node 不要)。

dist/ を CORS 付きで配信する。SP ページ(https)から http://127.0.0.1 への
fetch はブラウザの localhost 例外で許可される。
全リクエストを1行ログに出す(届いているかの切り分け用 — 全アプリ共通規約 §18)。

使い方:  python3 dev/serve.py [port]   (既定 18086、環境変数 PERMREG_DEV_PORT でも指定可)
"""
import os
import sys
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get('PERMREG_DEV_PORT') or (sys.argv[1] if len(sys.argv) > 1 else 18086))
DIST = Path(__file__).resolve().parent.parent / 'dist'


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # /permreg/xxx も /xxx も dist/xxx に解決する
        clean = path.split('?')[0]
        if clean.startswith('/permreg/') or clean == '/permreg':
            clean = clean[len('/permreg'):] or '/'
        self.path = clean
        return super().translate_path(clean)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        origin = self.headers.get('Origin', '') if hasattr(self, 'headers') else ''
        print(datetime.now().strftime('%H:%M:%S'), fmt % args, origin)


if __name__ == '__main__':
    handler = partial(Handler, directory=str(DIST))
    print(f'permreg dev server: http://127.0.0.1:{PORT}/permreg/ -> dist/')
    ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
