// 列ヘッダの Excel 風オートフィルター(QAM 準拠)。列名クリックでその列の値一覧をリスト表示し、
// チェックを外した値を非表示にする(除外値方式: チェック=表示 / 外す=非表示)。検索・(すべて選択)・
// 昇順/降順の並べ替えを同じポップアップから操作する。状態は列単位で localStorage に保持する。

const GRID_F = 'webreg.filter.';
const FILTER_BLANK = '(空白)'; // 空文字の値はこの表記で表示する(除外配列には '' で格納)
const FILTER_CAP = 2000;       // 値が多すぎる列は先頭 N 件のみ列挙する

function gridFilters(tableKey) {
  try { return JSON.parse(localStorage.getItem(GRID_F + tableKey) || '{}') || {}; } catch (e) { return {}; }
}
function gridColExcluded(tableKey, colKey) {
  return gridFilters(tableKey)[colKey] || [];
}
function gridSetExcluded(tableKey, colKey, excluded) {
  const all = gridFilters(tableKey);
  if (excluded && excluded.length) all[colKey] = excluded; else delete all[colKey];
  try { localStorage.setItem(GRID_F + tableKey, JSON.stringify(all)); } catch (e) { /* 容量超過等は無視 */ }
}
function gridColFiltered(tableKey, colKey) {
  return gridColExcluded(tableKey, colKey).length > 0;
}
// 全フィルタ列を通過するか。valueOf(colKey) はその行の当該列の表示テキストを返す関数
function gridRowPasses(tableKey, valueOf) {
  const all = gridFilters(tableKey);
  for (const colKey in all) {
    const ex = all[colKey];
    if (!ex || !ex.length) continue;
    if (ex.indexOf(valueOf(colKey)) !== -1) return false;
  }
  return true;
}

let _colMenu = null; // 現在開いているポップアップ(同時に1つ)

function closeGridColMenu() {
  if (_colMenu) {
    document.removeEventListener('mousedown', _colMenu._onDoc, true);
    document.removeEventListener('keydown', _colMenu._onKey, true);
    window.removeEventListener('resize', _colMenu._onWin, true);
    _colMenu.remove();
    _colMenu = null;
  }
}

// 列メニューを開く。
// opts: {
//   tableKey, colKey, label,
//   values: その列の全行の表示値(文字列配列。重複可),
//   anchor: 基準にする th 要素,
//   onSort: (dir:'asc'|'desc') => void  (省略可。並べ替えボタンを出すか),
//   onChange: () => void                (除外値が変わるたびに呼ぶ。部分再描画を想定),
// }
function openGridColMenu(opts) {
  closeGridColMenu();
  const distinct = Array.from(new Set(opts.values))
    .sort((a, b) => String(a).localeCompare(String(b), 'ja'));
  const capped = distinct.slice(0, FILTER_CAP);
  const ex = new Set(gridColExcluded(opts.tableKey, opts.colKey)); // 除外中の値

  const disp = (v) => (v === '' ? FILTER_BLANK : v);
  let html = '';
  if (opts.onSort) {
    html += '<button class="pr-colmenu-item pr-colmenu-act" data-cm="asc">' +
      ico('chevron-up') + '<span>昇順で並べ替え</span></button>';
    html += '<button class="pr-colmenu-item pr-colmenu-act" data-cm="desc">' +
      ico('chevron-down') + '<span>降順で並べ替え</span></button>';
    html += '<div class="pr-colmenu-sep"></div>';
  }
  html += '<div class="pr-colmenu-head">' + esc(opts.label) + ' の値で絞り込み</div>';
  html += '<input class="pr-colmenu-search" type="text" placeholder="値を検索">';
  html += '<label class="pr-colmenu-item pr-colmenu-all"><input type="checkbox"><span>(すべて選択)</span></label>';
  html += '<div class="pr-colmenu-vlist"></div>';
  if (distinct.length > capped.length) {
    html += '<div class="pr-colmenu-note">値が多いため先頭 ' + capped.length + ' 件のみ</div>';
  }
  html += '<div class="pr-colmenu-foot">' +
    '<button class="pr-btn pr-btn--sm pr-btn--ghost" data-cm="clear">フィルタ解除</button>' +
    '<span style="flex:1"></span>' +
    '<button class="pr-btn pr-btn--sm pr-btn--primary" data-cm="close">閉じる</button></div>';

  const menu = el('<div class="pr-colmenu" role="dialog" aria-label="列フィルター"></div>');
  menu.innerHTML = html;
  const vlist = menu.querySelector('.pr-colmenu-vlist');
  const search = menu.querySelector('.pr-colmenu-search');
  const allCb = menu.querySelector('.pr-colmenu-all input');

  const apply = () => {
    gridSetExcluded(opts.tableKey, opts.colKey, [...ex]);
    opts.onChange();
  };

  // 検索語に一致する値だけを列挙して描画する
  const renderList = (query) => {
    const ql = (query || '').trim().toLowerCase();
    const shown = capped.filter((v) => !ql || disp(v).toLowerCase().indexOf(ql) !== -1);
    vlist.innerHTML = shown.map((v) =>
      '<label class="pr-colmenu-item"><input type="checkbox" data-v="' + esc(v) + '"' +
      (ex.has(v) ? '' : ' checked') + '><span>' + esc(disp(v)) + '</span></label>').join('') ||
      '<div class="pr-colmenu-note">該当する値がありません</div>';
    const checked = shown.filter((v) => !ex.has(v)).length;
    allCb.checked = shown.length > 0 && checked === shown.length;
    allCb.indeterminate = checked > 0 && checked < shown.length;
    menu._shown = shown;
  };
  renderList('');

  vlist.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-v]');
    if (!cb) return;
    const v = cb.dataset.v;
    if (cb.checked) ex.delete(v); else ex.add(v);
    apply();
    renderList(search.value);
  });
  allCb.addEventListener('change', () => {
    const shown = menu._shown || [];
    if (allCb.checked) shown.forEach((v) => ex.delete(v));
    else shown.forEach((v) => ex.add(v));
    apply();
    renderList(search.value);
  });
  search.addEventListener('input', () => renderList(search.value));

  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cm]');
    if (!b) return;
    const cm = b.dataset.cm;
    if (cm === 'asc' || cm === 'desc') { closeGridColMenu(); opts.onSort(cm); return; }
    if (cm === 'clear') { ex.clear(); apply(); renderList(search.value); return; }
    if (cm === 'close') closeGridColMenu();
  });

  document.getElementById(ROOT_ID).appendChild(menu);
  _colMenu = menu;

  // 位置決め: th の左下に出す。画面外にはみ出さないよう寄せる
  const place = () => {
    const r = opts.anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = r.left, top = r.bottom + 2;
    if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 2);
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
  };
  place();

  menu._onDoc = (e) => { if (!menu.contains(e.target) && !opts.anchor.contains(e.target)) closeGridColMenu(); };
  menu._onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeGridColMenu(); } };
  menu._onWin = () => closeGridColMenu();
  document.addEventListener('mousedown', menu._onDoc, true);
  document.addEventListener('keydown', menu._onKey, true);
  window.addEventListener('resize', menu._onWin, true);
  search.focus();
}
