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
const userFilter = { q: '', changeType: '', permission: '', org1: '', showDeleted: false };

// ---- 列定義(key は列幅/列順の保存キー) -------------------------------
const USER_COLS = [
  { key: 'name', label: '利用者名', w: '160px', val: (u) => u.Title || '' },
  { key: 'company', label: '会社名', w: '140px', val: (u) => u.Company || '' },
  { key: 'email', label: 'メールアドレス', w: '180px', val: (u) => u.Email || '' },
  { key: 'changeType', label: '変更区分', w: '90px', val: (u) => u.ChangeType || '' },
  { key: 'permission', label: '権限', w: '90px', val: (u) => u.Permission || '' },
  { key: 'org1', label: '', w: '120px', val: (u) => u.OrgLevel1 || '' },          // label は実行時に LABEL_L1
  { key: 'org2', label: '', w: '220px', val: null },                              // 同 LABEL_L2(計算表示)
  { key: 'modified', label: '更新日時', w: '130px', val: (u) => u.Modified || '' },
];

// 行の組織区分1に紐づく有効な組織区分2だけを ☑(チェック済)/☐(未チェック)で表示。
// 「組織区分2のすべて」フラグが立っている行は全☑として解釈する(集計列と同じ)
function userOrg2Text(state, item) {
  return activeL2Of(state, item.OrgLevel1 || '')
    .map((m) => (item.L2All === true || item['L2_' + m.Id] === true ? '☑' : '☐') + m.Title)
    .join(' / ');
}

function userColLabel(c) {
  if (c.key === 'org1') return LABEL_L1;
  if (c.key === 'org2') return LABEL_L2;
  return c.label;
}

function userCellText(state, c, u) {
  if (c.key === 'org2') return userOrg2Text(state, u);
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
    if (f.changeType && u.ChangeType !== f.changeType) return false;
    if (f.permission && u.Permission !== f.permission) return false;
    if (f.org1 && u.OrgLevel1 !== f.org1) return false;
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
  const readAt = notifyReadAt();
  const sel = selectedUserIds.size;
  const sort = gridSort(USERS_GRID_KEY, 'modified');
  const order = gridResolveOrder(USERS_GRID_KEY, USER_COLS.map((c) => c.key));
  const cols = order.map((k) => USER_COLS.find((c) => c.key === k)).filter(Boolean);

  const selOpts = (opts, cur) => '<option value="">すべて</option>' +
    opts.map((o) => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  const org1Opts = state.l1.filter((x) => x.Active !== false).map((x) => x.Title);

  const badgeHtml = (u) => {
    const parts = [];
    const b = userBadge(u, readAt);
    if (b === 'new') parts.push('<span class="pr-badge pr-badge--new">NEW</span>');
    if (b === 'upd') parts.push('<span class="pr-badge pr-badge--upd">更新</span>');
    if (u.SystemDeleted === true) parts.push('<span class="pr-badge pr-badge--del">削除済</span>');
    return parts.join('');
  };

  const thHtml = cols.map((c) => {
    const active = sort.by === c.key;
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return '<th class="pr-th-sort' + (active ? ' active' : '') + '" data-col="' + c.key + '">' +
      esc(userColLabel(c)) + arrow + '</th>';
  }).join('');

  const rowHtml = (u) => `
    <tr data-uid="${u.Id}" class="${u.SystemDeleted === true ? 'pr-udel' : ''}">
      <td class="pr-uchk"><input type="checkbox" data-usel="${u.Id}" aria-label="選択" ${selectedUserIds.has(u.Id) ? 'checked' : ''}></td>
      ${cols.map((c) => '<td>' + (c.key === 'name' ? badgeHtml(u) : '') + esc(userCellText(state, c, u)) + '</td>').join('')}
    </tr>`;

  return `
    <div class="pr-sub pr-sub--users">
      ${sel
        ? `<b>選択中 ${sel}件</b>
           <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-bulk">一括変更</button>
           <button class="pr-btn pr-btn--sm pr-btn--danger" data-act="user-del-selected">物理削除</button>
           <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-clear-sel">選択解除</button>`
        : `<b>利用者一覧</b><span class="pr-count">${list.length}件${list.length !== state.users.length ? ' / 全' + state.users.length + '件' : ''}</span>`}
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--sm pr-btn--ghost" data-act="user-import" title="CSVで現行の登録状況を一括取込">CSVインポート</button>
      <button class="pr-btn pr-btn--sm pr-btn--primary" data-act="user-add">${ico('plus')}新規登録</button>
    </div>
    <div class="pr-toolbar pr-toolbar--users">
      <input type="text" class="pr-input" id="pr-ufilter-q" placeholder="検索(全列)" value="${esc(userFilter.q)}">
      <select class="pr-input pr-fsel" id="pr-ufilter-ct" title="変更区分">${selOpts(state.choices.changeType, userFilter.changeType)}</select>
      <select class="pr-input pr-fsel" id="pr-ufilter-pm" title="権限">${selOpts(state.choices.permission, userFilter.permission)}</select>
      <select class="pr-input pr-fsel" id="pr-ufilter-o1" title="${esc(LABEL_L1)}">${selOpts(org1Opts, userFilter.org1)}</select>
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

  // ソート(ヘッダクリック。直前が列順ドラッグなら無視)
  table.querySelector('thead').addEventListener('click', (e) => {
    if (table.dataset.dragJustEnded) return;
    if (e.target.closest('[data-usel-all]')) return;
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const s = gridSort(USERS_GRID_KEY, 'modified');
    gridSetSort(USERS_GRID_KEY, th.dataset.col,
      s.by === th.dataset.col ? (s.dir === 'asc' ? 'desc' : 'asc') : (th.dataset.col === 'modified' ? 'desc' : 'asc'));
    ctx.rerender();
  });

  // 検索は tbody と件数バーだけ差し替えてフォーカスを保つ
  const reflow = () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = usersViewHtml(state);
    table.querySelector('tbody').replaceWith(tmp.querySelector('tbody'));
    app.querySelector('.pr-sub--users').replaceWith(tmp.querySelector('.pr-sub--users'));
  };
  app.querySelector('#pr-ufilter-q').addEventListener('input', (e) => {
    userFilter.q = e.target.value;
    reflow();
  });
  const bindSel = (id, prop) => {
    app.querySelector(id).addEventListener('change', (e) => {
      userFilter[prop] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      ctx.rerender();
    });
  };
  bindSel('#pr-ufilter-ct', 'changeType');
  bindSel('#pr-ufilter-pm', 'permission');
  bindSel('#pr-ufilter-o1', 'org1');
  bindSel('#pr-ufilter-del', 'showDeleted');

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

