// グリッド基盤: 列幅変更(右端ハンドル)・列順変更(ヘッダドラッグ)・ソート状態の永続化。
// 操作仕様は Spira のチケット一覧(utils/colResize.ts / ticketList.ts)に合わせる:
//   - 列幅: th 右端の 6px ハンドルをドラッグ。ダブルクリックで自動幅に戻す。localStorage 永続化
//   - 列順: ヘッダをドラッグして移動(右クリックでリセット)。§15.6 の教訓により
//     native draggable ではなく pointer イベント + elementFromPoint で自前実装
//   - ソート: ヘッダクリックで昇順/降順トグル(▲/▼)。呼び出し側がクリックを処理する

const GRID_W = 'permreg.colw.';
const GRID_O = 'permreg.colorder.';
const GRID_S = 'permreg.sort.';

function gridColWidth(tableKey, colKey, fallback) {
  const v = parseInt(localStorage.getItem(GRID_W + tableKey + ':' + colKey) || '', 10);
  return Number.isFinite(v) ? v + 'px' : fallback;
}
function gridWriteWidth(tableKey, colKey, w) {
  localStorage.setItem(GRID_W + tableKey + ':' + colKey, String(w));
}
function gridRemoveWidth(tableKey, colKey) {
  localStorage.removeItem(GRID_W + tableKey + ':' + colKey);
}

// 保存済みの列順を現行の列キー集合に突き合わせて解決(新列はデフォルト位置近くに補完)
function gridResolveOrder(tableKey, defaultKeys) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(GRID_O + tableKey) || 'null');
  } catch { /* ignore */ }
  if (!Array.isArray(saved)) return [...defaultKeys];
  const known = new Set(defaultKeys);
  const ordered = saved.filter((k) => known.has(k));
  for (let i = 0; i < defaultKeys.length; i++) {
    const k = defaultKeys[i];
    if (ordered.includes(k)) continue;
    let insertAt = null;
    for (let j = i - 1; j >= 0; j--) {
      const idx = ordered.indexOf(defaultKeys[j]);
      if (idx >= 0) { insertAt = idx + 1; break; }
    }
    if (insertAt == null) {
      for (let j = i + 1; j < defaultKeys.length; j++) {
        const idx = ordered.indexOf(defaultKeys[j]);
        if (idx >= 0) { insertAt = idx; break; }
      }
    }
    ordered.splice(insertAt == null ? ordered.length : insertAt, 0, k);
  }
  return ordered;
}
function gridWriteOrder(tableKey, keys) {
  localStorage.setItem(GRID_O + tableKey, JSON.stringify(keys));
}
function gridResetOrder(tableKey) {
  localStorage.removeItem(GRID_O + tableKey);
}

function gridSort(tableKey, defaultBy) {
  try {
    const v = JSON.parse(localStorage.getItem(GRID_S + tableKey) || 'null');
    if (v && v.by) return v;
  } catch { /* ignore */ }
  return { by: defaultBy, dir: 'desc' };
}
function gridSetSort(tableKey, by, dir) {
  localStorage.setItem(GRID_S + tableKey, JSON.stringify({ by, dir }));
}

// table(colgroup 必須)に 列幅ハンドル+列順ドラッグを取り付ける。
// opts: { tableKey, colKeys(thごと、nullは操作不可列), onReorder(fromKey,toKey|null=リセット), minWidth }
function attachGrid(table, opts) {
  const cols = [...table.querySelectorAll('colgroup col')];
  const ths = [...table.querySelectorAll('thead th')];
  const minWidth = opts.minWidth || 48;

  ths.forEach((th, i) => {
    const key = opts.colKeys[i];
    if (!key) return;
    th.style.position = 'relative';

    // ---- 列幅ハンドル
    const handle = document.createElement('span');
    handle.className = 'pr-col-resize';
    handle.setAttribute('aria-hidden', 'true');
    th.appendChild(handle);
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const col = cols[i];
      // 兄弟列の幅を固定して、対象列の伸縮で再配分されないようにする
      cols.forEach((c, ci) => {
        if (ci !== i && !c.style.width && ths[ci]) {
          c.style.width = Math.round(ths[ci].getBoundingClientRect().width) + 'px';
        }
      });
      const startW = th.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      handle.classList.add('dragging');
      const onMove = (ev) => {
        const w = Math.max(minWidth, Math.round(startW + ev.clientX - startX));
        if (col) col.style.width = w + 'px';
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
        handle.classList.remove('dragging');
        gridWriteWidth(opts.tableKey, key, Math.round(th.getBoundingClientRect().width));
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    handle.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (cols[i]) cols[i].style.width = '';
      gridRemoveWidth(opts.tableKey, key);
    });

    // ---- 列順ドラッグ(pointer ベース)。6px 動いたらドラッグ、動かなければクリック(=ソート)
    th.title = 'ドラッグで列順変更 / クリックで並び替え / 右クリックで列順リセット';
    th.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target === handle) return;
      const startX = e.clientX;
      let dragging = false;
      const mark = (t) => {
        ths.forEach((h) => { h.style.boxShadow = ''; });
        if (t && t !== th && opts.colKeys[ths.indexOf(t)]) {
          t.style.boxShadow = 'inset 2px 0 0 0 var(--accent)';
        }
      };
      const targetTh = (ev) => {
        const n = document.elementFromPoint(ev.clientX, ev.clientY);
        const t = n && n.closest('th');
        return t && ths.includes(t) ? t : null;
      };
      const onMove = (ev) => {
        if (!dragging && Math.abs(ev.clientX - startX) > 6) {
          dragging = true;
          th.style.opacity = '0.5';
          document.body.style.cursor = 'grabbing';
        }
        if (dragging) mark(targetTh(ev));
      };
      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        mark(null);
        th.style.opacity = '';
        document.body.style.cursor = '';
        if (!dragging) return; // クリック扱い → th の click(ソート)に委ねる
        table.dataset.dragJustEnded = '1';
        setTimeout(() => { delete table.dataset.dragJustEnded; }, 0);
        const t = targetTh(ev);
        const toKey = t && t !== th ? opts.colKeys[ths.indexOf(t)] : null;
        if (toKey) opts.onReorder(key, toKey);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    th.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      gridResetOrder(opts.tableKey);
      opts.onReorder(null, null);
    });
  });
}
