// 利用者一覧ビュー: 登録済み利用者のテーブル表示と新規登録フォーム。
// 組織区分は「リストへ反映」と同じ規則(有効マスタのみ・親無効の子は除外)で選択肢を作る。
// フォームの第2階層チェック欄は、選択した第1階層に連動して切り替わる。

// 反映対象と同じ並びの有効第2階層(親が有効なもの)を返す
function activeL2Of(state, l1Title) {
  const l1 = state.l1.find((x) => x.Title === l1Title && x.Active !== false);
  if (!l1) return [];
  return state.l2
    .filter((x) => x.Active !== false && x.Level1 && x.Level1.Id === l1.Id)
    .sort((a, b) => ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
}

function usersTableHtml(state) {
  const head = ['利用者名', '会社名', 'メールアドレス', '変更区分', '権限', LABEL_L1, LABEL_L2];
  const l2ById = new Map(state.l2.map((x) => [x.Id, x]));
  const checkedOf = (item) => {
    const names = [];
    for (const [id, m] of l2ById) {
      if (item['L2_' + id] === true) names.push('☑' + m.Title);
    }
    return names.join('/');
  };
  const rows = state.users.map((u) => `
    <tr>
      <td>${esc(u.Title)}</td>
      <td>${esc(u.Company)}</td>
      <td>${esc(u.Email)}</td>
      <td>${esc(u.ChangeType)}</td>
      <td>${esc(u.Permission)}</td>
      <td>${esc(u.OrgLevel1)}</td>
      <td>${esc(checkedOf(u)) || '—'}</td>
    </tr>`).join('');
  return `
    <div class="pr-rows">
      <table class="pr-utable">
        <thead><tr>${head.map((h) => '<th>' + h + '</th>').join('')}</tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="pr-empty">未登録</td></tr>'}</tbody>
      </table>
    </div>`;
}

function usersViewHtml(state) {
  if (!state.usersReady) {
    return `
      <div class="pr-hero">
        <h4>「${esc(LIST_USERS)}」リストがまだありません</h4>
        <p>マスタ管理で組織区分を登録し、「リストへ反映」を実行するとリストが作成されます。</p>
        <button class="pr-btn pr-btn--primary" data-act="nav" data-view="master">マスタ管理を開く</button>
      </div>`;
  }
  return `
    <div class="pr-sub"><b>利用者一覧</b><span class="pr-count">${state.users.length}件</span></div>
    <div class="pr-toolbar">
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--primary" data-act="user-add">${ico('plus')}新規登録</button>
    </div>
    ${usersTableHtml(state)}`;
}

// 登録フォームモーダル。確定時に onSubmit(body) を実行し、成功で結果を resolve、
// キャンセルで null。onSubmit が失敗してもフォームは閉じず入力値を保持する(再試行可能)。
function openUserForm(state, onSubmit) {
  return new Promise((resolve) => {
    const activeL1 = state.l1.filter((x) => x.Active !== false);
    const fieldRow = (label, inner) => `
      <div class="pr-field"><label>${label}</label>${inner}</div>`;
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="利用者の新規登録">
          <h4>利用者の新規登録</h4>
          ${fieldRow('利用者名 <span class="pr-req">*</span>', '<input type="text" class="pr-input" id="uf-name">')}
          ${fieldRow('会社名', '<input type="text" class="pr-input" id="uf-company">')}
          ${fieldRow('メールアドレス', '<input type="text" class="pr-input" id="uf-email">')}
          ${fieldRow('変更区分', `<select class="pr-input" id="uf-changetype">${
            ['新規', '変更', '削除', '変更なし'].map((c) => '<option>' + c + '</option>').join('')}</select>`)}
          ${fieldRow('権限', `<select class="pr-input" id="uf-perm">${
            ['参照者', '更新者'].map((c) => '<option>' + c + '</option>').join('')}</select>`)}
          ${fieldRow(esc(LABEL_L1), `<select class="pr-input" id="uf-l1">${
            activeL1.map((x) => '<option>' + esc(x.Title) + '</option>').join('')}</select>`)}
          <div class="pr-field">
            <div class="pr-field-row">
              <label>${esc(LABEL_L2)}</label>
              <button type="button" class="pr-btn pr-btn--ghost pr-btn--sm" data-ufact="all">すべて</button>
            </div>
            <div class="pr-checks" id="uf-l2"></div>
          </div>
          ${fieldRow('特記事項', '<textarea class="pr-input pr-modal-ta" id="uf-notes" rows="3"></textarea>')}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">登録する</button>
          </div>
        </div>
      </div>`);

    // 第1階層の選択に連動して第2階層チェック欄を切り替える
    const l1Sel = back.querySelector('#uf-l1');
    const l2Box = back.querySelector('#uf-l2');
    const renderL2 = () => {
      const list = activeL2Of(state, l1Sel.value);
      l2Box.innerHTML = list.length
        ? list.map((x) => `
            <label class="pr-check"><input type="checkbox" data-l2="${x.Id}">${esc(x.Title)}</label>`).join('')
        : '<span class="pr-note">この' + LABEL_L1 + 'に有効な' + LABEL_L2 + 'はありません</span>';
    };
    l1Sel.addEventListener('change', renderL2);
    renderL2();

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
      for (const cb of l2Box.querySelectorAll('input[data-l2]')) {
        if (cb.checked) body['L2_' + cb.dataset.l2] = true;
      }
      // 送信中は二重送信を防止。失敗してもフォームは閉じず、入力値を保持して再試行できる
      const okBtn = back.querySelector('[data-mact="ok"]');
      okBtn.disabled = true;
      try {
        const result = await onSubmit(body);
        done(result === undefined ? body : result);
      } catch (e) {
        toast('err', '登録に失敗しました — ' + e.message);
        okBtn.disabled = false;
      }
    };

    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      // すべて選択/解除トグル
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
