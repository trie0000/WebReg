#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WebReg ビルド(Python 標準ライブラリのみ / npm・Node 不要)。

src/ の各ファイルを決まった順序で連結して1つの IIFE にまとめ、
軽量 minify(コメント・インデント・空行の除去。識別子の短縮はしない)を掛けて
dist/ に配布物一式を生成する。命名は全アプリ共通規約(§17)に準拠:
  dist/webreg.bundle.js   … 本体(SP/ローカル開発サーバが配信)
  dist/version.txt         … 安定識別子 <ver>-<srcSha8>(buildTime を含めない)
  dist/webreg.loader.js   … ローダ JS(= bookmarklet の中身)
  dist/bookmarklet.txt     … ローダの javascript: URL(コピー用)
  dist/install-loader.html … ローダ型インストールページ(推奨・配布物)
  dist/install.html        … 丸ごと埋込インストールページ(オフライン用)

使い方:  python3 build.py   (Windows は python build.py)
"""
import hashlib
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'src'
DIST = ROOT / 'dist'

# 連結順序 = 依存順(config → 基盤 → main)。新しいファイルはここに追加する
ORDER = ['config.js', 'sp.js', 'schema.js', 'usersync.js', 'perms.js', 'syncstate.js', 'icons.js', 'styles.js', 'ui.js', 'grid.js', 'usersview.js', 'reqview.js', 'compare.js', 'settings.js', 'importcsv.js', 'xlsx.js', 'xlsxflow.js', 'updater.js', 'main.js']


def minify_js(code: str) -> str:
    """軽量 minify: コメント除去・インデント除去・空白圧縮・空行除去。

    文字列('` ")・テンプレートリテラル(`${}` のネスト含む)・正規表現リテラルの
    中身には触れない。改行は維持する(ASI を壊さないため)。識別子の短縮はしない。
    """
    out = []
    i, n = 0, len(code)
    state = 'code'          # code | sq | dq | tpl
    tpl_stack = []          # 'tpl'(テンプレート内) / 'expr'(${} 内=codeに戻る)
    prev_sig = ''           # 直前の意味のある文字(正規表現/除算の判定用)
    at_line_start = True    # 行頭(インデント除去用)
    REGEX_BEFORE = set('(,=:[!&|?{};+-*%<>~^')

    def last_word():
        # return /typeof などキーワード直後の / も正規表現として扱う
        s = ''.join(out[-12:])
        for kw in ('return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof'):
            if s.rstrip().endswith(kw):
                return True
        return False

    while i < n:
        c = code[i]
        nxt = code[i + 1] if i + 1 < n else ''

        if state == 'code':
            if c == '/' and nxt == '/':
                while i < n and code[i] != '\n':
                    i += 1
                continue
            if c == '/' and nxt == '*':
                i += 2
                while i + 1 < n and not (code[i] == '*' and code[i + 1] == '/'):
                    i += 1
                i += 2
                if out and not out[-1].isspace():
                    out.append(' ')  # トークン結合(a/**/b → a b)を防ぐ
                continue
            if c == '\n':
                if out and out[-1] == ' ':
                    out.pop()  # 行末の空白を除去
                if out and out[-1] != '\n':
                    out.append('\n')
                at_line_start = True
                i += 1
                continue
            if c in ' \t':
                if not at_line_start and out and out[-1] not in (' ', '\n'):
                    out.append(' ')  # 連続空白は1つに
                i += 1
                continue
            at_line_start = False
            if c == "'":
                state = 'sq'
            elif c == '"':
                state = 'dq'
            elif c == '`':
                state = 'tpl'
                tpl_stack.append('tpl')
            elif c == '}' and tpl_stack and tpl_stack[-1] == 'expr':
                tpl_stack.pop()
                state = 'tpl'
            elif c == '/':
                if prev_sig in REGEX_BEFORE or prev_sig == '' or last_word():
                    # 正規表現リテラル: 文字クラスとエスケープを考慮して / まで素通し
                    out.append(c)
                    i += 1
                    in_class = False
                    while i < n:
                        ch = code[i]
                        out.append(ch)
                        if ch == '\\':
                            out.append(code[i + 1])
                            i += 2
                            continue
                        if ch == '[':
                            in_class = True
                        elif ch == ']':
                            in_class = False
                        elif ch == '/' and not in_class:
                            i += 1
                            break
                        i += 1
                    while i < n and code[i].isalpha():  # フラグ
                        out.append(code[i])
                        i += 1
                    prev_sig = '/'
                    continue
            out.append(c)
            prev_sig = c
            i += 1

        elif state in ('sq', 'dq'):
            out.append(c)
            if c == '\\':
                out.append(nxt)
                i += 2
                continue
            if (state == 'sq' and c == "'") or (state == 'dq' and c == '"'):
                state = 'code'
                prev_sig = c
            i += 1

        else:  # tpl: テンプレートリテラル内は完全に素通し
            out.append(c)
            if c == '\\':
                out.append(nxt)
                i += 2
                continue
            if c == '$' and nxt == '{':
                out.append('{')
                tpl_stack[-1] = 'tpl'  # 現テンプレートはそのまま
                tpl_stack.append('expr')
                state = 'code'
                prev_sig = '{'
                i += 2
                continue
            if c == '`':
                tpl_stack.pop()
                state = 'code'
                prev_sig = c
            i += 1

    # 空行(連続改行)の圧縮
    text = ''.join(out)
    lines = [ln for ln in text.split('\n') if ln.strip() != '']
    return '\n'.join(lines) + '\n'


def compute_version() -> str:
    base = (ROOT / 'VERSION').read_text().strip()
    h = hashlib.sha256()
    for name in ORDER + ['loader.js']:
        p = SRC / name
        h.update(name.encode())
        h.update(b'\0')
        h.update(p.read_bytes())
    h.update((ROOT / 'VERSION').read_bytes())
    return base + '-' + h.hexdigest()[:8]


def install_html(title: str, note: str, bookmarklet: str, version: str) -> str:
    esc_attr = bookmarklet.replace('&', '&amp;').replace('"', '&quot;')
    esc_text = bookmarklet.replace('&', '&amp;').replace('<', '&lt;')
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>{title}</title>
<style>
body{{font:14px/1.7 "Meiryo","Segoe UI",sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#2a2a26;background:#fafaf7}}
a.bm{{display:inline-block;background:#7a8a78;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold}}
textarea{{width:100%;height:120px;font:11px/1.4 monospace}}
ol li{{margin:6px 0}}
.note{{color:#7a766c;font-size:13px}}
</style></head><body>
<h1>{title}</h1>
<p class="note">{note}</p>
<ol>
<li>下のボタンをブックマークバーへ<strong>ドラッグ&amp;ドロップ</strong>する</li>
<li>対象の SharePoint サイトのページを開く</li>
<li>ブックマークをクリックして起動</li>
</ol>
<p><a class="bm" href="{esc_attr}">WebReg 管理</a></p>
<p>ドラッグできない場合は、以下をコピーしてブックマークの URL に貼り付けてください。</p>
<textarea readonly>{esc_text}</textarea>
<p class="note">version: {version}</p>
</body></html>
"""


def main():
    version = compute_version()

    parts = [(SRC / name).read_text() for name in ORDER]
    bundle = '/* webreg bundle ' + version + ' */\n(() => {\n' + '\n'.join(parts) + '\n})();\n'
    bundle = bundle.replace('__BUILD__', '"' + version + '"')
    bundle = minify_js(bundle)

    loader = minify_js((SRC / 'loader.js').read_text())

    # encodeURIComponent 相当(非予約文字 A-Za-z0-9 - _ . ! ~ * ' ( ) 以外を %XX に)
    enc = lambda s: urllib.parse.quote(s, safe="!'()*-._~")
    loader_bm = 'javascript:' + enc(loader)
    embed_bm = 'javascript:' + enc(bundle)

    DIST.mkdir(exist_ok=True)
    (DIST / 'webreg.bundle.js').write_text(bundle)
    (DIST / 'version.txt').write_text(version + '\n')
    (DIST / 'webreg.loader.js').write_text(loader)
    (DIST / 'bookmarklet.txt').write_text(loader_bm)
    (DIST / 'install-loader.html').write_text(install_html(
        'WebReg インストール(ローダ版・推奨)',
        '本体は SP の ドキュメント/webreg/(または開発者モードのローカルサーバ)から毎回最新を読み込みます。dist 一式を SP に配置してから使ってください。',
        loader_bm, version))
    (DIST / 'install.html').write_text(install_html(
        'WebReg インストール(埋め込み版・オフライン用)',
        '本体を丸ごと埋め込んだ版です。自動更新されないため、通常はローダ版(install-loader.html)を使ってください。',
        embed_bm, version))

    print(f'built: webreg.bundle.js {len(bundle)}B / loader bookmarklet {len(loader_bm)}B / version {version}')


if __name__ == '__main__':
    main()
