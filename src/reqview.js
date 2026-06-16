// 改廃依頼一覧: 変更区分が「変更なし」以外の行を、実機への登録作業待ちとして一覧する。
// 利用者一覧と同じ表UI(列幅/列順/ソート)。改廃ステータス列(インライン編集)を持ち、
// 「結果確認済み」はチェックボックスで非表示にできる。

const REQS_GRID_KEY = 'reqs';
const reqFilter = { q: '', hideVerified: true };
const selectedReqIds = new Set(); // 改廃依頼の選択(再描画を跨いで保持)

// 改廃依頼の対象: 変更区分が設定済みで「変更なし」でない行(=実機側の作業が必要)
const isReqTarget = (u) => {
  const ct = (u.ChangeType || '').trim();
  return !!ct && ct !== NO_CHANGE;
};
const reqStatusOf = (u) => u.WorkStatus || WORK_STATUS_DEFAULT;

// 列定義(利用者一覧と同じデータ列 + ステータス)。modified は末尾
const REQ_COLS = [
  { key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
  { key: 'company', label: '会社名', w: '130px', val: (u) => u.Company || '' },
  { key: 'email', label: 'メールアドレス', w: '170px', val: (u) => u.Email || '' },
  { key: 'changeType', label: '変更区分', w: '80px', val: (u) => u.ChangeType || '' },
  { key: 'permission', label: '権限', w: '80px', val: (u) => u.Permission || '' },
  { key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },
  { key: 'org2', label: '', w: '200px', val: null },
  { key: 'listKind', label: '区分', w: '90px', val: null },
  { key: 'status', label: '改廃ステータス', w: '130px', val: (u) => reqStatusOf(u) },
  { key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];

const reqColLabel = (c) => (c.key === 'org1' ? LABEL_L1 : c.key === 'org2' ? LABEL_L2 : c.label);
const reqCellText = (state, c, u) =>
  (c.key === 'org2' ? userOrg2Text(state, u)
    : c.key === 'listKind' ? userRegionLabel(state, u)
      : c.key === 'modified' ? userCellText(state, USER_COLS.find((x) => x.key === 'modified'), u)
        : c.val(u));

function visibleReqs(state) {
  const f = reqFilter;
  const q = f.q.trim().toLowerCase();
  let list = state.users.filter((u) => {
    if (!isReqTarget(u)) return false;
    if (f.hideVerified && reqStatusOf(u) === WORK_STATUS_DONE) return false;
    if (!gridRowPasses(REQS_GRID_KEY, (k) => reqCellText(state, REQ_COLS.find((c) => c.key === k), u))) return false;
    if (q) {
      const hay = REQ_COLS.map((c) => reqCellText(state, c, u)).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const s = gridSort(REQS_GRID_KEY, 'modified');
  const col = REQ_COLS.find((c) => c.key === s.by) || REQ_COLS[REQ_COLS.length - 1];
  const dir = s.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) =>
    reqCellText(state, col, a).localeCompare(reqCellText(state, col, b), 'ja') * dir || (a.Id - b.Id) * dir);
}

// ステータスバッジ風の色分け(作業待ち=警告 / 改廃済み=アクセント / 結果確認済み=淡色)
function reqStatusClass(s) {
  if (s === WORK_STATUS_DONE) return 'pr-rst--verified';
  if (s === '改廃済み') return 'pr-rst--done';
  return 'pr-rst--wait';
}

function reqViewHtml(state) {
  if (!state.usersReady) {
    return '<div class="pr-hero"><h4>「' + esc(LIST_USERS) + '」リストがまだありません</h4>' +
      '<p>利用者一覧で登録するとここに改廃依頼が表示されます。</p></div>';
  }
  // 表示外の行の選択は破棄(全件選択判定が正しくなるように)
  const list = visibleReqs(state);
  const listIds = new Set(list.map((u) => u.Id));
  for (const id of [...selectedReqIds]) if (!listIds.has(id)) selectedReqIds.delete(id);

  const order = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
  const cols = order.map((k) => REQ_COLS.find((c) => c.key === k)).filter(Boolean);
  const sort = gridSort(REQS_GRID_KEY, 'modified');
  const total = state.users.filter(isReqTarget).length;
  const sel = selectedReqIds.size;

  const thHtml = cols.map((c) => {
    const active = sort.by === c.key;
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const filtered = gridColFiltered(REQS_GRID_KEY, c.key);
    return '<th class="pr-th-sort' + (active ? ' active' : '') + (filtered ? ' pr-th-filtered' : '') +
      '" data-col="' + c.key + '">' + esc(reqColLabel(c)) + arrow +
      '<span class="pr-th-funnel">' + ico('filter') + '</span></th>';
  }).join('');

  // ステータスは色分けチップ風のインラインselect(その場で直接変更できる)
  const statusCell = (u) => {
    const cur = reqStatusOf(u);
    return '<select class="pr-chipsel ' + reqStatusClass(cur) + '" data-reqstatus="' + u.Id + '">' +
      WORK_STATUS.map((s) => '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
      '</select>';
  };
  const cellHtml = (c, u) => c.key === 'changeType' ? ctChipHtml(u.ChangeType || '')
    : c.key === 'permission' ? pmChipHtml(u.Permission || '')
      : c.key === 'listKind' ? regionChipHtml(userRegionLabel(state, u))
        : esc(reqCellText(state, c, u));
  const rowHtml = (u) => '<tr data-uid="' + u.Id + '" class="' + (u.SystemDeleted === true ? 'pr-udel' : '') + '">' +
    '<td class="pr-uchk"><input type="checkbox" data-rsel="' + u.Id + '" aria-label="選択" ' +
      (selectedReqIds.has(u.Id) ? 'checked' : '') + '></td>' +
    cols.map((c) => c.key === 'status'
      ? '<td>' + statusCell(u) + '</td>'
      : '<td>' + cellHtml(c, u) + '</td>').join('') +
    '</tr>';

  return `
    <div class="pr-sub pr-sub--users">
      ${sel
        ? `<b>選択中 ${sel}件</b>
           <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="req-bulk-status">ステータス一括変更</button>
           <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="req-clear-sel">選択解除</button>`
        : `<b>改廃依頼一覧</b><span class="pr-count">${list.length}件${list.length !== total ? ' / 対象' + total + '件' : ''}</span>
           <span class="pr-note">変更区分が「${esc(NO_CHANGE)}」以外＝実機への登録作業待ち</span>`}
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" title="SPリストを新しいタブで開く">${ico('external')}SPで開く</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-rfilter-q" placeholder="検索(全列)" value="${esc(reqFilter.q)}">
      <span class="pr-note">列名をクリックでその列の値で絞り込み(Excelのオートフィルター)</span>
      <span style="flex:1"></span>
      <label class="pr-check"><input type="checkbox" id="pr-rfilter-verified" ${reqFilter.hideVerified ? 'checked' : ''}>結果確認済みを隠す</label>
    </div>
    <div class="pr-rows">
      <table class="pr-utable" data-grid="reqs">
        <colgroup>
          <col style="width:34px">
          ${cols.map((c) => '<col style="width:' + gridColWidth(REQS_GRID_KEY, c.key, c.w) + '">').join('')}
        </colgroup>
        <thead><tr>
          <th class="pr-uchk"><input type="checkbox" data-rsel-all aria-label="すべて選択" ${list.length && list.every((u) => selectedReqIds.has(u.Id)) ? 'checked' : ''}></th>
          ${thHtml}
        </tr></thead>
        <tbody>${list.map(rowHtml).join('') ||
          '<tr><td colspan="' + (cols.length + 1) + '" class="pr-empty">改廃依頼はありません</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ctx: { rerender, onEdit(item), onStatusChange(id, status) }
function reqAfterRender(app, state, ctx) {
  const table = app.querySelector('.pr-utable[data-grid="reqs"]');
  if (!table) return;
  const order = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
  const orderedCols = order.map((k) => REQ_COLS.find((c) => c.key === k)).filter(Boolean);
  attachGrid(table, {
    tableKey: REQS_GRID_KEY,
    colKeys: [null].concat(order), // 先頭はチェックボックス列(操作不可)
    defaults: ['34px'].concat(orderedCols.map((c) => c.w)),
    onReorder: (fromKey, toKey) => {
      if (fromKey && toKey) {
        const cur = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
        cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
        gridWriteOrder(REQS_GRID_KEY, cur);
      }
      ctx.rerender();
    },
  });

  const reflow = () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = reqViewHtml(state);
    table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
    app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
  };

  // 列名クリック=その列の値で絞り込み(Excelオートフィルター)。直前が列順ドラッグ/リサイズなら無視
  table.querySelector('thead').addEventListener('click', (e) => {
    if (table.dataset.dragJustEnded) return;
    if (e.target.closest('[data-rsel-all]') || e.target.closest('.pr-col-resize')) return;
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const colKey = th.dataset.col;
    const col = REQ_COLS.find((c) => c.key === colKey);
    openGridColMenu({
      tableKey: REQS_GRID_KEY,
      colKey,
      label: reqColLabel(col),
      values: state.users.filter(isReqTarget).map((u) => reqCellText(state, col, u)),
      anchor: th,
      onSort: (dir) => { gridSetSort(REQS_GRID_KEY, colKey, dir); ctx.rerender(); },
      onChange: () => { reflow(); th.classList.toggle('pr-th-filtered', gridColFiltered(REQS_GRID_KEY, colKey)); },
    });
  });

  app.querySelector('#pr-rfilter-q').addEventListener('input', (e) => {
    reqFilter.q = e.target.value;
    reflow();
  });
  app.querySelector('#pr-rfilter-verified').addEventListener('change', (e) => {
    reqFilter.hideVerified = e.target.checked;
    ctx.rerender();
  });

  // ステータスのインライン変更(その場で直接更新)
  table.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-reqstatus]');
    if (sel) ctx.onStatusChange(+sel.dataset.reqstatus, sel.value);
  });

  // 選択(チェックボックス)と行クリック(編集)を分離する
  table.addEventListener('click', (e) => {
    if (e.target.closest('[data-reqstatus]')) return; // ステータス操作は編集/選択を起こさない
    const chkAll = e.target.closest('[data-rsel-all]');
    if (chkAll) {
      e.stopPropagation();
      const list = visibleReqs(state);
      const all = list.length && list.every((u) => selectedReqIds.has(u.Id));
      list.forEach((u) => { all ? selectedReqIds.delete(u.Id) : selectedReqIds.add(u.Id); });
      ctx.rerender();
      return;
    }
    const chk = e.target.closest('[data-rsel]');
    if (chk) {
      e.stopPropagation();
      const id = +chk.dataset.rsel;
      chk.checked ? selectedReqIds.add(id) : selectedReqIds.delete(id);
      ctx.rerender();
      return;
    }
    const tr = e.target.closest('tr[data-uid]');
    if (!tr) return;
    if (window.getSelection && String(window.getSelection())) return;
    const item = state.users.find((u) => u.Id === +tr.dataset.uid);
    if (item) ctx.onEdit(item);
  });
}

// ステータス一括変更モーダル。resolve: status文字列 | null
function openReqStatusModal(count) {
  return new Promise((resolve) => {
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="ステータス一括変更">
          <h4>改廃ステータスの一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更後のステータス</label>
            <select class="pr-input" id="rq-status">${
              WORK_STATUS.map((s) => '<option>' + esc(s) + '</option>').join('')}</select></div>
          <span class="pr-note">「${esc(WORK_STATUS_DONE)}」にすると変更区分を空欄にし、改廃依頼一覧から外します。</span>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">適用する</button>
          </div>
        </div>
      </div>`);
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) done(null);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? done(back.querySelector('#rq-status').value) : done(null));
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done(back.querySelector('#rq-status').value);
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
    back.querySelector('#rq-status').focus();
  });
}
