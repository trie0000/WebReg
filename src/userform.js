// 利用者の登録/編集フォームと一括変更モーダル

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
    // 変更区分: 既定は空欄(勝手に選ばない)。値がある場合のみその選択肢を選択する
    // 改廃ステータス: SP 側で足した独自の値も選択肢に残す(先頭の「なし」で上書きしないため)
    const curStatus = existing ? reqStatusOf(existing) : WORK_STATUS_DEFAULT;
    const statusOpts = WORK_STATUS.includes(curStatus) ? WORK_STATUS : WORK_STATUS.concat([curStatus]);
    const ctOpts = (opts, cur) => {
      let h = '<option value=""' + (cur ? '' : ' selected') + '>（空欄）</option>';
      opts.forEach((c) => {
        h += '<option' + (cur === c ? ' selected' : '') + '>' + esc(c) + '</option>';
      });
      return h;
    };
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="${isEdit ? '利用者の編集' : '利用者の新規登録'}">
          <h4>${isEdit ? '利用者の編集' : '利用者の新規登録'}</h4>
          ${fieldRow('利用者名 <span class="pr-req">*</span>', '<input type="text" class="pr-input" id="uf-name">')}
          ${fieldRow('会社名', '<input type="text" class="pr-input" id="uf-company">')}
          ${fieldRow('メールアドレス', '<input type="text" class="pr-input" id="uf-email">')}
          ${fieldRow('変更区分', `<select class="pr-input" id="uf-changetype">${ctOpts(state.choices.changeType, existing && existing.ChangeType)}</select>`)}
          ${fieldRow('改廃ステータス', `<select class="pr-input" id="uf-status">${selOpts(statusOpts, curStatus)}</select>
            <span class="pr-note">「${esc(WORK_STATUS_DONE)}」にすると変更区分を空欄にします(改廃依頼一覧から外れます)</span>`)}
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

    // 改廃ステータスを「結果確認済み」にしたら変更区分を空欄にする(改廃依頼一覧と同じ規則。見える形で変える)
    back.querySelector('#uf-status').addEventListener('change', (e) => {
      if (e.target.value === WORK_STATUS_DONE) back.querySelector('#uf-changetype').value = '';
    });

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
        WorkStatus: back.querySelector('#uf-status').value,
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

// 一括変更モーダル。resolve: {ChangeType?, WorkStatus?, Permission?, SystemDeleted?} | null
function openBulkModal(state, count) {
  return new Promise((resolve) => {
    const KEEP = '（変更しない）';
    const BLANK = '（空欄にする）';
    const sel = (id, opts) => `<select class="pr-input" id="${id}">` +
      ['<option>' + KEEP + '</option>'].concat(opts.map((o) => '<option>' + esc(o) + '</option>')).join('') +
      '</select>';
    // 変更区分は「空欄にする」も選べる
    const selCt = `<select class="pr-input" id="bk-ct">` +
      ['<option>' + KEEP + '</option>', '<option>' + BLANK + '</option>']
        .concat(state.choices.changeType.map((o) => '<option>' + esc(o) + '</option>')).join('') + '</select>';
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="一括変更">
          <h4>一括変更 — 選択中 ${count}件</h4>
          <div class="pr-field"><label>変更区分</label>${selCt}</div>
          <div class="pr-field"><label>改廃ステータス</label>${sel('bk-st', WORK_STATUS)}
            <span class="pr-note">「${esc(WORK_STATUS_DONE)}」にすると、変更区分を「変更しない」のままなら空欄にします</span></div>
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
      const st = back.querySelector('#bk-st').value;
      if (ct === BLANK) changes.ChangeType = '';
      else if (ct !== KEEPV) changes.ChangeType = ct;
      if (st !== KEEPV) {
        changes.WorkStatus = st;
        // 改廃依頼一覧と同じ規則: 結果確認済みにしたら変更区分を空欄に(明示指定があればそちらを優先)
        if (st === WORK_STATUS_DONE && ct === KEEPV) changes.ChangeType = '';
      }
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
