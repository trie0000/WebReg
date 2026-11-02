// マスタ管理画面の操作: リストへ反映 / アクセス権の再設定 / 未反映の破棄 / マスタの追加・まとめて追加 /
// 行操作(権限割当・名称変更・削除・並べ替え)。main のクリック委譲から呼ばれる

function setupFlow() {
  run('セットアップ', async () => {
    await setup(setStatus);
    await reload();
    toast('ok', 'マスタリストを作成しました');
  });
}

// 「リストへ反映」: マスタ → 利用者一覧の列構成。権限割当があれば変わった行だけ行権限も適用し、
// 海外/両方に振り分けた組織区分1があれば英語版リストも生成・差分転記する
async function masterSyncFlow() {
  const activeL1 = state.l1.filter((x) => x.Active !== false);
  const activeL1Ids = new Set(activeL1.map((x) => x.Id));
  const activeL2 = state.l2.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id));
  if (!activeL1.length) {
    toast('warn', '有効な' + LABEL_L1 + 'がありません。先にマスタを登録してください');
    return;
  }
  const permsConfigured = hasAnyPermConfig(state);
  const admins = await loadAdminGroupIds();
  if (permsConfigured && !admins.length) {
    toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)。' +
      '権限グループ割当があるため、未設定だと実行者以外の管理者がアクセスできなくなります');
    return;
  }
  const ok = await modal({
    title: 'リストへ反映',
    message: '「' + LIST_USERS + '」リスト(無ければ作成)に反映します: ' +
      LABEL_L1 + ' ' + activeL1.length + '件を選択肢に、' + LABEL_L2 + ' ' + activeL2.length +
      '件をチェック列+✅集計表示に。マスタで無効/削除した分の列は消えません(データ保全)。' +
      (permsConfigured ? ' あわせて、権限設定が変わった' + LABEL_L1 + 'の行にアクセス権を適用します' +
        '(管理者グループ ' + admins.length + '件=フル / 割当グループ=投稿。未割当の' +
        LABEL_L1 + 'の行は管理者のみ。変更がなければ再適用しません)。' : ''),
    okLabel: '反映する',
  });
  if (!ok) return;
  const prevFp = state.syncFp; // 反映前のスナップショット(権限の差分適用に使う)
  run('リストへ反映', async () => {
    auditNote('マスタを利用者一覧へ反映(' + LABEL_L1 + ' ' + activeL1.length + '件 / ' +
      LABEL_L2 + ' ' + activeL2.length + '件' + (permsConfigured ? ' / 行アクセス権も適用' : '') + ')');
    const s = await syncMastersToUserList(state, setStatus);
    await saveSyncFp('master', computeMasterSnap(state));
    // 権限グループ割当があれば、行レベル権限もここで適用する(ボタンを分けない)。
    // 全件ではなく、前回反映から権限設定が変わった行だけに反映する
    let permMsg = '';
    if (permsConfigured) {
      const ps = await applyPermissionsChanged(state, prevFp, admins, setStatus);
      if (ps.errors.length) {
        toast('err', '権限設定に失敗した行 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
      } else {
        await saveSyncFp('perms', computePermsSnap(state, admins));
        await saveSyncFp('permsVer', PERM_APPLY_VER); // 個別権限を残さない方式で適用済みと記録
        permMsg = ps.skipped ? ' / 権限は変更なし(再適用なし)'
          : ' / 行のアクセス権を ' + (ps.applied + ps.adminOnly) + '件に適用';
      }
    } else {
      await saveSyncFp('perms', computePermsSnap(state, admins));
      await saveSyncFp('permsVer', PERM_APPLY_VER);
    }
    // 海外/両方に振り分けた組織区分1があれば、英語版利用者リストも生成・反映する
    let enMsg = '';
    if (anyEnAssigned(state)) {
      const en = await syncEnglishUserList(state, setStatus, { fp: prevFp, adminIds: admins });
      if (en.built) {
        enMsg = ' / 英語リスト ' + en.users + '件(更新 ' + en.written + ' / 削除 ' + en.deleted +
          (en.permApplied ? ' / 権限適用 ' + en.permApplied : '') + ')';
      }
      if (en.formulaWarn) toast('warn', '英語リストの集計式: ' + en.formulaWarn);
      if (en.usersWarn) toast('warn', '英語リストの利用者反映: ' + en.usersWarn);
      if (en.errors.length) {
        toast('err', '英語リストで失敗した行 ' + en.errors.length + '件 — 最初のエラー: ' + en.errors[0].msg);
      }
    }
    await reload();
    toast('ok', (s.createdList ? '「' + LIST_USERS + '」を作成し、' : '') +
      LABEL_L1 + ' ' + s.l1Count + '件 / ' + LABEL_L2 + ' ' + s.l2Count + '件を反映しました' +
      (s.added ? '(列追加 ' + s.added + ')' : '') + (s.renamed ? '(改名 ' + s.renamed + ')' : '') +
      permMsg + enMsg);
    if (s.orderWarn) toast('warn', '列の並び替えに一部失敗しました — ' + s.orderWarn);
    if (s.org2Migrated) toast('warn', s.org2Migrated);
    if (s.org2Mode) state.org2Mode = s.org2Mode;
    if (s.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました — ' + s.formulaWarn);
    if (s.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました — ' + s.condWarn);
  });
}

// 全組織のアクセス権を一括再設定(増分ではなく全行。割当グループ＋管理者で付け直す)
async function permReapplyAllFlow() {
  const admins = await loadAdminGroupIds();
  if (!admins.length) {
    toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)。' +
      '未設定だと実行者以外がアクセスできなくなります');
    return;
  }
  const ok = await modal({
    title: 'アクセス権を全再設定',
    message: '全組織の利用者行(' + state.users.length + '件)のアクセス権を、マスタで指定した権限グループ＋管理者グループで再設定します。' +
      '増分ではなく全行を対象に、各行の継承を解除して付け直します(未割当の' + LABEL_L1 + 'の行は管理者のみ)。' +
      'この操作は元に戻せません。',
    okLabel: '全行を再設定',
    danger: true,
  });
  if (!ok) return;
  run('アクセス権の全再設定', async () => {
    auditNote('全組織のアクセス権を再設定(全行)');
    const ps = await applyPermissionsAll(state, setStatus);
    await saveSyncFp('perms', computePermsSnap(state, admins));
    await saveSyncFp('permsVer', PERM_APPLY_VER);
    await reload();
    if (ps.errors.length) toast('err', '権限設定に失敗した行 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
    else toast('ok', '全行のアクセス権を再設定しました(' + (ps.applied + ps.adminOnly) + '件)', { sticky: true });
  });
}

// この組織区分1の利用者行だけアクセス権を再設定(押した行の組織のみ)
async function permApplyRowFlow(item) {
  const admins = await loadAdminGroupIds();
  if (!admins.length && !permGroupIdsOf(item).length) {
    toast('warn', 'この' + LABEL_L1 + 'の権限グループも管理者グループも未設定です');
    return;
  }
  if (!admins.length) {
    toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)');
    return;
  }
  const ok = await modal({
    title: 'アクセス権の再設定 — ' + item.Title,
    message: '「' + item.Title + '」の利用者行だけ、マスタで指定した権限グループ＋管理者グループでアクセス権を再設定します。' +
      '他の' + LABEL_L1 + 'の行は変更しません。この操作は元に戻せません。',
    okLabel: '再設定する',
    danger: true,
  });
  if (!ok) return;
  run('アクセス権の再設定', async () => {
    auditNote('「' + item.Title + '」のアクセス権を再設定(該当行のみ)');
    const rows = await spGetAll(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=5000');
    const targets = rows.filter((r) => (r.OrgLevel1 || '') === item.Title).map((r) => ({ id: r.Id, l1: item.Title }));
    if (!targets.length) { toast('warn', 'この' + LABEL_L1 + 'の利用者行がありません'); return; }
    const ps = await applyPermissionsToItems(state, targets, setStatus);
    if (ps.errors.length) toast('err', '権限設定に失敗した行 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
    else toast('ok', '「' + item.Title + '」の ' + targets.length + '件のアクセス権を再設定しました', { sticky: true });
  });
}

async function discardPendingFlow() {
  if (!state.syncFp || !state.syncDiff || !state.syncDiff.canDiscard) return;
  const d = state.syncDiff;
  const ok = await modal({
    title: '未反映の変更を破棄',
    message: 'マスタと権限グループ割当を、前回「リストへ反映」した時点の状態に戻します: ' +
      (d.summary.join(' / ') || '') + '。' +
      (d.removed.length ? ' ※削除済みのマスタ行(' + d.removed.join('、') + ')は復元できません。' : '') +
      'この操作は元に戻せません。',
    okLabel: '破棄して戻す',
    danger: true,
  });
  if (!ok) return;
  run('変更の破棄', async () => {
    auditNote('未反映のマスタ変更を破棄(' + (d.summary.join(' / ') || '') + ')');
    const r = await revertSyncState(state, state.syncFp, setStatus);
    await reload();
    toast('ok', '未反映の変更を破棄しました(書き戻し ' + r.reverted + '件 / 追加分の削除 ' + r.deleted + '件)');
    if (r.missing.length) {
      toast('warn', '復元できなかった削除済みマスタ: ' + r.missing.join('、'));
    }
  });
}

// まとめて追加 / 英語名の一括設定(既存と同名の行は英語名だけ更新)
async function masterBulkAddFlow(isL1) {
  const selL1 = state.l1.find((x) => x.Id === state.selectedL1);
  const targetLabel = isL1 ? LABEL_L1 : '「' + (selL1 ? selL1.Title : '') + '」配下の' + LABEL_L2;
  const pool = isL1 ? state.l1
    : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
  // 既存マスタを読み込んだ2欄(日本語/英語)で、同じ行=対応として入力させる
  const pairs = await openBulkMasterModal('まとめて追加 / 英語名の一括設定 — ' + targetLabel, pool);
  if (pairs == null) return;
  const poolByTitle = new Map(pool.map((x) => [x.Title, x]));
  const adds = [];
  const updates = []; // 既存の英語名更新 {id, name, en}
  const seen = new Set();
  let dup = 0;
  for (const { name: n, en } of pairs) {
    if (seen.has(n)) continue; // 同じ日本語名の重複行はスキップ
    seen.add(n);
    const exist = poolByTitle.get(n);
    if (exist) {
      if (en && en !== (exist.TitleEn || '')) updates.push({ id: exist.Id, name: n, en });
      else dup++;
    } else {
      adds.push({ name: n, en });
    }
  }
  if (!adds.length && !updates.length) {
    toast('warn', '追加・更新できる行がありません' + (dup ? '(既存と同じ内容)' : ''));
    return;
  }
  run('まとめて追加/英語名設定', async () => {
    auditNote((isL1 ? LABEL_L1 : LABEL_L2) + 'マスタ: 追加 ' + adds.length + '件 / 英語名更新 ' + updates.length + '件');
    let order = nextOrder(pool);
    for (const e of adds) {
      const body = { Title: e.name, TitleEn: e.en, SortOrder: order, Active: true };
      if (!isL1) body.Level1Id = state.selectedL1;
      await addItem(isL1 ? LIST_L1 : LIST_L2, body);
      order += 10;
    }
    for (const u of updates) {
      await updateItem(isL1 ? LIST_L1 : LIST_L2, u.id, { TitleEn: u.en });
    }
    await reload();
    toast('ok', '追加 ' + adds.length + '件 / 英語名更新 ' + updates.length + '件' +
      (dup ? '(' + dup + '件は変更なし)' : ''), { sticky: !!(updates.length || dup) });
  });
}

function masterAddFlow(isL1) {
  const app = appEl();
  const input = app.querySelector(isL1 ? '#pr-add-l1' : '#pr-add-l2');
  const enInput = app.querySelector(isL1 ? '#pr-add-l1-en' : '#pr-add-l2-en');
  const name = input.value.trim();
  const nameEn = enInput ? enInput.value.trim() : '';
  if (!name) return;
  const pool = isL1 ? state.l1
    : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
  if (pool.some((x) => x.Title === name)) {
    toast('warn', '「' + name + '」は既に登録されています');
    return;
  }
  run('マスタ追加', async () => {
    auditNote((isL1 ? LABEL_L1 : LABEL_L2) + 'マスタに「' + name + '」を追加');
    const body = { Title: name, TitleEn: nameEn, SortOrder: nextOrder(pool), Active: true };
    if (!isL1) body.Level1Id = state.selectedL1;
    await addItem(isL1 ? LIST_L1 : LIST_L2, body);
    await reload();
    toast('ok', '「' + name + '」を追加しました');
  });
}

// マスタ行のボタン操作。kind: 'l1' | 'l2'、items: 同じ一覧に並ぶ兄弟(並べ替え用)
async function masterRowAction(act, kind, item, items) {
  const listTitle = kind === 'l1' ? LIST_L1 : LIST_L2;
  const kindLabel = kind === 'l1' ? LABEL_L1 : LABEL_L2;
  if (act === 'perm') {
    openL1PermModal(state, item).then((saved) => { if (saved) run('再読込', reload); });
  } else if (act === 'perm-apply-row') {
    if (kind === 'l1') await permApplyRowFlow(item);
  } else if (act === 'rename') {
    const r = await openRenameMasterModal(item);
    if (!r) return;
    if (r.title === item.Title && r.titleEn === (item.TitleEn || '')) return;
    run('名称変更', async () => {
      auditNote(kindLabel + 'マスタ「' + item.Title + '」→「' + r.title + '」(英:' + (r.titleEn || '-') + ')に変更');
      await updateItem(listTitle, item.Id, { Title: r.title, TitleEn: r.titleEn });
      await reload();
    });
  } else if (act === 'del') {
    if (kind === 'l1') {
      const children = state.l2.filter((x) => x.Level1 && x.Level1.Id === item.Id);
      if (children.length) {
        toast('warn', '「' + item.Title + '」には' + LABEL_L2 + 'が ' + children.length + ' 件あります。先に' + LABEL_L2 + 'を削除してください');
        return;
      }
    }
    const okDel = await modal({
      title: '削除の確認',
      message: '「' + item.Title + '」を削除します。この操作は元に戻せません。',
      okLabel: '削除する',
      danger: true,
    });
    if (!okDel) return;
    run('マスタ削除', async () => {
      auditNote(kindLabel + 'マスタ「' + item.Title + '」を削除');
      await deleteItem(listTitle, item.Id);
      await reload();
      toast('ok', '「' + item.Title + '」を削除しました');
    });
  } else if (act === 'up' || act === 'down') {
    // SPリスト側(集計式・列順)への反映はその都度行わず、「リストへ反映」で一括適用する
    // (未反映の間は見出しに「並び替え」バッジが出る)
    run('並べ替え', async () => {
      auditNote(kindLabel + 'マスタ「' + item.Title + '」を' + (act === 'up' ? '上へ' : '下へ') + '移動');
      await moveItem(listTitle, items, item, act === 'up' ? -1 : 1);
      await reload();
    });
  }
}
