// 英語版利用者リスト(LIST_USERS_EN)の生成・反映。
// 海外/両方に振り分けた組織区分1だけを対象に、英語の列名・組織名・選択肢値・集計列・条件式で構築し、
// 日本語リスト(source)の該当利用者を転記する。
//   - 転記は SourceId 列(日本語リストのアイテムID)で突き合わせる差分同期。値が変わった行だけ更新し、
//     対象外になった行(元の行の削除・組織区分1の振り分け変更)は削除する
//   - 行レベル権限は日本語リストと同じ割当(組織区分1ごとのグループ=投稿 / 管理者=フル)を適用する
//   - SourceId の無い行(旧版の全消し→再投入で作られた行)は突き合わせできないため、全件同期で作り直す

const enName = (x) => x.TitleEn || x.Title;

// 英語リストの対象: 有効かつ海外/両方に振り分けた組織区分1と、その配下の有効な組織区分2(反映順)
function enTargetsOf(state) {
  const l1Order = new Map(state.l1.map((x, i) => [x.Id, i]));
  const enL1 = state.l1.filter((x) => x.Active !== false && goesToEn(assignOf(state, x.Title)));
  const enL1Ids = new Set(enL1.map((x) => x.Id));
  const enL2 = state.l2
    .filter((x) => x.Active !== false && x.Level1 && enL1Ids.has(x.Level1.Id))
    .sort((a, b) => (l1Order.get(a.Level1.Id) - l1Order.get(b.Level1.Id)) ||
      ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
  return { enL1, enL2, titles: new Set(enL1.map((x) => x.Title)) };
}

// 英語リストを生成・反映する。opts: {fp: 反映前のスナップショット, adminIds}
// (権限設定が変わった組織区分1の行だけに行権限を再適用するために使う)
async function syncEnglishUserList(state, log, opts) {
  const summary = { built: false, users: 0, written: 0, deleted: 0, permApplied: 0, errors: [] };
  const { enL1, enL2 } = enTargetsOf(state);
  if (!enL1.length) return summary; // 英語対象が無ければ何もしない
  summary.built = true;
  await buildEnSchema(state, enL1, enL2, log, summary);

  log(LIST_USERS_EN + ': 利用者を反映中…');
  try {
    const o = opts || {};
    const r = await pushEnUsers(state, state.users,
      { full: true, permTitles: permChangedTitles(state, o.fp, o.adminIds) }, log);
    Object.assign(summary, r);
  } catch (e) { summary.usersWarn = e.message; }
  return summary;
}

// 英語リストのスキーマ(リスト・基本列・選択肢・組織区分2チェック列・条件式・2段集計列・表示設定)
async function buildEnSchema(state, enL1, enL2, log, summary) {
  const nameL1 = (x) => safeTitle(enName(x));
  const l1NameById = new Map(state.l1.map((x) => [x.Id, enName(x)]));

  // ---- リスト作成(英語表示名) ----
  if (!(await listId(LIST_USERS_EN))) {
    log('「' + LIST_USERS_EN + '」を作成中…');
    await spPost('/_api/web/lists', { Title: LIST_USERS_EN, BaseTemplate: 100, Description: EN_LIST_DESC });
  }
  // 基本列は毎回 ensure(冪等)。「列も初期化」等で消えていても作り直す
  await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('Title')", { Title: EN_FIELD_TITLE.Title });
  await ensureField(LIST_USERS_EN, 'Company', EN_FIELD_TITLE.Company, { FieldTypeKind: 2 });
  await ensureField(LIST_USERS_EN, 'Email', EN_FIELD_TITLE.Email, { FieldTypeKind: 2 });
  if (!(await fieldExists(LIST_USERS_EN, 'ChangeType'))) await createChoiceField(LIST_USERS_EN, 'ChangeType', EN_FIELD_TITLE.ChangeType, CHANGE_TYPE_DEFAULTS.map(toEnChangeType), true);
  if (!(await fieldExists(LIST_USERS_EN, 'Permission'))) await createChoiceField(LIST_USERS_EN, 'Permission', EN_FIELD_TITLE.Permission, PERMISSION_DEFAULTS.map(toEnPermission), true);
  await ensureField(LIST_USERS_EN, 'Notes', EN_FIELD_TITLE.Notes, { FieldTypeKind: 3 });
  await ensureField(LIST_USERS_EN, 'AppliedDate', EN_FIELD_TITLE.AppliedDate, { FieldTypeKind: 4 });
  await ensureField(LIST_USERS_EN, 'SystemDeleted', EN_FIELD_TITLE.SystemDeleted, { FieldTypeKind: 8, DefaultValue: '0' });
  await ensureField(LIST_USERS_EN, 'L2All', EN_FIELD_TITLE.L2All, { FieldTypeKind: 8, DefaultValue: '0' });
  await ensureWorkStatusColumn(LIST_USERS_EN, 'en');
  // 突き合わせ用(日本語リストのアイテムID)。ツールが書く内部列なのでフォームには出さない
  if (!(await fieldExists(LIST_USERS_EN, 'SourceId'))) {
    await ensureField(LIST_USERS_EN, 'SourceId', 'Source ID', { FieldTypeKind: 9 });
    for (const m of ['setshowinnewform', 'setshowineditform']) {
      try { await spPost(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('SourceId')/" + m + '(false)'); } catch { /* ignore */ }
    }
  }

  // ---- 選択肢列 ----
  log(LIST_USERS_EN + ': 選択肢を更新中…');
  await setChoices(LIST_USERS_EN, 'OrgLevel1', EN_FIELD_TITLE.OrgLevel1, enL1.map(nameL1), false);
  await setChoices(LIST_USERS_EN, 'ChangeType', EN_FIELD_TITLE.ChangeType,
    state.choices.changeType.map(toEnChangeType), true);
  await setChoices(LIST_USERS_EN, 'Permission', EN_FIELD_TITLE.Permission,
    state.choices.permission.map(toEnPermission), true);

  // ---- 組織区分2 チェック列(同名は英語名で一意化) ----
  log(LIST_USERS_EN + ': チェック列を更新中…');
  const existing = await spGet(lt(LIST_USERS_EN) +
    "/fields?$select=InternalName,Title,ClientValidationFormula&$filter=startswith(InternalName,'L2_')");
  const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));
  const cvfByInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.ClientValidationFormula || '']));
  const titleCount = new Map();
  enL2.forEach((x) => titleCount.set(enName(x), (titleCount.get(enName(x)) || 0) + 1));
  const displayOf = (x) => safeTitle(titleCount.get(enName(x)) > 1
    ? enName(x) + '(' + (l1NameById.get(x.Level1.Id)) + ')' : enName(x));
  const newCols = [];
  for (const x of enL2) {
    const internal = 'L2_' + x.Id;
    const display = displayOf(x);
    if (!byInternal.has(internal)) {
      const xml = "<Field Type='Boolean' DisplayName='" + internal + "' Name='" + internal +
        "' StaticName='" + internal + "'><Default>0</Default></Field>";
      await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
      await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
      newCols.push(internal);
    } else if (byInternal.get(internal) !== display) {
      await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
    }
  }

  // ---- フォーム条件付き表示(英語の OrgLevel1 値で分岐) ----
  for (const x of enL2) {
    const internal = 'L2_' + x.Id;
    if (!byInternal.has(internal) && !newCols.includes(internal)) continue;
    const cond = "=if([$OrgLevel1] == '" + String(l1NameById.get(x.Level1.Id)).replace(/'/g, '') +
      "' && [$L2All] != true, 'true', 'false')";
    if (cvfByInternal.get(internal) !== cond) {
      try { await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + internal + "')", { ClientValidationFormula: cond }); } catch { /* ignore */ }
    }
  }
  try { await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('L2All')", { ClientValidationFormula: "=if([$OrgLevel1] != '', 'true', 'false')" }); } catch { /* ignore */ }

  // ---- 2段集計列(英語名) ----
  log(LIST_USERS_EN + ': 集計列を更新中…');
  const subDefs = [];
  for (const l1 of enL1) {
    const kids = enL2.filter((x) => x.Level1.Id === l1.Id);
    if (!kids.length) continue;
    const perCheck = kids.map((x) => 'IF([' + displayOf(x) + '],"✅","☐")&' + calcLit(displayOf(x))).join('&" / "&');
    const allChecked = calcLit(kids.map((x) => '✅' + displayOf(x)).join(' / '));
    subDefs.push({ internal: 'O2S_' + l1.Id, l1, formula: '=IF([' + EN_FIELD_TITLE.L2All + '],' + allChecked + ',' + perCheck + ')' });
  }
  const finalFormula = subDefs.length
    ? '=' + subDefs.map((d) => 'IF([' + EN_FIELD_TITLE.OrgLevel1 + ']="' + nameL1(d.l1) + '",[' + d.internal + '],"")').join('&')
    : '=""';
  try {
    const existingSubs = await spGet(lt(LIST_USERS_EN) + "/fields?$select=InternalName,Formula&$filter=startswith(InternalName,'O2S_')");
    const subByName = new Map((existingSubs.value || []).map((f) => [f.InternalName, f.Formula || '']));
    for (const d of subDefs) {
      if (!subByName.has(d.internal)) {
        const refs = "<FieldRef Name='L2All'/>" + enL2.filter((x) => x.Level1.Id === d.l1.Id).map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
        const xml = "<Field Type='Calculated' DisplayName='" + d.internal + "' Name='" + d.internal +
          "' StaticName='" + d.internal + "' ResultType='Text' ReadOnly='TRUE'><Formula>" + xmlEsc(d.formula) + '</Formula><FieldRefs>' + refs + '</FieldRefs></Field>';
        await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
      } else if (subByName.get(d.internal) !== d.formula) {
        await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + d.internal + "')", { Formula: d.formula });
      }
    }
    for (const name of subByName.keys()) {
      if (!subDefs.some((d) => d.internal === name)) {
        try { await spDelete(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('" + name + "')"); } catch { /* ignore */ }
      }
    }
    if (!(await fieldExists(LIST_USERS_EN, 'OrgLevel2'))) {
      const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
        " ResultType='Text' ReadOnly='TRUE'><Formula>=\"\"</Formula><FieldRefs><FieldRef Name='OrgLevel1'/></FieldRefs></Field>";
      await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
    }
    await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: EN_FIELD_TITLE.OrgLevel2, Formula: finalFormula });
  } catch (e) { summary.formulaWarn = e.message; }

  // ---- 表示設定(集計列をフォームから隠す + ビュー列順) ----
  await applyListFormatting(state, LIST_USERS_EN, 'en');
  await addViewFields(LIST_USERS_EN, ['OrgLevel1', 'OrgLevel2'].concat(newCols));
  try { await applyColumnOrder(['OrgLevel1', 'L2All', 'OrgLevel2'].concat(enL2.map((x) => 'L2_' + x.Id)), LIST_USERS_EN); } catch { /* ignore */ }
}

