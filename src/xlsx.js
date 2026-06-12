// 最小限の .xlsx 読み書き(外部 OSS なし・開発基準準拠)。
// xlsx は ZIP + OOXML。書き出しは無圧縮(stored) ZIP + inlineStr セルで生成し、
// 読み込みは Excel が再保存した deflate 圧縮もブラウザ標準の
// DecompressionStream('deflate-raw') で展開する。

// ---- 共通 ---------------------------------------------------------------

const XLSX_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function xlsxCrc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = XLSX_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const xlsxXmlEsc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // XML 不正な制御文字は除去

// 0始まりの列番号 → A, B, ..., AA
function xlsxColName(i) {
  let s = '';
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = (i - 1 - m) / 26;
  }
  return s;
}

// ---- 書き出し -----------------------------------------------------------

// 固定スタイル(styles.xml に焼き込み)。セルを {v: 値, s: XST_*} で渡すと適用される
const XST_BORDER = 1; // 罫線のみ
const XST_LABEL = 2;  // 項目列(薄い色 + 太字 + 罫線)
const XST_HEAD = 3;   // 見出し(アクセント色 + 白太字 + 中央 + 罫線)
const XST_CENTER = 4; // 罫線 + 中央揃え(チェック欄)

const XLSX_STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3">' +
  '<font><sz val="11"/><name val="Yu Gothic"/></font>' +
  '<font><b/><sz val="11"/><name val="Yu Gothic"/></font>' +
  '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Yu Gothic"/></font>' +
  '</fonts>' +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF7A8A78"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEDF0EA"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border>' +
  '<left style="thin"><color rgb="FF9AA096"/></left>' +
  '<right style="thin"><color rgb="FF9AA096"/></right>' +
  '<top style="thin"><color rgb="FF9AA096"/></top>' +
  '<bottom style="thin"><color rgb="FF9AA096"/></bottom>' +
  '<diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"' +
  ' applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"' +
  ' applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="標準" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// sheets: [{name, rows, colWidths?, freeze?, validations?}] → xlsx の Blob。
//   rows のセル: 文字列/数値、または {v: 値, s: XST_*}(空値でもスタイルがあれば罫線が付く)
//   colWidths: 列幅の配列(文字数単位) / freeze: 'B3' のように固定開始セル
//   validations: [{sqref: 'B5:H5', list: ['a','b']}] — ドロップダウン入力規則
function xlsxBuild(sheets) {
  const enc = new TextEncoder();
  const sheetXml = (sh) => {
    const rows = sh.rows;
    const rowsXml = rows.map((cells, ri) => {
      const cellsXml = cells.map((raw, ci) => {
        const isObj = raw != null && typeof raw === 'object';
        const v = isObj ? raw.v : raw;
        const st = isObj && raw.s ? ' s="' + raw.s + '"' : '';
        const ref = xlsxColName(ci) + (ri + 1);
        if (typeof v === 'number' && isFinite(v)) {
          return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
        }
        const s = String(v == null ? '' : v);
        if (s === '') return st ? '<c r="' + ref + '"' + st + '/>' : '';
        return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xlsxXmlEsc(s) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '">' + cellsXml + '</row>';
    }).join('');
    let views = '';
    if (sh.freeze) {
      const x = xlsxColIndex(sh.freeze);
      const y = parseInt(sh.freeze.replace(/^[A-Z]+/, ''), 10) - 1;
      views = '<sheetViews><sheetView workbookViewId="0">' +
        '<pane xSplit="' + x + '" ySplit="' + y + '" topLeftCell="' + sh.freeze +
        '" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>';
    }
    const cols = (sh.colWidths && sh.colWidths.length)
      ? '<cols>' + sh.colWidths.map((w, i) => w
        ? '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>' : '')
        .join('') + '</cols>'
      : '';
    const vals = (sh.validations && sh.validations.length)
      ? '<dataValidations count="' + sh.validations.length + '">' +
        sh.validations.map((dv) => '<dataValidation type="list" allowBlank="1" showInputMessage="1"' +
          ' showErrorMessage="1" sqref="' + dv.sqref + '"><formula1>' +
          xlsxXmlEsc('"' + dv.list.join(',') + '"') + '</formula1></dataValidation>').join('') +
        '</dataValidations>'
      : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      views + cols + '<sheetData>' + rowsXml + '</sheetData>' + vals + '</worksheet>';
  };

  const files = [];
  files.push(['[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>']);
  files.push(['_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>']);
  files.push(['xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((sh, i) => '<sheet name="' + xlsxXmlEsc(sh.name) + '" sheetId="' + (i + 1) +
      '" r:id="rId' + (i + 1) + '"/>').join('') +
    '</sheets></workbook>']);
  files.push(['xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>']);
  files.push(['xl/styles.xml', XLSX_STYLES_XML]);
  sheets.forEach((sh, i) => files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sh)]));

  // 無圧縮 ZIP を手組みする(ローカルヘッダ + セントラルディレクトリ)
  const parts = [];
  const central = [];
  let offset = 0;
  const num16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const num32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  for (const [name, xml] of files) {
    const nameB = enc.encode(name);
    const data = enc.encode(xml);
    const crc = xlsxCrc32(data);
    const head = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...num16(20), ...num16(0x0800), ...num16(0), ...num16(0), ...num16(0),
      ...num32(crc), ...num32(data.length), ...num32(data.length), ...num16(nameB.length), ...num16(0),
    ]);
    central.push(new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...num16(20), ...num16(20), ...num16(0x0800), ...num16(0), ...num16(0), ...num16(0),
      ...num32(crc), ...num32(data.length), ...num32(data.length), ...num16(nameB.length), ...num16(0), ...num16(0),
      ...num16(0), ...num16(0), ...num32(0), ...num32(offset),
    ]), nameB);
    parts.push(head, nameB, data);
    offset += head.length + nameB.length + data.length;
  }
  const centralStart = offset;
  let centralLen = 0;
  for (const c of central) { parts.push(c); centralLen += c.length; }
  parts.push(new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...num16(0), ...num16(0), ...num16(files.length), ...num16(files.length),
    ...num32(centralLen), ...num32(centralStart), ...num16(0),
  ]));
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- 読み込み -----------------------------------------------------------

