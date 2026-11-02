// 取込/出力/バックアップ系のフロー: CSV取込・Excel出力/取込・実機差分チェック・バックアップ/リストア/リセット

// CSV インポート(testText を渡すとファイル選択をスキップ — テスト用)
async function userImportFlow(testText) {
  let text = testText;
  if (text == null) {
    const file = await pickCsvFile();
    if (!file) return;
    try {
      text = decodeCsvBuffer(await file.arrayBuffer());
    } catch (e) {
      toast('err', 'ファイルの読み込みに失敗しました — ' + e.message);
      return;
    }
  }
  let plan;
  try {
    plan = buildImportPlan(state, parseCsvText(text));
  } catch (e) {
    toast('err', 'CSVの解析に失敗しました — ' + e.message);
    return;
  }
  if (!plan.targets.length) {
    toast('warn', '取り込み対象の行がありません(権限が対象外、空データ、または' + LABEL_L1 + '内の重複)');
    return;
  }
  const ok = await openImportConfirmModal(plan);
  if (!ok) return;
  run('インポート', async () => {
    // 0) マスタリスト自体が無ければ初期セットアップ(冪等)
    if (!state.ready) {
      setStatus('マスタリストを作成中…');
      await setup(setStatus);
      state.ready = true;
    }
    // 1) 未登録マスタの自動登録(組織区分1 → 再読込 → 組織区分2)
    if (plan.missingL1.length || plan.missingL2.length) {
      setStatus('未登録マスタを登録中…');
      let order1 = nextOrder(state.l1);
      for (const t of plan.missingL1) {
        try {
          await addItem(LIST_L1, { Title: t, SortOrder: order1, Active: true });
        } catch (e) {
          throw new Error(LABEL_L1 + 'マスタ「' + t + '」の登録: ' + e.message);
        }
        order1 += 10;
      }
      if (plan.missingL1.length) await loadAll();
      for (const m of plan.missingL2) {
        const l1 = state.l1.find((x) => x.Title === m.l1);
        if (!l1) continue;
        const siblings = state.l2.filter((x) => x.Level1 && x.Level1.Id === l1.Id);
        try {
          await addItem(LIST_L2, { Title: m.name, SortOrder: nextOrder(siblings), Active: true, Level1Id: l1.Id });
        } catch (e) {
          throw new Error(LABEL_L2 + 'マスタ「' + m.name + '」の登録: ' + e.message);
        }
        await loadAll();
      }
    }
    // 2) 列・選択肢・集計式を反映(部分的な失敗は警告にして取込を続行)
    setStatus('マスタをリストへ反映中…');
    const sres = await syncMastersToUserList(state, setStatus);
    if (sres.org2Migrated) toast('warn', sres.org2Migrated);
    if (sres.org2Mode) state.org2Mode = sres.org2Mode;
    if (sres.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました(取込は継続) — ' + sres.formulaWarn);
    if (sres.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました(取込は継続) — ' + sres.condWarn);
    if (sres.orderWarn) toast('warn', '列の並び替えに失敗しました(取込は継続) — ' + sres.orderWarn);
    // 取込権限(閲覧者など)が選択肢に無ければ追加
    const needPerms = [...new Set(plan.targets.map((t) => t.permission))]
      .filter((pm) => !state.choices.permission.includes(pm));
    if (needPerms.length) {
      const merged = state.choices.permission.concat(needPerms);
      await setChoices(LIST_USERS, 'Permission', '権限', merged, true);
      state.choices = { changeType: state.choices.changeType, permission: merged };
    }
    // 3) 行のアップサート(突合は「組織区分1+メール、無ければ組織区分1+氏名」。
    //    組織区分1が違えば別人として別行に登録する)
    const idx = buildUserIndex(state.users);
    let added = 0;
    let updated = 0;
    const rowErrors = [];
    const touched = []; // 権限の再適用対象(追加/更新した行のみ)
    let done = 0;
    for (const t of plan.targets) {
      done++;
      setStatus('利用者を取込中… (' + done + '/' + plan.targets.length + ')');
      try {
        const body = buildImportBody(state, t);
        const exist = findExistingUser(idx, t.org1, t.email, t.name);
        if (exist) {
          // 取込内容に無い既存の組織区分2チェックはクリア
          for (const k of Object.keys(exist)) {
            if (k.startsWith('L2_') && exist[k] === true && !(k in body)) body[k] = false;
          }
          await updateItem(LIST_USERS, exist.Id, withOrg2Text(body, exist));
          touched.push({ id: exist.Id, l1: t.org1 });
          updated++;
        } else {
          const j = await addItem(LIST_USERS, withOrg2Text(body));
          if (j && j.Id) touched.push({ id: j.Id, l1: t.org1 });
          added++;
        }
      } catch (e) {
        rowErrors.push({ name: t.name, msg: e.message });
      }
    }
    await reload();
    // 4) 権限グループ割当があれば、取込で追加/更新した行だけ行レベル権限を追従
    if (hasAnyPermConfig(state) && touched.length) {
      const ps = await applyPermissionsToItems(state, touched, setStatus);
      if (ps.errors.length) {
        toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg, { sticky: true });
      }
    }
    auditNote('CSVインポート: 追加 ' + added + '件 / 更新 ' + updated + '件');
    // スキップ/重複があると読ませたいので、その場合は自動消滅させない(明示的に閉じるまで残す)
    const notable = plan.skippedPerm || (plan.dupErrors && plan.dupErrors.length);
    toast('ok', 'インポート完了: 追加 ' + added + '件 / 更新 ' + updated + '件' +
      (plan.skippedPerm ? '(対象外の権限 ' + plan.skippedPerm + '件はスキップ)' : '') +
      (plan.dupErrors && plan.dupErrors.length ? '(' + LABEL_L1 + '内の重複 ' + plan.dupErrors.length + '件はスキップ)' : ''),
    { sticky: !!notable });
    if (rowErrors.length) {
      toast('err', '取込に失敗した行 ' + rowErrors.length + '件: ' +
        rowErrors.slice(0, 5).map((x) => x.name).join('、') + (rowErrors.length > 5 ? ' ほか' : '') +
        ' — 最初のエラー: ' + rowErrors[0].msg);
    }
  });
}

// Excel エクスポート(組織区分1を複数選択して .xlsx 保存)
async function userExportFlow() {
  if (!state.users.length) {
    toast('warn', 'エクスポートできる利用者がいません');
    return;
  }
  const titles = await openExportModal(state);
  if (!titles) return;
  const { blob, filename, count } = buildExportXlsx(state, titles);
  xlsxDownload(blob, filename);
  toast('ok', filename + ' を出力しました(' + titles.length + 'シート / ' + count + '件)');
}

// Excel インポート(エクスポートと同じ形式。testBuf を渡すとファイル選択をスキップ — テスト用)
async function userImportXlsxFlow(testBuf) {
  let buf = testBuf;
  if (!buf) {
    const file = await pickXlsxFile();
    if (!file) return;
    buf = await file.arrayBuffer();
  }
  let plan;
  try {
    // ファイル出力後に他の人が変えているかもしれないので、対象データはリストから読み直す
    setStatus('最新のリストを読み込み中…');
    await loadAll();
    plan = buildXlsxImportPlan(state, await xlsxParse(buf));
  } catch (e) {
    toast('err', 'Excelファイルの解析に失敗しました — ' + e.message);
    return;
  } finally {
    setStatus(state.ready ? '準備OK / ' + BUILD : 'マスタリスト未作成');
  }
  // 「更新」のうち、最新のリストと比べて差分のある列だけが取込対象
  const changed = plan.updates.filter(({ e, u }) => xlsxDiffLines(state, e, u).length > 0);
  // 入力不備の警告があれば、取込対象が無くてもモーダルで知らせる(OKは無効)
  if (!plan.adds.length && !changed.length && !plan.deletes.length && !plan.warnings.length) {
    toast(plan.notFound.length ? 'warn' : 'ok',
      '取り込む変更はありません(更新内容が「追加/更新/削除」の列が無いか、最新のリストとの差分がありません)' +
      (plan.notFound.length ? ' / 突合できない列 ' + plan.notFound.length + '件' : ''));
    return;
  }
  const ok = await openXlsxConfirmModal(state, plan, changed);
  if (!ok) return;
  run('Excelインポート', async () => {
    // 1) 未登録マスタの自動登録 → 列・集計の反映(CSV取込と同じ流儀)
    if (plan.missingL1.length || plan.missingL2.length) {
      setStatus('未登録マスタを登録中…');
      let order1 = nextOrder(state.l1);
      for (const t of plan.missingL1) {
        await addItem(LIST_L1, { Title: t, SortOrder: order1, Active: true });
        order1 += 10;
      }
      if (plan.missingL1.length) await loadAll();
      for (const m of plan.missingL2) {
        const l1 = state.l1.find((x) => x.Title === m.l1);
        if (!l1) continue;
        const siblings = state.l2.filter((x) => x.Level1 && x.Level1.Id === l1.Id);
        await addItem(LIST_L2, { Title: m.name, SortOrder: nextOrder(siblings), Active: true, Level1Id: l1.Id });
        await loadAll();
      }
      setStatus('マスタをリストへ反映中…');
      const sres = await syncMastersToUserList(state, setStatus);
      if (sres.org2Mode) state.org2Mode = sres.org2Mode;
    }
    // 2) 追加 / 更新(差分のある列のみ) / 論理削除
    //    (選択肢に無い権限の値は事前チェックで警告スキップ済み)
    const total = plan.adds.length + changed.length + plan.deletes.length;
    let done = 0;
    const rowErrors = [];
    const touched = []; // 権限の再適用対象(追加/更新した行のみ。削除は組織区分1が変わらないため不要)
    const step = () => setStatus('Excelを取込中… (' + (++done) + '/' + total + ')');
    for (const e of plan.adds) {
      step();
      try {
        const j = await addItem(LIST_USERS, withOrg2Text(buildXlsxBody(state, e)));
        if (j && j.Id) touched.push({ id: j.Id, l1: e.l1 });
      } catch (err) { rowErrors.push({ name: e.name, msg: err.message }); }
    }
    for (const { e, u } of changed) {
      step();
      try {
        await updateItem(LIST_USERS, u.Id, withOrg2Text(buildXlsxBody(state, e, u), u));
        touched.push({ id: u.Id, l1: e.l1 });
      } catch (err) { rowErrors.push({ name: e.name, msg: err.message }); }
    }
    for (const { u } of plan.deletes) {
      step();
      try {
        await updateItem(LIST_USERS, u.Id, { SystemDeleted: true });
      } catch (err) { rowErrors.push({ name: u.Title, msg: err.message }); }
    }
    await reload();
    // 4) 権限グループ割当があれば、取込で追加/更新した行だけ行レベル権限を追従
    if (hasAnyPermConfig(state) && touched.length) {
      const ps = await applyPermissionsToItems(state, touched, setStatus);
      if (ps.errors.length) {
        toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg, { sticky: true });
      }
    }
    auditNote('Excelインポート: 追加 ' + plan.adds.length + '件 / 更新 ' + changed.length +
      '件 / 論理削除 ' + plan.deletes.length + '件');
    toast('ok', 'Excelインポート完了: 追加 ' + plan.adds.length + '件 / 更新 ' + changed.length +
      '件 / 論理削除 ' + plan.deletes.length + '件', { sticky: plan.notFound.length > 0 });
    if (plan.notFound.length) {
      toast('warn', '更新/削除の対象が見つからずスキップした列 ' + plan.notFound.length + '件: ' +
        plan.notFound.slice(0, 5).map((x) => x.name).join('、') + (plan.notFound.length > 5 ? ' ほか' : ''), { sticky: true });
    }
    if (rowErrors.length) {
      toast('err', '取込に失敗した行 ' + rowErrors.length + '件: ' +
        rowErrors.slice(0, 5).map((x) => x.name).join('、') + (rowErrors.length > 5 ? ' ほか' : '') +
        ' — 最初のエラー: ' + rowErrors[0].msg);
    }
  });
}

