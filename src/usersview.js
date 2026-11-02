// 利用者一覧ビュー: グリッド(列幅/列順/ソート/フィルタ)・選択+一括操作・登録/編集フォーム。
// グリッド操作と選択(チェックボックス)の仕様は Spira のチケット一覧に合わせる:
//   チェックボックス列は 34px 固定・行クリックと分離(stopPropagation)・選択状態は再描画を跨いで保持。
//   一括バーは選択0件でも同じ高さで常設(レイアウトシフト禁止 §1.4)。

// 反映対象と同じ並びの有効な組織区分2(親が有効なもの)を返す
function activeL2Of(state, l1Title) {
  const l1 = state.l1.find((x) => x.Title === l1Title && x.Active !== false);
  if (!l1) return [];
  return state.l2
    .filter((x) => x.Active !== false && x.Level1 && x.Level1.Id === l1.Id)
    .sort((a, b) => ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
}

const USERS_GRID_KEY = 'users';
const selectedUserIds = new Set(); // 再描画を跨いで保持(Spira と同様 module レベル)
const userFilter = { q: '', showDeleted: false }; // 列ごとの絞り込みは gridfilter(Excel風オートフィルター)が担う

// ---- 列定義(key は列幅/列順の保存キー) -------------------------------
const USER_COLS = [
  { key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
  { key: 'company', label: '会社名', w: '140px', val: (u) => u.Company || '' },
  { key: 'email', label: 'メールアドレス', w: '180px', val: (u) => u.Email || '' },
  { key: 'changeType', label: '変更区分', w: '90px', val: (u) => u.ChangeType || '' },
  { key: 'permission', label: '権限', w: '90px', val: (u) => u.Permission || '' },
  { key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },          // label は実行時に LABEL_L1
  { key: 'org2', label: '', w: '220px', val: null },                              // 同 LABEL_L2(計算表示)
  { key: 'listKind', label: '区分', w: '90px', val: null },                       // 国内/海外(振り分けから導出)
  { key: 'status', label: '改廃ステータス', w: '110px', val: (u) => reqStatusOf(u) },
  { key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];

// 利用者が登録される利用者リストの区分(振り分け設定から導出): 国内 / 海外 / 国内・海外
function userRegionLabel(state, u) {
  const a = (state.listAssign && state.listAssign[u.OrgLevel1 || '']) || 'ja';
  return a === 'en' ? '海外' : a === 'both' ? '国内・海外' : '国内';
}
function regionChipHtml(label) {
  const cls = label === '海外' ? 'pr-spchip--upd' : label === '国内・海外' ? 'pr-spchip--add' : 'pr-spchip--gray';
  return '<span class="pr-spchip ' + cls + '">' + esc(label) + '</span>';
}

// 行の組織区分1に紐づく有効な組織区分2だけを ✅(チェック済)/☐(未チェック)で表示。
// 「組織区分2のすべて」フラグが立っている行は全✅として解釈する(集計列と同じ)
function userOrg2Text(state, item) {
  return activeL2Of(state, item.OrgLevel1 || '')
    .map((m) => (item.L2All === true || item['L2_' + m.Id] === true ? '✅' : '☐') + m.Title)
    .join(' / ');
}

function userColLabel(c) {
  if (c.key === 'org1') return LABEL_L1;
  if (c.key === 'org2') return LABEL_L2;
  return c.label;
}

// SPリストと同じ色のチップ HTML(変更区分/権限)。空欄はチップを出さない
function ctChipHtml(v) {
  if (!v) return '';
  const cls = (v === '追加' || v === '新規') ? 'pr-spchip--add'
    : (v === '更新' || v === '変更') ? 'pr-spchip--upd'
      : (v === '削除') ? 'pr-spchip--del' : 'pr-spchip--gray';
  return '<span class="pr-spchip ' + cls + '">' + esc(v) + '</span>';
}
function pmChipHtml(v) {
  if (!v) return '';
  const cls = (v === '更新者') ? 'pr-spchip--upd' : 'pr-spchip--gray';
  return '<span class="pr-spchip ' + cls + '">' + esc(v) + '</span>';
}
// グリッドの表示用セル(変更区分/権限はチップ、それ以外は素のテキスト)
function userCellDisplay(state, c, u) {
  if (c.key === 'changeType') return ctChipHtml(u.ChangeType || '');
  if (c.key === 'permission') return pmChipHtml(u.Permission || '');
  if (c.key === 'listKind') return regionChipHtml(userRegionLabel(state, u));
  return esc(userCellText(state, c, u));
}

function userCellText(state, c, u) {
  if (c.key === 'org2') return userOrg2Text(state, u);
  if (c.key === 'listKind') return userRegionLabel(state, u);
  if (c.key === 'modified') {
    const d = new Date(u.Modified || '');
    if (isNaN(+d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  return c.val(u);
}

// フィルタ+ソート適用後の表示対象
function visibleUsers(state) {
  const f = userFilter;
  const q = f.q.trim().toLowerCase();
  let list = state.users.filter((u) => {
    if (!f.showDeleted && u.SystemDeleted === true) return false;
    if (!gridRowPasses(USERS_GRID_KEY, (k) => userCellText(state, USER_COLS.find((c) => c.key === k), u))) return false;
    if (q) {
      const hay = USER_COLS.map((c) => userCellText(state, c, u)).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const s = gridSort(USERS_GRID_KEY, 'modified');
  const col = USER_COLS.find((c) => c.key === s.by) || USER_COLS[USER_COLS.length - 1];
  const dir = s.dir === 'asc' ? 1 : -1;
  list = [...list].sort((a, b) => {
    const va = userCellText(state, col, a);
    const vb = userCellText(state, col, b);
    return va.localeCompare(vb, 'ja') * dir || (a.Id - b.Id) * dir;
  });
  return list;
}

function usersViewHtml(state) {
  if (!state.usersReady) {
    return `
      <div class="pr-hero">
        <h4>「${esc(LIST_USERS)}」リストがまだありません</h4>
        <p>マスタ管理で組織区分を登録して「リストへ反映」を実行するか、<br>
          CSVインポートから始めると必要なリスト・マスタを自動作成します。</p>
        <div style="display:flex; gap:var(--s-3)">
          <button class="pr-btn pr-btn--primary" data-act="user-import">CSVインポートから始める</button>
          <button class="pr-btn pr-btn--secondary" data-act="nav" data-view="master">マスタ管理を開く</button>
        </div>
      </div>`;
  }
  // 選択状態の整理(存在しない行の選択を破棄)
  const ids = new Set(state.users.map((u) => u.Id));
  for (const id of [...selectedUserIds]) if (!ids.has(id)) selectedUserIds.delete(id);

  const list = visibleUsers(state);
  const sel = selectedUserIds.size;
  const sort = gridSort(USERS_GRID_KEY, 'modified');
  const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
  const cols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);

  // NEW/更新タグは消す(消えるタイミングが分かりにくいため)。論理削除済みの表示だけ残す
  const badgeHtml = (u) => (u.SystemDeleted === true ? '<span class="pr-badge pr-badge--del">削除済</span>' : '');

  const thHtml = cols.map((c) => {
    const active = sort.by === c.key;
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const filtered = gridColFiltered(USERS_GRID_KEY, c.key);
    return '<th class="pr-th-sort' + (active ? ' active' : '') + (filtered ? ' pr-th-filtered' : '') +
      '" data-col="' + c.key + '">' + esc(userColLabel(c)) + arrow +
      '<span class="pr-th-funnel">' + ico('filter') + '</span></th>';
  }).join('');

  const rowHtml = (u) => `
    <tr data-uid="${u.Id}" class="${u.SystemDeleted === true ? 'pr-udel' : ''}">
      <td class="pr-uchk"><input type="checkbox" data-usel="${u.Id}" aria-label="選択" ${selectedUserIds.has(u.Id) ? 'checked' : ''}></td>
      ${cols.map((c) => '<td>' + (c.key === 'name' ? badgeHtml(u) : '') + userCellDisplay(state, c, u) + '</td>').join('')}
    </tr>`;

  return `
    <div class="pr-sub pr-sub--users">
      ${sel
        ? `<b>選択中 ${sel}件</b>
           <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-bulk">一括変更</button>
           <button class="pr-btn pr-btn--sm pr-btn--secondary" data-act="user-resync"
             title="選択した行をSPOに再同期(値の変更がなくても、行のアクセス権を割当グループ＋管理者で付け直す)">${ico('sync')}SPOへ再同期</button>
           <button class="pr-btn pr-btn--sm pr-btn--danger" data-act="user-del-selected">物理削除</button>
           <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-clear-sel">選択解除</button>`
        : `<b>利用者一覧</b><span class="pr-count">${list.length}件${list.length !== state.users.length ? ' / 全' + state.users.length + '件' : ''}</span>`}
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" title="「${esc(LIST_USERS)}」のSPリストを新しいタブで開く">${ico('external')}SPで開く</button>
      ${anyEnAssigned(state) ? '<button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-open-sp" data-en="1" title="「' + esc(LIST_USERS_EN) + '」のSPリストを新しいタブで開く">' + ico('external') + '英語リスト</button>' : ''}
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-export" title="${esc(LABEL_L1)}を選んで現在の登録状況を .xlsx で出力">Excel出力</button>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-import-xlsx" title="Excel出力と同じ形式のファイルから追加・更新・論理削除を取込">Excel取込</button>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-import" title="CSVで現行の登録状況を一括取込">CSVインポート</button>
      <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-add">${ico('plus')}新規登録</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-ufilter-q" placeholder="検索(全列)" value="${esc(userFilter.q)}">
      <span class="pr-note">列名をクリックでその列の値で絞り込み(Excelのオートフィルター)</span>
      <span style="flex:1"></span>
      <label class="pr-check"><input type="checkbox" id="pr-ufilter-del" ${userFilter.showDeleted ? 'checked' : ''}>削除済も表示</label>
    </div>
    <div class="pr-rows">
      <table class="pr-utable" data-grid="users">
        <colgroup>
          <col style="width:34px">
          ${cols.map((c) => '<col style="width:' + gridColWidth(USERS_GRID_KEY, c.key, c.w) + '">').join('')}
        </colgroup>
        <thead><tr>
          <th class="pr-uchk"><input type="checkbox" data-usel-all aria-label="すべて選択" ${list.length && list.every((u) => selectedUserIds.has(u.Id)) ? 'checked' : ''}></th>
          ${thHtml}
        </tr></thead>
        <tbody>${list.map(rowHtml).join('') ||
          '<tr><td colspan="' + (cols.length + 1) + '" class="pr-empty">該当する利用者がありません</td></tr>'}</tbody>
      </table>
    </div>`;
}

// render 後に呼ぶ: グリッド操作・フィルタ・選択・行クリックのイベントを取り付ける。
// ctx: { rerender, onEdit(item) } ※ボタン類(data-act)は main 側の委譲ハンドラが処理
function usersAfterRender(app, state, ctx) {
  const table = app.querySelector('.pr-utable[data-grid="users"]');
  if (!table) return;

  const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
  const orderedCols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);
  attachGrid(table, {
    tableKey: USERS_GRID_KEY,
    colKeys: [null].concat(order), // 先頭はチェックボックス列(操作不可)
    defaults: ['34px'].concat(orderedCols.map((c) => c.w)),
    onReorder: (fromKey, toKey) => {
      if (fromKey && toKey) {
        const cur = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
        cur.splice(cur.indexOf(toKey), 0, cur.splice(cur.indexOf(fromKey), 1)[0]);
        gridWriteOrder(USERS_GRID_KEY, cur);
      }
      ctx.rerender();
    },
  });

  // 検索・列フィルターは tbody と件数バーだけ差し替えてフォーカス/メニューを保つ
  const reflow = () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = usersViewHtml(state);
    table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
    app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
  };

  // 列名クリック=その列の値で絞り込み(Excelオートフィルター)。直前が列順ドラッグ/リサイズなら無視
  table.querySelector('thead').addEventListener('click', (e) => {
    if (table.dataset.dragJustEnded) return;
    if (e.target.closest('[data-usel-all]') || e.target.closest('.pr-col-resize')) return;
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const colKey = th.dataset.col;
    const col = USER_COLS.find((c) => c.key === colKey);
    const base = state.users.filter((u) => userFilter.showDeleted || u.SystemDeleted !== true);
    openGridColMenu({
      tableKey: USERS_GRID_KEY,
      colKey,
      label: userColLabel(col),
      values: base.map((u) => userCellText(state, col, u)),
      anchor: th,
      onSort: (dir) => { gridSetSort(USERS_GRID_KEY, colKey, dir); ctx.rerender(); },
      onChange: () => { reflow(); th.classList.toggle('pr-th-filtered', gridColFiltered(USERS_GRID_KEY, colKey)); },
    });
  });

  app.querySelector('#pr-ufilter-q').addEventListener('input', (e) => {
    userFilter.q = e.target.value;
    reflow();
  });
  app.querySelector('#pr-ufilter-del').addEventListener('change', (e) => {
    userFilter.showDeleted = e.target.checked;
    ctx.rerender();
  });

  // 選択(行クリックと分離)・行クリック=編集
  table.addEventListener('click', (e) => {
    const chkAll = e.target.closest('[data-usel-all]');
    if (chkAll) {
      e.stopPropagation();
      const list = visibleUsers(state);
      const all = list.length && list.every((u) => selectedUserIds.has(u.Id));
      list.forEach((u) => { all ? selectedUserIds.delete(u.Id) : selectedUserIds.add(u.Id); });
      ctx.rerender();
      return;
    }
    const chk = e.target.closest('[data-usel]');
    if (chk) {
      e.stopPropagation();
      const id = +chk.dataset.usel;
      chk.checked ? selectedUserIds.add(id) : selectedUserIds.delete(id);
      ctx.rerender();
      return;
    }
    const tr = e.target.closest('tr[data-uid]');
    if (!tr) return;
    if (window.getSelection && String(window.getSelection())) return; // ドラッグ選択直後は開かない(§12)
    const item = state.users.find((u) => u.Id === +tr.dataset.uid);
    if (item) ctx.onEdit(item);
  });
}