// 登録/編集フォームモーダル。existing を渡すと編集モード(プリフィル+システム削除トグル)。
// 確定時に onSubmit(body) を実行し、成功で結果を resolve、キャンセルで null。
// onSubmit が失敗してもフォームは閉じず入力値を保持する(再試行可能)。
function openUserForm(state, onSubmit, existing) {
  return new Promise((resolve) => {
    const isEdit = !!existing;
    const activeL1 = state.l1.filter((x) => x.Active !== false);
    const fieldRow = (label, inner) => `
      <div class="pr-field"><label>${label}</label>${inner}</div>`;
    const selOpts = (opts, cur) => opts.map((c) =>
      '<option' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="${isEdit ? '利用者の編集' : '利用者の新規登録'}">
          <h4>${isEdit ? '利用者の編集' : '利用者の新規登録'}</h4>
          ${fieldRow('利用者名 <span class="pr-req">*</span>', '<input type="text" class="pr-input" id="uf-name">')}
          ${fieldRow('会社名', '<input type="text" class="pr-input" id="uf-company">')}
          ${fieldRow('メールアドレス', '<input type="text" class="pr-input" id="uf-email">')}
          ${fieldRow('変更区分', `<select class="pr-input" id="uf-changetype">${selOpts(state.choices.changeType, existing && existing.ChangeType)}</select>`)}
          ${fieldRow('権限', `<select class="pr-input" id="uf-perm">${selOpts(state.choices.permission, existing && existing.Permission)}</select>`)}
          ${fieldRow(esc(LABEL_L1), `<select class="pr-input" id="uf-l1">${
            activeL1.map((x) => '<option' + (existing && existing.OrgLevel1 === x.Title ? ' selected' : '') + '>' + esc(x.Title) + '</option>').join('')}</select>`)}
          <div class="pr-field">
            <div class="pr-field-row">
              <label>${esc(LABEL_L2)}</label>
              <button type="button" class="pr-btn pr-btn--ghost pr-btn--sm" data-ufact="all">すべて</button>
            </div>
            <label class="pr-check"><input type="checkbox" id="uf-l2all" ${existing && existing.L2All === true ? 'checked' : ''}>
              ${esc(LABEL_L2)}のすべて(チェックすると全${esc(LABEL_L2)}を選択した扱いになります)</label>
            <div class="pr-checks" id="uf-l2"></div>
          </div>
          ${fieldRow('特記事項', '<textarea class="pr-input pr-modal-ta" id="uf-notes" rows="3"></textarea>')}
          ${isEdit ? `
          <label class="pr-check"><input type="checkbox" id="uf-sysdel" ${existing.SystemDeleted === true ? 'checked' : ''}>
            システム削除(論理削除)</label>` : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">${isEdit ? '保存' : '登録する'}</button>
          </div>
        </div>
      </div>`);

    if (existing) {
      back.querySelector('#uf-name').value = existing.Title || '';
      back.querySelector('#uf-company').value = existing.Company || '';
      back.querySelector('#uf-email').value = existing.Email || '';
      back.querySelector('#uf-notes').value = existing.Notes || '';
    }

    // 組織区分1の選択に連動して組織区分2チェック欄を切り替える
    const l1Sel = back.querySelector('#uf-l1');
    const l2Box = back.querySelector('#uf-l2');
    const renderL2 = () => {
      const list = activeL2Of(state, l1Sel.value);
      l2Box.innerHTML = list.length
        ? list.map((x) => `
            <label class="pr-check"><input type="checkbox" data-l2="${x.Id}"${
              existing && existing['L2_' + x.Id] === true ? ' checked' : ''}>${esc(x.Title)}</label>`).join('')
        : '<span class="pr-note">この' + LABEL_L1 + 'に有効な' + LABEL_L2 + 'はありません</span>';
    };
    l1Sel.addEventListener('change', renderL2);
    renderL2();

    // 「すべて」チェック中は個別チェック欄と全選択ボタンを隠す(SP標準フォームと同じ挙動)
    const l2AllChk = back.querySelector('#uf-l2all');
    const applyL2All = () => {
      const on = l2AllChk.checked;
      l2Box.style.display = on ? 'none' : '';
      back.querySelector('[data-ufact="all"]').style.display = on ? 'none' : '';
    };
    l2AllChk.addEventListener('change', applyL2All);
    applyL2All();

    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const ok = async () => {
      const name = back.querySelector('#uf-name').value.trim();
      if (!name) {
        toast('warn', '利用者名は必須です');
        back.querySelector('#uf-name').focus();
        return;
      }
      const body = {
        Title: name,
        Company: back.querySelector('#uf-company').value.trim(),
        Email: back.querySelector('#uf-email').value.trim(),
        ChangeType: back.querySelector('#uf-changetype').value,
        Permission: back.querySelector('#uf-perm').value,
        OrgLevel1: l1Sel.value || '',
        Notes: back.querySelector('#uf-notes').value.trim(),
      };
      body.L2All = l2AllChk.checked;
      if (!l2AllChk.checked) {
        for (const cb of l2Box.querySelectorAll('input[data-l2]')) {
          if (cb.checked) body['L2_' + cb.dataset.l2] = true;
        }
      }
      if (isEdit) {
        // 「すべて」オフのとき: 以前 true だったチェックが外れた/別の組織区分1に移った場合は
        // 明示的に false でクリア(「すべて」オン時は個別フラグに触らない)
        if (!l2AllChk.checked) {
          for (const k of Object.keys(existing)) {
            if (k.startsWith('L2_') && existing[k] === true && !(k in body)) body[k] = false;
          }
        }
        body.SystemDeleted = back.querySelector('#uf-sysdel').checked;
      }
      // 送信中は二重送信を防止。失敗してもフォームは閉じず、入力値を保持して再試行できる
      const okBtn = back.querySelector('[data-mact="ok"]');
      okBtn.disabled = true;
      try {
        const result = await onSubmit(body);
        done(result === undefined ? body : result);
      } catch (e) {
        toast('err', (isEdit ? '保存' : '登録') + 'に失敗しました — ' + e.message);
        okBtn.disabled = false;
      }
    };

    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      const allBtn = e.target.closest('[data-ufact="all"]');
      if (allBtn) {
        const cbs = [...l2Box.querySelectorAll('input[data-l2]')];
        const allChecked = cbs.length > 0 && cbs.every((c) => c.checked);
        cbs.forEach((c) => { c.checked = !allChecked; });
        return;
      }
      if (e.target === back) {
        if (downOnBack) done(null);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? ok() : done(null));
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return; // IME 変換確定の Enter を無視
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok();
    };
    document.addEventListener('keydown', onKey, true);

    document.getElementById(ROOT_ID).appendChild(back);
    back.querySelector('#uf-name').focus();
  });
}

// 一括変更モーダル。resolve: {ChangeType?, Permission?, SystemDeleted?} | null
function openBulkModal(state, count) {
  return new Promise((resolve) => {
    const KEEP = '（変更しない）';
    const sel = (id, opts) => `<select class="pr-input" id="${id}">` +
      ['<option>' + KEEP + '</option>'].concat(opts.map((o) => '<option>' + esc(o) + '</option>')).join('') +
      '</select>';
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="一括変更">
          <h4>一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更区分</label>${sel('bk-ct', state.choices.changeType)}</div>
          <div class="pr-field"><label>権限</label>${sel('bk-pm', state.choices.permission)}</div>
          <div class="pr-field"><label>システム削除(論理削除)</label>${sel('bk-del', ['削除する', '解除する'])}</div>
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
    const ok = () => {
      const changes = {};
      const KEEPV = KEEP;
      const ct = back.querySelector('#bk-ct').value;
      const pm = back.querySelector('#bk-pm').value;
      const dl = back.querySelector('#bk-del').value;
      if (ct !== KEEPV) changes.ChangeType = ct;
      if (pm !== KEEPV) changes.Permission = pm;
      if (dl !== KEEPV) changes.SystemDeleted = dl === '削除する';
      if (!Object.keys(changes).length) {
        toast('warn', '変更する項目がありません');
        return;
      }
      done(changes);
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) done(null);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? ok() : done(null));
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok();
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
    back.querySelector('#bk-ct').focus();
  });
}