// 実機差分チェック: 実機CSVを取込み、リストとの差分を state.compareResult に格納して表示
// (testText を渡すとファイル選択をスキップ — テスト用)
async function compareImportFlow(testText) {
  let text = testText;
  if (text == null) {
    const file = await pickCsvFile();
    if (!file) return;
    try {
      text = decodeCsvBuffer(await file.arrayBuffer());
    } catch (e) {
      toast('err', 'ファイルの読み込みに失敗しました — ' + e.message);
      return;
    }
  }
  let plan;
  try {
    plan = buildImportPlan(state, parseCsvText(text));
  } catch (e) {
    toast('err', 'CSVの解析に失敗しました — ' + e.message);
    return;
  }
  const rows = buildCompareResult(state, plan.targets);
  state.compareResult = { rows, scanned: plan.targets.length };
  state.view = 'compare';
  appRender();
  toast(rows.length ? 'warn' : 'ok',
    rows.length ? '差分 ' + rows.length + '件が見つかりました' : '差分はありませんでした');
}

// バックアップ取得(管理用を含む全リストを JSON で保存)
function backupFlow() {
  run('バックアップ', async () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
      '-' + pad(now.getHours()) + pad(now.getMinutes());
    const data = await buildBackup(state, now.toISOString());
    const counts = Object.entries(data.lists)
      .map(([k, v]) => v ? k + ':' + v.items.length : null).filter(Boolean).join(' / ');
    backupDownload(data, 'WebReg_backup_' + (listPrefix() || '') + stamp + '.json');
    auditNote('バックアップを取得(' + counts + ')');
    toast('ok', 'バックアップを保存しました(' + counts + ')');
  });
}