// 日本語リストの利用者1件 → 英語リストへの書込み本文。
// 組織区分2は英語リストに列がある分だけ true/false を明示する(外したチェックも反映するため)
function enUserBody(state, u, enL2, l2Cols) {
  const l1 = state.l1.find((x) => x.Title === (u.OrgLevel1 || ''));
  const body = {
    Title: u.Title || '', Company: u.Company || '', Email: u.Email || '',
    ChangeType: u.ChangeType ? toEnChangeType(u.ChangeType) : '',
    Permission: u.Permission ? toEnPermission(u.Permission) : '',
    OrgLevel1: l1 ? enName(l1) : (u.OrgLevel1 || ''),
    Notes: u.Notes || '', SystemDeleted: u.SystemDeleted === true, L2All: u.L2All === true,
    WorkStatus: toEnWorkStatus(u.WorkStatus || WORK_STATUS_DEFAULT),
    SourceId: u.Id,
  };
  for (const x of enL2) {
    const k = 'L2_' + x.Id;
    if (l2Cols.has(k)) body[k] = u[k] === true;
  }
  return body;
}

// 英語リストの現在値と書込み本文に差があるか(SP は空の文字列列を null で返す)
const enBodyDiffers = (it, body) => Object.keys(body).some((k) => (typeof body[k] === 'boolean'
  ? (it[k] === true) !== body[k]
  : String(it[k] == null ? '' : it[k]) !== String(body[k])));

