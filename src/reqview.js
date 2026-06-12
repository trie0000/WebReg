// 改廃依頼一覧: 変更区分が「変更なし」以外の行を、実機への登録作業待ちとして一覧する。
// 利用者一覧と同じ表UI(列幅/列順/ソート)。改廃ステータス列(インライン編集)を持ち、
// 「結果確認済み」はチェックボックスで非表示にできる。

const REQS_GRID_KEY = 'reqs';
const reqFilter = { q: '', hideVerified: true };

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
  { key: 'status', label: '改廃ステータス', w: '130px', val: (u) => reqStatusOf(u) },
  { key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];

const reqColLabel = (c) => (c.key === 'org1' ? LABEL_L1 : c.key === 'org2' ? LABEL_L2 : c.label);
const reqCellText = (state, c, u) =>
  (c.key === 'org2' ? userOrg2Text(state, u)
    : c.key === 'modified' ? userCellText(state, USER_COLS[USER_COLS.length - 1], u)
      : c.val(u));

function visibleReqs(state) {
  const f = reqFilter;
  const q = f.q.trim().toLowerCase();
  let list = state.users.filter((u) => {
    if (!isReqTarget(u)) return false;
    if (f.hideVerified && reqStatusOf(u) === WORK_STATUS_DONE) return false;
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
  const list = visibleReqs(state);
  const order = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
  const cols = order.map((k) => REQ_COLS.find((c) => c.key === k)).filter(Boolean);
  const sort = gridSort(REQS_GRID_KEY, 'modified');
  const total = state.users.filter(isReqTarget).length;

  const thHtml = cols.map((c) => {
    const active = sort.by === c.key;
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return '<th class="pr-th-sort' + (active ? ' active' : '') + '" data-col="' + c.key + '">' +
      esc(reqColLabel(c)) + arrow + '</th>';
  }).join('');

  const statusCell = (u) => {
    const cur = reqStatusOf(u);
    return '<select class="pr-input pr-rst ' + reqStatusClass(cur) + '" data-reqstatus="' + u.Id + '">' +
      WORK_STATUS.map((s) => '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
      '</select>';
  };
  const rowHtml = (u) => '<tr data-uid="' + u.Id + '" class="' + (u.SystemDeleted === true ? 'pr-udel' : '') + '">' +
    cols.map((c) => c.key === 'status'
      ? '<td>' + statusCell(u) + '</td>'
      : '<td>' + esc(reqCellText(state, c, u)) + '</td>').join('') +
    '</tr>';

  return `
    <div class="pr-sub pr-sub--users">
      <b>改廃依頼一覧</b><span class="pr-count">${list.length}件${list.length !== total ? ' / 対象' + total + '件' : ''}</span>
      <span class="pr-note">変更区分が「${esc(NO_CHANGE)}」以外＝実機への登録作業待ち</span>
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" title="SPリストを新しいタブで開く">${ico('external')}SPで開く</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-rfilter-q" placeholder="検索(全列)" value="${esc(reqFilter.q)}">
      <label class="pr-check"><input type="checkbox" id="pr-rfilter-verified" ${reqFilter.hideVerified ? 'checked' : ''}>結果確認済みを隠す</label>
    </div>
    <div class="pr-rows">
      <table class="pr-utable" data-grid="reqs">
        <colgroup>
          ${cols.map((c) => '<col style="width:' + gridColWidth(REQS_GRID_KEY, c.key, c.w) + '">').join('')}
        </colgroup>
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${list.map(rowHtml).join('') ||
          '<tr><td colspan="' + cols.length + '" class="pr-empty">改廃依頼はありません</td></tr>'}</tbody>
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
    colKeys: order,
    defaults: orderedCols.map((c) => c.w),
    onReorder: (fromKey, toKey) => {
      if (fromKey && toKey) {
        const cur = gridResolveOrder(REQS_GRID_KEY, REQ_COLS.map((c) => c.key));
        cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
        gridWriteOrder(REQS_GRID_KEY, cur);
      }
      ctx.rerender();
    },
  });

  table.querySelector('thead').addEventListener('click', (e) => {
    if (table.dataset.dragJustEnded) return;
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const s = gridSort(REQS_GRID_KEY, 'modified');
    gridSetSort(REQS_GRID_KEY, th.dataset.col,
      s.by === th.dataset.col ? (s.dir === 'asc' ? 'desc' : 'asc') : (th.dataset.col === 'modified' ? 'desc' : 'asc'));
    ctx.rerender();
  });

  app.querySelector('#pr-rfilter-q').addEventListener('input', (e) => {
    reqFilter.q = e.target.value;
    const tmp = document.createElement('div');
    tmp.innerHTML = reqViewHtml(state);
    table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
    app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
  });
  app.querySelector('#pr-rfilter-verified').addEventListener('change', (e) => {
    reqFilter.hideVerified = e.target.checked;
    ctx.rerender();
  });

  // ステータスのインライン変更(select)。行クリック(編集)とは分離する
  table.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-reqstatus]');
    if (!sel) return;
    ctx.onStatusChange(+sel.dataset.reqstatus, sel.value);
  });
  table.addEventListener('click', (e) => {
    if (e.target.closest('[data-reqstatus]')) return; // ステータス操作は編集を開かない
    const tr = e.target.closest('tr[data-uid]');
    if (!tr) return;
    if (window.getSelection && String(window.getSelection())) return;
    const item = state.users.find((u) => u.Id === +tr.dataset.uid);
    if (item) ctx.onEdit(item);
  });
}