// リストア(バックアップJSONから復元)
async function restoreFlow() {
  const file = await pickJsonFile();
  if (!file) return;
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (e) {
    toast('err', 'JSONの読み込みに失敗しました — ' + e.message);
    return;
  }
  const lc = backup.lists || {};
  const ok = await modal({
    title: 'リストアの確認',
    message: 'バックアップから復元します: ' + LABEL_L1 + ' ' + ((lc.l1 && lc.l1.items.length) || 0) +
      '件 / ' + LABEL_L2 + ' ' + ((lc.l2 && lc.l2.items.length) || 0) + '件 / 利用者 ' +
      ((lc.users && lc.users.items.length) || 0) + '件。既存の同名マスタ・利用者は重複追加しません' +
      '(空のリストに復元するのが確実です)。集計列・条件式・書式は再構築されます。',
    okLabel: '復元する',
  });
  if (!ok) return;
  run('リストア', async () => {
    auditNote('バックアップから復元(' + (backup.exportedAt || '') + ')');
    const r = await restoreBackup(state, backup, setStatus, syncMastersToUserList);
    await reload();
    toast('ok', 'リストアが完了しました(利用者 ' + r.users + '件)');
  });
}

// リセット(管理対象リストを空にする。マスタを残すか含めるか選択)
async function resetFlow() {
  const choice = await openResetModal();
  if (!choice) return;
  const label = (choice.includeMasters ? 'マスタを含めて全削除' : '利用者データのみ削除(マスタは残す)') +
    (choice.clearColumns ? ' / 列も初期化' : '');
  run('リセット', async () => {
    auditNote('リストのリセット: ' + label);
    const s = await resetAllItems(setStatus, choice);
    resetWorkStatusCheck(); // 列も初期化した場合に改廃ステータス列を作り直せるように
    await reload();
    const total = Object.entries(s).filter(([k]) => !k.includes('列削除')).reduce((a, [, v]) => a + v, 0);
    const cols = Object.entries(s).filter(([k]) => k.includes('列削除')).reduce((a, [, v]) => a + v, 0);
    toast('ok', 'リセットしました(' + label + ' / 削除 ' + total + '件' + (cols ? ' / 列 ' + cols + '本' : '') + ')',
      { sticky: choice.clearColumns });
  });
}
