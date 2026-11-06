// 利用者の登録/編集/一括変更/削除/SPOへの再同期と、改廃ステータスの変更フロー

// テキスト方式(集計式が上限超過の大規模データ)では、書込時に組織区分2の表示値も付与する
function withOrg2Text(body, baseItem) {
  if (state.org2Mode !== 'text') return body;
  body.OrgLevel2 = userOrg2Text(state, Object.assign({}, baseItem || {}, body));
  return body;
}

// フォームでチェックした組織区分2の列が未反映なら、先にマスタを反映する(冪等)
async function ensureCheckedL2Cols(body) {
  const l2Keys = Object.keys(body).filter((k) => k.startsWith('L2_'));
  if (!l2Keys.length) return;
  const existing = await spGet(lt(LIST_USERS) +
    "/fields?$select=InternalName&$filter=startswith(InternalName,'L2_')");
  const have = new Set((existing.value || []).map((f) => f.InternalName));
  if (l2Keys.some((k) => !have.has(k))) {
    setStatus('マスタ未反映分をリストへ反映中…');
    await syncMastersToUserList(state, setStatus);
  }
}

// フォーム/一括変更で改廃ステータスを書く前に列(と「なし」等の選択肢)を確保する
async function ensureStatusColFor(body) {
  if ('WorkStatus' in body) await ensureWorkStatusColumn();
}

// 一括で書き込んだ行の行レベル権限を付け直す(権限グループ割当があるときだけ。失敗は警告どまり)
async function reapplyPermsForIds(ids) {
  if (!hasAnyPermConfig(state)) return;
  const sel = new Set(ids);
  const targets = state.users.filter((u) => sel.has(u.Id)).map((u) => ({ id: u.Id, l1: u.OrgLevel1 }));
  const ps = await applyPermissionsToItems(state, targets, setStatus);
  if (ps.errors.length) {
    toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg, { sticky: true });
  }
}

async function userAddFlow() {
  const result = await openUserForm(state, async (body) => {
    await ensureCheckedL2Cols(body);
    await ensureStatusColFor(body);
    const j = await addItem(LIST_USERS, withOrg2Text(body));
    // 権限グループ割当があれば、登録した行に行レベル権限を即適用(失敗は警告どまり)
    if (j && j.Id) await applyPermAfterWrite(state, j.Id, body.OrgLevel1);
    return body.Title;
  });
  if (!result) return;
  run('登録', async () => {
    auditNote('利用者「' + result + '」を登録');
    await reload();
    toast('ok', '「' + result + '」を登録しました');
  });
}

async function userEditFlow(item) {
  const result = await openUserForm(state, async (body) => {
    await ensureCheckedL2Cols(body);
    await ensureStatusColFor(body);
    await updateItem(LIST_USERS, item.Id, withOrg2Text(body, item));
    // 組織区分1の変更で参照可能なグループが変わるため、編集後も再適用
    await applyPermAfterWrite(state, item.Id, body.OrgLevel1);
    return body.Title;
  }, item);
  if (!result) return;
  run('保存', async () => {
    auditNote('利用者「' + result + '」を編集');
    await reload();
    toast('ok', '「' + result + '」を保存しました');
  });
}

async function userBulkFlow() {
  const ids = [...selectedUserIds];
  if (!ids.length) return;
  const changes = await openBulkModal(state, ids.length);
  if (!changes) return;
  run('一括変更', async () => {
    auditNote(ids.length + '件を一括変更: ' +
      Object.entries(changes).map(([k, v]) => k + '=' + (v === true ? 'ON' : v === false ? 'OFF' : v)).join(', '));
    await ensureStatusColFor(changes);
    for (const id of ids) await updateItem(LIST_USERS, id, changes);
    await reapplyPermsForIds(ids);
    await reload();
    toast('ok', ids.length + '件を一括変更しました');
  });
}

async function userDeleteFlow() {
  const ids = [...selectedUserIds];
  if (!ids.length) return;
  const okDel = await modal({
    title: '物理削除の確認',
    message: '選択中の ' + ids.length + '件をリストから完全に削除します。この操作は元に戻せません。' +
      '(復元できる削除は「一括変更」のシステム削除=論理削除を使ってください)',
    okLabel: '完全に削除する',
    danger: true,
  });
  if (!okDel) return;
  run('物理削除', async () => {
    auditNote('利用者 ' + ids.length + '件を物理削除');
    for (const id of ids) await deleteItem(LIST_USERS, id);
    selectedUserIds.clear();
    await reload();
    toast('ok', ids.length + '件を削除しました');
  });
}

// 改廃ステータスのインライン変更(1行。結果確認済みなら変更区分も空欄に)
function userStatusChange(id, status) {
  const clearCt = status === WORK_STATUS_DONE;
  const body = clearCt ? { WorkStatus: status, ChangeType: '' } : { WorkStatus: status };
  run('ステータス更新', async () => {
    const u = state.users.find((x) => x.Id === id);
    auditNote((u ? '「' + (u.Title || '') + '」' : '#' + id) + 'の改廃ステータスを「' + status + '」に変更');
    await ensureWorkStatusColumn();
    await updateItem(LIST_USERS, id, body);
    // 編集フォームと同じく、書き込んだ行の行レベル権限も付け直す(失敗は警告どまり)
    if (u) await applyPermAfterWrite(state, id, u.OrgLevel1);
    await reload();
  });
}