// 日本語リストの利用者を英語リストへ差分転記し、行権限を適用する。
//   users          : 転記を検討する日本語リストの利用者。対象外の組織区分1の行は英語側から消す
//   opts.full      : true なら users に無い英語行(元の行が削除された等)と SourceId の無い旧行も消す
//   opts.forcePerm : true なら転記した全行に行権限を再適用する(選択行の再同期)。false なら
//                    新規行・組織区分1が変わった行・opts.permTitles(null=全行)に該当する行だけ
// 戻り値: {users(対象行数), written(作成/更新), deleted, permApplied, errors:[{id, msg}]}
async function pushEnUsers(state, users, opts, log) {
  const { enL2, titles } = enTargetsOf(state);
  const out = { users: 0, written: 0, deleted: 0, permApplied: 0, errors: [] };
  const l2Cols = new Set(((await spGet(lt(LIST_USERS_EN) +
    "/fields?$select=InternalName&$filter=startswith(InternalName,'L2_')")).value || []).map((f) => f.InternalName));
  const cur = await spGetAll(lt(LIST_USERS_EN) + '/items?$select=*&$top=5000');
  const bySrc = new Map();
  const orphans = new Set(); // SourceId 無し(旧版の行) or 同じ SourceId の重複行
  for (const it of cur) {
    if (it.SourceId && !bySrc.has(it.SourceId)) bySrc.set(it.SourceId, it);
    else orphans.add(it);
  }
  const ctx = (opts.forcePerm || hasAnyPermConfig(state)) ? await buildPermContext(state) : null;
  const targets = users.filter((u) => titles.has(u.OrgLevel1 || ''));
  const kept = new Set();
  let n = 0;
  for (const u of targets) {
    log(LIST_USERS_EN + ': 利用者を反映中… (' + (++n) + '/' + targets.length + ')');
    kept.add(u.Id);
    const body = enUserBody(state, u, enL2, l2Cols);
    const it = bySrc.get(u.Id);
    let needPerm = !!opts.forcePerm || opts.permTitles === null ||
      !!(opts.permTitles && opts.permTitles.has(u.OrgLevel1 || ''));
    try {
      let id = it && it.Id;
      if (!it) {
        id = (await spPost(lt(LIST_USERS_EN) + '/items', body)).Id;
        needPerm = true; // 新規行はリストの権限を継承しているため必ず適用
        out.written++;
      } else if (enBodyDiffers(it, body)) {
        if ((it.OrgLevel1 || '') !== body.OrgLevel1) needPerm = true;
        await spMerge(lt(LIST_USERS_EN) + '/items(' + id + ')', body);
        out.written++;
      }
      if (needPerm && ctx) {
        await applyPermToItem(ctx, id, u.OrgLevel1, LIST_USERS_EN);
        out.permApplied++;
      }
      out.users++;
    } catch (e) {
      out.errors.push({ id: u.Id, msg: e.message });
    }
  }
  const userIds = new Set(users.map((u) => u.Id));
  const drop = cur.filter((it) => (orphans.has(it) ? !!opts.full
    : !kept.has(it.SourceId) && (opts.full || userIds.has(it.SourceId))));
  for (const it of drop) {
    try {
      await spDelete(lt(LIST_USERS_EN) + '/items(' + it.Id + ')');
      out.deleted++;
    } catch (e) {
      out.errors.push({ id: it.SourceId || 0, msg: e.message });
    }
  }
  return out;
}
