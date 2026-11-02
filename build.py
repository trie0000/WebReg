#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WebReg ビルド(Python 標準ライブラリのみ / npm・Node 不要)。

src/ の各ファイルを決まった順序で連結して1つの IIFE にまとめ、
軽量 minify(コメント・インデント・不要な空白と改行の除去・CSS 圧縮。識別子の短縮はしない)を掛けて
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
ORDER = ['config.js', 'i18n.js', 'sp.js', 'schema.js', 'usersync.js', 'perms.js', 'enlist.js', 'syncstate.js',
         'icons.js', 'styles.js', 'stylesviews.js', 'ui.js', 'grid.js', 'gridfilter.js', 'usersview.js', 'userform.js', 'reqview.js',
         'compare.js', 'help.js', 'audit.js', 'backup.js', 'settings.js', 'importcsv.js', 'xlsx.js', 'xlsxflow.js',
         'updater.js', 'appcore.js', 'masterview.js', 'userflows.js', 'ioflows.js', 'masteractions.js', 'main.js']


# 識別子の一部とみなす文字(この2つの間の空白は消せない)
def _is_word(ch: str) -> bool:
    return ch.isalnum() or ch in '_$\\' or ord(ch) > 127


def _need_space(a: str, b: str) -> bool:
    """コード中の空白を挟む2文字 a, b の間に空白が必要か(不要なら詰める)。"""
    if _is_word(a) and _is_word(b):
        return True                      # return x / typeof y / a in b
    if a in '+-' and b == a:
        return True                      # a + +b / a - -b(++ / -- に化けるのを防ぐ)
    if '/' in (a, b):
        return True                      # 正規表現リテラル・コメントとの誤結合を避ける
    if (a, b) in (('<', '!'), ('-', '>')):
        return True                      # <!-- / --> (HTML 風コメント)に化けるのを防ぐ
    if a.isdigit() and b == '.':
        return True                      # 1 .toString()
    if _is_word(a) and b == '`':
        return True                      # 識別子 + テンプレート = タグ付きテンプレートになるのを防ぐ
    return False


# 改行を詰めても ASI(自動セミコロン挿入)の結果が変わらない継ぎ目。
# 前の行がこの文字で終わる(式・文が続く)か、次の行がこの文字で始まる場合だけ行を結合する。
# + / - は ++ / -- の制限生成規則があるため含めない
_JOIN_AFTER = set('{,;([=&|?:')
_JOIN_BEFORE = set('})].?:')


def minify_js(code: str) -> str:
    """軽量 minify: コメント除去・インデント除去・空白圧縮・空行除去。

    文字列(' ")・テンプレートリテラル(`${}` のネスト含む)・正規表現リテラルの
    中身には触れない(テンプレートは改行直後のインデントだけ除く。HTML/CSS 用途のみのため
    表示は変わらない)。改行は ASI に影響しない継ぎ目でだけ詰める。識別子の短縮はしない。
    """
    out = []
    i, n = 0, len(code)
    state = 'code'          # code | sq | dq | tpl
    tpl_stack = []          # 'tpl'(テンプレート内) / 'expr'(${} 内=codeに戻る)
    prev_sig = ''           # 直前の意味のある文字(正規表現/除算の判定用)
    pend_sp = False         # コード中の保留中の空白
    pend_nl = False         # コード中の保留中の改行
    REGEX_BEFORE = set('(,=:[!&|?{};+-*%<>~^')

    def last_word():
        # return /typeof などキーワード直後の / も正規表現として扱う
        s = ''.join(out[-12:])
        for kw in ('return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof'):
            if s.rstrip().endswith(kw):
                return True
        return False

    def flush(c):
        # 保留中の空白/改行を、次に出す文字 c との関係で 空白/改行/なし のどれかにして出力する
        nonlocal pend_sp, pend_nl
        if out:
            a = out[-1]
            if pend_nl and not (a in _JOIN_AFTER or c in _JOIN_BEFORE):
                out.append('\n')
            elif (pend_nl or pend_sp) and _need_space(a, c):
                out.append(' ')
        pend_sp = pend_nl = False

    while i < n:
        c = code[i]
        nxt = code[i + 1] if i + 1 < n else ''

        if state == 'code':
            if c == '/' and nxt == '/':
                while i < n and code[i] != '\n':
                    i += 1
                continue
            if c == '/' and nxt == '*':
                j = code.find('*/', i + 2)
                j = n if j < 0 else j
                if '\n' in code[i:j]:
                    pend_nl = True   # 改行を含むコメントは ASI 上の行終端として扱う
                else:
                    pend_sp = True   # トークン結合(a/**/b → ab)を防ぐ
                i = j + 2
                continue
            if c == '\n':
                pend_nl = True
                i += 1
                continue
            if c in ' \t\r':
                pend_sp = True
                i += 1
                continue
            flush(c)
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

        else:  # tpl: テンプレートリテラル内は素通し(改行直後のインデントだけ除く)
            out.append(c)
            if c == '\\':
                out.append(nxt)
                i += 2
                continue
            if c == '\n':
                i += 1
                while i < n and code[i] in ' \t':
                    i += 1
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

    return ''.join(out).strip() + '\n'


def minify_css_template(code: str) -> str:
    """CSS を持つファイル(styles*.js)の `const css… = `...`` の中身を圧縮する。

    コメント除去・空白の圧縮・{ } ; , の前後と : の後ろの空白除去。セレクタの子孫結合子
    (空白)や calc() の演算子の空白は1つ残る。テンプレート式(${ROOT_ID} 等)は圧縮の前に
    退避して戻す(式の } を CSS の } と誤認して直後の子孫結合子の空白を消さないため)。
    """
    import re

    def css(m):
        exprs = []

        def hide(e):
            exprs.append(e.group(0))
            return '\x00' + str(len(exprs) - 1) + '\x00'
        body = re.sub(r'\$\{[^}]*\}', hide, m.group(2))
        body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
        body = re.sub(r'\s+', ' ', body)
        body = re.sub(r'\s*([{};,])\s*', r'\1', body)
        body = re.sub(r':\s+', ':', body)
        body = body.replace(';}', '}').strip()
        body = re.sub('\x00(\\d+)\x00', lambda e: exprs[int(e.group(1))], body)
        return m.group(1) + body + m.group(3)
    return re.sub(r'(const css\w* = `)(.*?)(`;)', css, code, flags=re.S)


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
    parts = [minify_css_template(s) if name.startswith('styles') else s for name, s in zip(ORDER, parts)]
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

    # 日本語は UTF-8 で3バイトになるため、文字数とバイト数(=配信サイズ)を両方出す
    print(f'built: webreg.bundle.js {len(bundle.encode())}B ({len(bundle)} chars) / '
          f'loader bookmarklet {len(loader_bm)}B / version {version}')


if __name__ == '__main__':
    main()