// 改廃ステータスの一括変更(選択行へ。列が未作成の既存リストでも動くよう先に確保)
async function reqBulkStatusFlow() {
  const ids = [...selectedReqIds];
  if (!ids.length) return;
  const status = await openReqStatusModal(ids.length);
  if (!status) return;
  // 「結果確認済み」になったら改廃完了とみなし、変更区分を空欄に戻す
  //  (=改廃依頼一覧の対象から外れる)
  const clearCt = status === WORK_STATUS_DONE;
  const body = clearCt ? { WorkStatus: status, ChangeType: '' } : { WorkStatus: status };
  run('ステータス一括変更', async () => {
    auditNote(ids.length + '件の改廃ステータスを「' + status + '」に変更');
    await ensureWorkStatusColumn();
    for (const id of ids) await updateItem(LIST_USERS, id, body);
    await reapplyPermsForIds(ids);
    selectedReqIds.clear();
    await reload();
    toast('ok', ids.length + '件のステータスを「' + status + '」に変更しました' +
      (clearCt ? '(変更区分を空欄にして改廃依頼から除外)' : ''));
  });
}

// 選択した利用者を SPO に再同期する(値の変更がなくても実行できる)。
//   - 利用者一覧の行: アクセス権を「割当グループ=投稿 + 管理者=フル」で付け直す
//     (テキスト方式なら組織区分2の表示値も再計算して書き戻す)
//   - 英語リストの対象行: 対応する英語行を差分転記し、アクセス権を付け直す(対象外になった行は英語側から削除)
async function userResyncFlow() {
  const sel = new Set(selectedUserIds);
  const users = state.users.filter((u) => sel.has(u.Id));
  if (!users.length) return;
  const admins = await loadAdminGroupIds();
  if (!admins.length) {
    toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)。' +
      '未設定のままアクセス権を付け直すと、実行者以外の管理者がアクセスできなくなります');
    return;
  }
  const enTitles = anyEnAssigned(state) ? enTargetsOf(state).titles : new Set();
  const enCount = users.filter((u) => enTitles.has(u.OrgLevel1 || '')).length;
  const ok = await modal({
    title: 'SPOへ再同期 — 選択中 ' + users.length + '件',
    message: '選択した ' + users.length + '件を SPO に再同期します。値の変更がなくても、各行のアクセス権を' +
      'マスタで指定した権限グループ＋管理者グループで付け直します(継承を解除して再付与。未割当の' +
      LABEL_L1 + 'の行は管理者のみ)。' +
      (enCount ? '英語リスト対象の ' + enCount + '件は、英語リストの対応行も更新してアクセス権を付け直します。' : '') +
      'アクセス権の変更は元に戻せません。',
    okLabel: '再同期する',
    danger: true,
  });
  if (!ok) return;
  run('SPOへ再同期', async () => {
    auditNote('利用者 ' + users.length + '件をSPOへ再同期(行アクセス権を再設定' +
      (enCount ? ' / 英語リスト ' + enCount + '件' : '') + ')');
    const errors = [];
    if (state.org2Mode === 'text') {
      for (const u of users) {
        const txt = userOrg2Text(state, u);
        if ((u.OrgLevel2 || '') === txt) continue;
        try { await updateItem(LIST_USERS, u.Id, { OrgLevel2: txt }); } catch (e) { errors.push(e.message); }
      }
    }
    const ps = await applyPermissionsToItems(state, users.map((u) => ({ id: u.Id, l1: u.OrgLevel1 })), setStatus);
    ps.errors.forEach((x) => errors.push(x.msg));
    let enMsg = '';
    if (anyEnAssigned(state)) {
      if (!(await listId(LIST_USERS_EN)) || !(await fieldExists(LIST_USERS_EN, 'SourceId'))) {
        toast('warn', '英語リストが未作成か旧形式のため、英語リストは再同期していません(先に「リストへ反映」を実行してください)', { sticky: true });
      } else {
        const en = await pushEnUsers(state, users, { full: false, forcePerm: true }, setStatus);
        en.errors.forEach((x) => errors.push('英語リスト: ' + x.msg));
        enMsg = ' / 英語リスト ' + en.users + '件(更新 ' + en.written + ' / 削除 ' + en.deleted + ')';
      }
    }
    await reload();
    if (errors.length) {
      toast('err', '再同期に失敗した処理 ' + errors.length + '件 — 最初のエラー: ' + errors[0]);
    } else {
      toast('ok', users.length + '件を再同期しました(アクセス権を ' + (ps.applied + ps.adminOnly) + '件に再設定' + enMsg + ')',
        { sticky: true });
    }
  });
}

// 利用者一覧(または英語リスト)の SP 標準ビューを新しいタブで開く
async function openSpListFlow(en) {
  const listTitle = en ? LIST_USERS_EN : LIST_USERS;
  try {
    if (!(await listId(listTitle))) {
      toast('warn', '「' + listTitle + '」リストはまだありません(海外/両方に振り分けて「リストへ反映」すると作成されます)');
      return;
    }
    const j = await spGet(lt(listTitle) + '?$select=DefaultViewUrl');
    window.open(new URL(j.DefaultViewUrl, getWebUrl()).href, '_blank');
  } catch (e) {
    toast('err', 'SPリストを開けません — ' + e.message);
  }
}