async function xlsxUnzip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  // End of Central Directory (PK\5\6) を末尾から探す
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4B && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('xlsx(ZIP)形式ではありません');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('ZIP セントラルディレクトリが壊れています');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    // ローカルヘッダ側の可変長を読んでデータ位置を出す
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lNameLen + lExtraLen;
    const raw = u8.subarray(start, start + csize);
    let data;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('このブラウザは圧縮された xlsx の展開に対応していません(DecompressionStream 非対応)');
      }
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([raw]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error('未対応の ZIP 圧縮方式: ' + method);
    }
    out.set(name, data);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

const xlsxParseXml = (bytes) => {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('xlsx 内の XML を解析できません');
  return doc;
};

// セル参照 "BC12" → 0始まり列番号
function xlsxColIndex(ref) {
  let c = 0;
  for (const ch of ref) {
    if (ch < 'A' || ch > 'Z') break;
    c = c * 26 + (ch.charCodeAt(0) - 64);
  }
  return c - 1;
}

// xlsx の ArrayBuffer → [{name, rows: [[文字列, ...], ...]}]
// すべて文字列化して返す(数値セルもそのまま String)。日付シリアル値は変換しない
async function xlsxParse(buf) {
  const files = await xlsxUnzip(buf);
  if (!files.has('xl/workbook.xml')) throw new Error('xlsx ではありません(workbook.xml 無し)');
  const wb = xlsxParseXml(files.get('xl/workbook.xml'));
  const rels = files.has('xl/_rels/workbook.xml.rels')
    ? xlsxParseXml(files.get('xl/_rels/workbook.xml.rels')) : null;
  const relMap = new Map();
  if (rels) {
    for (const r of rels.getElementsByTagName('*')) {
      if (r.localName === 'Relationship') {
        relMap.set(r.getAttribute('Id'), r.getAttribute('Target').replace(/^\//, ''));
      }
    }
  }
  // 文字列要素の <t> を連結する。⚠ Excel が IME 入力セルに保存する「ふりがな」
  // (<rPh> のカタカナ)を含めると本文の後ろに勝手に付いてしまうため除外する
  const textOf = (node) => {
    let s = '';
    for (const ch of node.children) {
      if (ch.localName === 'rPh' || ch.localName === 'phoneticPr') continue;
      if (ch.localName === 't') s += ch.textContent;
      else s += textOf(ch);
    }
    return s;
  };
  // 共有文字列(Excel が再保存すると文字列はこちらに移る)
  const shared = [];
  if (files.has('xl/sharedStrings.xml')) {
    const ss = xlsxParseXml(files.get('xl/sharedStrings.xml'));
    for (const si of ss.getElementsByTagName('*')) {
      if (si.localName === 'si' && si.parentElement && si.parentElement.localName === 'sst') {
        shared.push(textOf(si));
      }
    }
  }

  const sheets = [];
  let idx = 0;
  for (const el of wb.getElementsByTagName('*')) {
    if (el.localName !== 'sheet') continue;
    idx++;
    const rid = el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = (rid && relMap.get(rid)) || ('worksheets/sheet' + idx + '.xml');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    if (!files.has(target)) continue;
    const doc = xlsxParseXml(files.get(target));
    const rows = [];
    for (const rowEl of doc.getElementsByTagName('*')) {
      if (rowEl.localName !== 'row') continue;
      const ri = (parseInt(rowEl.getAttribute('r'), 10) || (rows.length + 1)) - 1;
      const row = [];
      let autoCol = 0;
      for (const c of rowEl.children) {
        if (c.localName !== 'c') continue;
        const ref = c.getAttribute('r');
        const ci = ref ? xlsxColIndex(ref) : autoCol;
        autoCol = ci + 1;
        const t = c.getAttribute('t') || '';
        let v = '';
        if (t === 'inlineStr') {
          for (const isEl of c.children) if (isEl.localName === 'is') v += textOf(isEl);
        } else {
          let vEl = null;
          for (const ch of c.children) if (ch.localName === 'v') vEl = ch;
          const raw = vEl ? vEl.textContent : '';
          if (t === 's') v = shared[parseInt(raw, 10)] || '';
          else if (t === 'b') v = raw === '1' ? '1' : '0';
          else v = raw; // n / str / e はそのまま
        }
        row[ci] = v;
      }
      for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = '';
      rows[ri] = row;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name: el.getAttribute('name') || ('Sheet' + idx), rows });
  }
  return sheets;
}
