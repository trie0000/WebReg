// 「リストへ反映」: 組織区分マスタを「利用者一覧」リストの列・選択肢・集計式に反映する。
//
// 列形式(ユーザー指定):
//   組織区分第1階層 = 選択肢(Choice)列 OrgLevel1。選択肢 = 有効な第1階層マスタ
//   第2階層        = 有効なマスタ1件につき はい/いいえ列(内部名 L2_<マスタID> — 改名しても安定)
//   組織区分第2階層 = 集計(Calculated)列 OrgLevel2。「✅欧州/☐北米/…」形式で表示
//
// 方針: 冪等。マスタの無効化/削除では列を削除しない(既存行のデータ保全)。
//       無効分は選択肢・集計式から除外されるだけ。マスタ改名は列の表示名に追従する。

const xmlEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// 集計式の文字列リテラル/列参照に使えるようにサニタイズ
const safeTitle = (s) => String(s).replace(/["[\]]/g, '');

async function createChoiceField(listTitle, internal, display, choices, fillIn) {
  const xml = "<Field Type='Choice' DisplayName='" + internal + "' Name='" + internal +
    "' StaticName='" + internal + "' Format='Dropdown' FillInChoice='" + (fillIn ? 'TRUE' : 'FALSE') + "'>" +
    '<CHOICES>' + choices.map((c) => '<CHOICE>' + xmlEsc(c) + '</CHOICE>').join('') + '</CHOICES></Field>';
  await spPost(lt(listTitle) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
  await spMerge(lt(listTitle) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
}

async function setChoices(listTitle, internal, display, choices, fillIn) {
  if (!(await fieldExists(listTitle, internal))) {
    await createChoiceField(listTitle, internal, display, choices, fillIn);
    return;
  }
  const path = lt(listTitle) + "/fields/getbyinternalnameortitle('" + internal + "')";
  try {
    await spMerge(path, { Title: display, Choices: choices }); // 表示名の変更にも追従
  } catch {
    // nometadata でコレクション更新を受け付けないテナント向けの verbose フォールバック
    await spMergeVerbose(path, 'SP.FieldChoice', { Title: display, Choices: { results: choices } });
  }
}

// 改廃ステータス列(WorkStatus)を未作成時のみ作成する(冪等)
async function ensureWorkStatusColumn() {
  if (await fieldExists(LIST_USERS, 'WorkStatus')) return;
  const xml = "<Field Type='Choice' DisplayName='WorkStatus' Name='WorkStatus' StaticName='WorkStatus'" +
    " Format='Dropdown'><Default>" + xmlEsc(WORK_STATUS_DEFAULT) + '</Default><CHOICES>' +
    WORK_STATUS.map((c) => '<CHOICE>' + xmlEsc(c) + '</CHOICE>').join('') + '</CHOICES></Field>';
  await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
  await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('WorkStatus')", { Title: '改廃ステータス' });
  try { await addViewFields(LIST_USERS, ['WorkStatus']); } catch { /* ignore */ }
}

async function ensureUserList(log) {
  if (await listId(LIST_USERS)) return false;
  log('「' + LIST_USERS + '」を作成中…');
  await spPost('/_api/web/lists', { Title: LIST_USERS, BaseTemplate: 100, Description: '利用者の権限登録リスト(webreg)' });
  await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Title')", { Title: '利用者名' });
  await ensureField(LIST_USERS, 'Company', '会社名', { FieldTypeKind: 2 });
  await ensureField(LIST_USERS, 'Email', 'メールアドレス', { FieldTypeKind: 2 });
  await createChoiceField(LIST_USERS, 'ChangeType', '変更区分', CHANGE_TYPE_DEFAULTS, true);
  await createChoiceField(LIST_USERS, 'Permission', '権限', PERMISSION_DEFAULTS, true);
  await ensureField(LIST_USERS, 'Notes', '特記事項', { FieldTypeKind: 3 });
  await ensureField(LIST_USERS, 'AppliedDate', 'システム反映日', { FieldTypeKind: 4 });
  await ensureField(LIST_USERS, 'SystemDeleted', 'システム削除', { FieldTypeKind: 8, DefaultValue: '0' });
  await addViewFields(LIST_USERS, ['Company', 'Email', 'ChangeType', 'Permission', 'Notes', 'AppliedDate', 'SystemDeleted']);
  return true;
}

// state.l1/l2 を利用者一覧リストへ反映し、結果サマリを返す
async function syncMastersToUserList(state, log) {
  const l1Order = new Map(state.l1.map((x, i) => [x.Id, i]));
  const activeL1 = state.l1.filter((x) => x.Active !== false);
  // 親の第1階層が無効なら、その配下の第2階層も反映対象から除外する
  const activeL1Ids = new Set(activeL1.map((x) => x.Id));
  const activeL2 = state.l2
    .filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id))
    .sort((a, b) => (l1Order.get(a.Level1.Id) - l1Order.get(b.Level1.Id)) ||
      ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));

  const summary = { createdList: false, l1Count: activeL1.length, added: 0, renamed: 0, l2Count: activeL2.length };
  summary.createdList = await ensureUserList(log);

  // 「組織区分2のすべて」フラグ列(チェックで全組織区分2を選択扱いにする)
  await ensureField(LIST_USERS, 'L2All', '組織区分2のすべて', { FieldTypeKind: 8, DefaultValue: '0' });

  // 改廃ステータス列(実機への登録作業の進捗。改廃依頼一覧で使う)
  await ensureWorkStatusColumn();

  // 組織区分1: 選択肢列を有効マスタで更新
  log(LABEL_L1 + 'の選択肢を更新中…');
  await setChoices(LIST_USERS, 'OrgLevel1', LABEL_L1, activeL1.map((x) => x.Title), false);

  // 旧既定の「参照者」は不要(2026-06 仕様変更)。どの行にも使われていなければ選択肢から外す
  try {
    const pm = await spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Permission')?$select=Choices");
    if ((pm.Choices || []).includes('参照者')) {
      const used = await spGet(lt(LIST_USERS) + "/items?$select=Id&$filter=Permission eq '参照者'&$top=1");
      if (!(used.value || []).length) {
        await setChoices(LIST_USERS, 'Permission', '権限',
          pm.Choices.filter((x) => x !== '参照者'), true);
      }
    }
  } catch { /* 選択肢の整理は失敗しても反映は続行 */ }

  // 組織区分2: 既存の L2_* 列を取得して 追加/改名 を判断
  log(LABEL_L2 + 'のチェック列を更新中…');
  const existing = await spGet(lt(LIST_USERS) +
    "/fields?$select=InternalName,Title,ClientValidationFormula&$filter=startswith(InternalName,'L2_')");
  const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));
  const cvfByInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.ClientValidationFormula || '']));

  // 表示名はマスタ名称。第1階層をまたいで同名がある場合は「名称(第1階層名)」で一意化
  const titleCount = new Map();
  activeL2.forEach((x) => titleCount.set(x.Title, (titleCount.get(x.Title) || 0) + 1));
  const l1Title = new Map(state.l1.map((x) => [x.Id, x.Title]));
  const displayOf = (x) => safeTitle(titleCount.get(x.Title) > 1
    ? x.Title + '(' + l1Title.get(x.Level1.Id) + ')' : x.Title);

  const newCols = [];
  for (const x of activeL2) {
    const internal = 'L2_' + x.Id;
    const display = displayOf(x);
    if (!byInternal.has(internal)) {
      const xml = "<Field Type='Boolean' DisplayName='" + internal + "' Name='" + internal +
        "' StaticName='" + internal + "'><Default>0</Default></Field>";
      await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
      await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
      newCols.push(internal);
      summary.added++;
    } else if (byInternal.get(internal) !== display) {
      await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
      summary.renamed++;
    }
  }

  // SP標準フォームの条件付き表示: 各組織区分2列は「親の組織区分1が選択された時だけ表示」。
  // この条件式はフィールドの ClientValidationFormula に保存される(UIの「条件式の編集」と同じ場所。
  // 実機調査で特定 — ClientFormCustomFormatter ではない)
  log('フォームの条件付き表示を更新中…');
  for (const x of state.l2) {
    if (!x.Level1 || !l1Title.has(x.Level1.Id)) continue;
    const internal = 'L2_' + x.Id;
    if (!byInternal.has(internal) && !newCols.includes(internal)) continue;
    const cond = "=if([$OrgLevel1] == '" + String(l1Title.get(x.Level1.Id)).replace(/'/g, '') +
      "' && [$L2All] != true, 'true', 'false')";
    if (cvfByInternal.get(internal) !== cond) {
      try {
        await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')",
          { ClientValidationFormula: cond });
      } catch (e) {
        summary.condWarn = '条件付き表示(' + internal + '): ' + e.message;
      }
    }
  }
  // 「すべて」列自体は組織区分1を選んだときだけ表示
  try {
    await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('L2All')",
      { ClientValidationFormula: "=if([$OrgLevel1] != '', 'true', 'false')" });
  } catch (e) {
    summary.condWarn = '条件付き表示(L2All): ' + e.message;
  }

  // 集計列: 組織区分1の値で分岐し、その配下の組織区分2だけを ✅/☐ で連結する式に更新
  // (行ごとに自分の組織区分1に紐づく組織だけが表示される。並び替えもここで追従)
  // 集計は2段構成にする(ユーザー提案の方式):
  //   1) 組織区分1ごとの中間集計列 O2S_<L1のID>(その配下の組織区分2だけの✅/☐連結)
  //   2) 統合列 OrgLevel2 は「組織区分1の値に応じて該当の中間列を参照する」だけ
  // 1本の式が巨大化しないため、SP の式長上限(約8千文字)に組織数が増えても当たらない。
  // それでも収まらない場合(1つの組織区分1に大量の組織区分2がある等)はテキスト列へ移行
  log('集計列(' + LABEL_L2 + ')を更新中…');
  const FORMULA_LIMIT = 7000;
  // ⚠ 実機の罠: 計算式内の「文字列リテラル」は255文字まで(256文字で 500 構文エラー。
  //   文字数ベースで日本語/ASCII同じ)。長い文字列は分割して & で連結すれば通る。
  const LIT_MAX = 120;
  const lit = (s) => {
    const chunks = [];
    for (let i = 0; i < s.length || i === 0; i += LIT_MAX) {
      chunks.push('"' + s.slice(i, i + LIT_MAX).replace(/"/g, '""') + '"');
    }
    return chunks.join('&');
  };
  const subDefs = []; // {internal, l1, formula}
  for (const l1 of activeL1) {
    const kids = activeL2.filter((x) => x.Level1.Id === l1.Id);
    if (!kids.length) continue;
    const perCheck = kids.map((x) => 'IF([' + displayOf(x) + '],"✅","☐")&' + lit(displayOf(x)))
      .join('&" / "&');
    const allChecked = lit(kids.map((x) => '✅' + displayOf(x)).join(' / '));
    subDefs.push({
      internal: 'O2S_' + l1.Id,
      l1,
      formula: '=IF([組織区分2のすべて],' + allChecked + ',' + perCheck + ')',
    });
  }
  const finalFormula = subDefs.length
    ? '=' + subDefs.map((d) => 'IF([' + LABEL_L1 + ']="' + safeTitle(d.l1.Title) + '",[' + d.internal + '],"")').join('&')
    : '=""';
  const fitsCalc = finalFormula.length <= FORMULA_LIMIT &&
    subDefs.every((d) => d.formula.length <= FORMULA_LIMIT);

  // 列が無い場合に 400 を出さないよう $filter で照会(実機の罠: 404 ではなく 400)
  let org2Type = '';
  try {
    const fr = await spGet(lt(LIST_USERS) +
      "/fields?$select=TypeAsString&$filter=InternalName eq 'OrgLevel2'");
    org2Type = ((fr.value || [])[0] || {}).TypeAsString || '';
  } catch { /* 未作成 */ }

  if (fitsCalc) {
    try {
      // 中間集計列の ensure と式更新(式が変わったときだけ MERGE)
      const existingSubs = await spGet(lt(LIST_USERS) +
        "/fields?$select=InternalName,Formula&$filter=startswith(InternalName,'O2S_')");
      const subByName = new Map((existingSubs.value || []).map((f) => [f.InternalName, f.Formula || '']));
      for (const d of subDefs) {
        if (!subByName.has(d.internal)) {
          const refs = "<FieldRef Name='L2All'/>" +
            activeL2.filter((x) => x.Level1.Id === d.l1.Id)
              .map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
          const xml = "<Field Type='Calculated' DisplayName='" + d.internal + "' Name='" + d.internal +
            "' StaticName='" + d.internal + "' ResultType='Text' ReadOnly='TRUE'>" +
            '<Formula>' + xmlEsc(d.formula) + '</Formula><FieldRefs>' + refs + '</FieldRefs></Field>';
          await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
        } else if (subByName.get(d.internal) !== d.formula) {
          await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + d.internal + "')",
            { Formula: d.formula });
        }
      }
      // 使われなくなった中間列は削除(計算列なのでデータ消失なし)
      for (const name of subByName.keys()) {
        if (!subDefs.some((d) => d.internal === name)) {
          try {
            await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + name + "')");
          } catch { /* ignore */ }
        }
      }
      // 過去にテキスト方式へ移行済みなら計算列に戻す(値は式で再計算されるため消失なし)
      if (org2Type && org2Type !== 'Calculated') {
        await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')");
        org2Type = '';
      }
      if (!org2Type) {
        const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
          " ResultType='Text' ReadOnly='TRUE'><Formula>=\"\"</Formula>" +
          "<FieldRefs><FieldRef Name='OrgLevel1'/></FieldRefs></Field>";
        await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
        await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2 });
      }
      await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')",
        { Title: LABEL_L2, Formula: finalFormula });
      summary.org2Mode = 'calc';
    } catch (e) {
      summary.formulaWarn = e.message + '(統合式 ' + finalFormula.length + '文字)';
    }
  }

  if (summary.org2Mode !== 'calc') {
    // フォールバック: ツールが値を書き込むテキスト列へ移行。
    // 1行テキストは255文字までしか保存できないため複数行(Note)にする
    if (org2Type === 'Note') {
      summary.org2Mode = 'text';
    } else {
      log(LABEL_L2 + '列をテキスト方式へ移行中…');
      try {
        if (org2Type) {
          await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')");
        }
        await ensureField(LIST_USERS, 'OrgLevel2', LABEL_L2, { FieldTypeKind: 3 });
        try {
          await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')",
            { RichText: false });
        } catch { /* 既定がプレーンの場合あり */ }
        try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowinnewform(false)"); } catch { /* ignore */ }
        try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowineditform(false)"); } catch { /* ignore */ }
        summary.org2Mode = 'text';
        summary.org2Migrated = '集計式が上限を超えるため、' + LABEL_L2 + '列をツールが書き込むテキスト列に切替えました';
      } catch (e2) {
        summary.formulaWarn = (summary.formulaWarn || '') + ' / テキスト移行失敗: ' + e2.message;
      }
    }
  }

  // テキスト方式: 全行の表示値を埋め直す(値が変わる行のみ更新)
  if (summary.org2Mode === 'text') {
    log(LABEL_L2 + 'の表示値を更新中…');
    try {
      const items = await spGet(lt(LIST_USERS) + '/items?$select=*&$top=4999');
      for (const it of (items.value || [])) {
        const txt = userOrg2Text(state, it);
        if ((it.OrgLevel2 || '') !== txt) {
          await spMerge(lt(LIST_USERS) + '/items(' + it.Id + ')', { OrgLevel2: txt });
        }
      }
    } catch (e) {
      summary.formulaWarn = LABEL_L2 + 'の表示値更新: ' + e.message;
    }
  }

  // 個別の組織区分2チェック列(L2_*)はビューに出さない(集計列 OrgLevel2 で代替)。
  // 並び・表示列は applyColumnOrder で明示指定する
  await addViewFields(LIST_USERS, ['OrgLevel1', 'OrgLevel2']);

  // SP標準フォームの設定: 読み取り専用の集計列(OrgLevel2 と中間列 O2S_*)は
  // 新規追加/編集フォームに出さない。変更区分/権限は色付きチップで表示する
  log('SPリストの表示設定を更新中…');
  try {
    await applyListFormatting(state);
  } catch (e) {
    summary.formatWarn = e.message;
  }

  // 列の並び順をマスタに合わせる(既定ビュー + SP標準フォーム)。失敗しても反映自体は成立
  const orderedManaged = ['OrgLevel1', 'L2All', 'OrgLevel2'].concat(activeL2.map((x) => 'L2_' + x.Id));
  try {
    log('列の並び順を更新中…');
    await applyColumnOrder(orderedManaged);
  } catch (e) {
    summary.orderWarn = e.message;
  }
  log('反映完了');
  return summary;
}

// 計算式の文字列リテラルは255文字まで(実機の罠)。長い文字列は120文字ごとに分割して & 連結
const LIT_MAX = 120;
function calcLit(s) {
  const chunks = [];
  for (let i = 0; i < s.length || i === 0; i += LIT_MAX) {
    chunks.push('"' + s.slice(i, i + LIT_MAX).replace(/"/g, '""') + '"');
  }
  return chunks.join('&');
}

// 英語版利用者リスト(LIST_USERS_EN)を生成・反映する。
// 海外/両方に振り分けた組織区分1だけを対象に、英語の列名・組織名・選択肢値・集計列・
// 条件式・色チップで構築し、日本語リスト(source)の該当利用者を転記する。
async function syncEnglishUserList(state, log) {
  const summary = { built: false, users: 0 };
  // 対象 = 海外/両方 に振り分けられた有効な組織区分1
  const enL1 = state.l1.filter((x) => x.Active !== false && goesToEn(assignOf(state, x.Title)));
  if (!enL1.length) return summary; // 英語対象が無ければ何もしない
  summary.built = true;

  const l1Order = new Map(state.l1.map((x, i) => [x.Id, i]));
  const enL1Ids = new Set(enL1.map((x) => x.Id));
  const enL2 = state.l2
    .filter((x) => x.Active !== false && x.Level1 && enL1Ids.has(x.Level1.Id))
    .sort((a, b) => (l1Order.get(a.Level1.Id) - l1Order.get(b.Level1.Id)) ||
      ((a.SortOrder || 0) - (b.SortOrder || 0)) || (a.Id - b.Id));
  const nameL1 = (x) => safeTitle(x.TitleEn || x.Title);
  const l1NameById = new Map(state.l1.map((x) => [x.Id, x.TitleEn || x.Title]));

  // ---- リスト作成(英語表示名) ----
  if (!(await listId(LIST_USERS_EN))) {
    log('「' + LIST_USERS_EN + '」を作成中…');
    await spPost('/_api/web/lists', { Title: LIST_USERS_EN, BaseTemplate: 100, Description: EN_LIST_DESC });
    await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('Title')", { Title: EN_FIELD_TITLE.Title });
    await ensureField(LIST_USERS_EN, 'Company', EN_FIELD_TITLE.Company, { FieldTypeKind: 2 });
    await ensureField(LIST_USERS_EN, 'Email', EN_FIELD_TITLE.Email, { FieldTypeKind: 2 });
    await createChoiceField(LIST_USERS_EN, 'ChangeType', EN_FIELD_TITLE.ChangeType,
      CHANGE_TYPE_DEFAULTS.map(toEnChangeType), true);
    await createChoiceField(LIST_USERS_EN, 'Permission', EN_FIELD_TITLE.Permission,
      PERMISSION_DEFAULTS.map(toEnPermission), true);
    await ensureField(LIST_USERS_EN, 'Notes', EN_FIELD_TITLE.Notes, { FieldTypeKind: 3 });
    await ensureField(LIST_USERS_EN, 'AppliedDate', EN_FIELD_TITLE.AppliedDate, { FieldTypeKind: 4 });
    await ensureField(LIST_USERS_EN, 'SystemDeleted', EN_FIELD_TITLE.SystemDeleted, { FieldTypeKind: 8, DefaultValue: '0' });
  }
  await ensureField(LIST_USERS_EN, 'L2All', EN_FIELD_TITLE.L2All, { FieldTypeKind: 8, DefaultValue: '0' });
  if (!(await fieldExists(LIST_USERS_EN, 'WorkStatus'))) {
    const xml = "<Field Type='Choice' DisplayName='WorkStatus' Name='WorkStatus' StaticName='WorkStatus'" +
      " Format='Dropdown'><Default>" + xmlEsc(toEnWorkStatus(WORK_STATUS_DEFAULT)) + '</Default><CHOICES>' +
      WORK_STATUS.map((c) => '<CHOICE>' + xmlEsc(toEnWorkStatus(c)) + '</CHOICE>').join('') + '</CHOICES></Field>';
    await spPost(lt(LIST_USERS_EN) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
    await spMerge(lt(LIST_USERS_EN) + "/fields/getbyinternalnameortitle('WorkStatus')", { Title: EN_FIELD_TITLE.WorkStatus });
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
  const enName2 = (x) => x.TitleEn || x.Title;
  const titleCount = new Map();
  enL2.forEach((x) => titleCount.set(enName2(x), (titleCount.get(enName2(x)) || 0) + 1));
  const displayOf = (x) => safeTitle(titleCount.get(enName2(x)) > 1
    ? enName2(x) + '(' + (l1NameById.get(x.Level1.Id)) + ')' : enName2(x));
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

  // ---- 表示設定(チップ色 + 集計列をフォームから隠す + ビュー列順) ----
  await applyListFormatting(state, LIST_USERS_EN, 'en');
  await addViewFields(LIST_USERS_EN, ['OrgLevel1', 'OrgLevel2'].concat(newCols));
  try { await applyColumnOrder(['OrgLevel1', 'L2All', 'OrgLevel2'].concat(enL2.map((x) => 'L2_' + x.Id)), LIST_USERS_EN); } catch { /* ignore */ }

  // ---- 利用者の転記(英語対象を日本語リストから。全消し→再投入の単純同期) ----
  log(LIST_USERS_EN + ': 利用者を反映中…');
  try {
    const cur = (await spGet(lt(LIST_USERS_EN) + '/items?$select=Id&$top=5000')).value || [];
    for (const it of cur) { try { await spDelete(lt(LIST_USERS_EN) + '/items(' + it.Id + ')'); } catch { /* ignore */ } }
    const enTitleSet = new Set(enL1.map((x) => x.Title)); // source の OrgLevel1(日本語)で判定
    const targets = state.users.filter((u) => enTitleSet.has(u.OrgLevel1 || ''));
    let n = 0;
    for (const u of targets) {
      log(LIST_USERS_EN + ': 利用者を反映中… (' + (++n) + '/' + targets.length + ')');
      const l1 = state.l1.find((x) => x.Title === (u.OrgLevel1 || ''));
      const body = {
        Title: u.Title || '', Company: u.Company || '', Email: u.Email || '',
        ChangeType: u.ChangeType ? toEnChangeType(u.ChangeType) : '',
        Permission: u.Permission ? toEnPermission(u.Permission) : '',
        OrgLevel1: l1 ? (l1.TitleEn || l1.Title) : (u.OrgLevel1 || ''),
        Notes: u.Notes || '', SystemDeleted: u.SystemDeleted === true, L2All: u.L2All === true,
        WorkStatus: toEnWorkStatus(u.WorkStatus || WORK_STATUS_DEFAULT),
      };
      for (const k of Object.keys(u)) { if (/^L2_\d+$/.test(k) && u[k] === true) body[k] = true; }
      try { await spPost(lt(LIST_USERS_EN) + '/items', body); summary.users++; } catch { /* 1件失敗は継続 */ }
    }
  } catch (e) { summary.usersWarn = e.message; }
  return summary;
}

// 選択肢→色の「標準コンパクトチップ」列フォーマットを生成する。
// SP標準のピルと同じ「外側コンテナ div + 内側 span(inline-block)」構造にして、
// セル幅いっぱいに伸びる(横長)/行が高くなる(縦長)のを防ぐ。空欄はチップを出さない。
// 色はツール内グリッドの pr-spchip と同じ RGB を背景色に直接指定し、見た目を統一する。
const CHIP_ADD = 'rgb(202,240,204)';  // 追加/新規(緑)   = pr-spchip--add
const CHIP_UPD = 'rgb(212,231,246)';  // 更新/変更/更新者(青) = pr-spchip--upd
const CHIP_DEL = 'rgb(250,187,195)';  // 削除(赤)         = pr-spchip--del
const CHIP_GRAY = 'rgb(229,229,229)'; // 変更なし/閲覧者/その他(灰) = pr-spchip--gray
function chipFormatterJson(colorMap, deflt) {
  const entries = Object.entries(colorMap);
  let col = "'" + deflt + "'";
  for (let i = entries.length - 1; i >= 0; i--) {
    col = "if(@currentField == '" + entries[i][0] + "', '" + entries[i][1] + "', " + col + ")";
  }
  return JSON.stringify({
    $schema: 'https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json',
    elmType: 'div', // セル内の外側コンテナ(背景なし)。中の span をピルにする
    style: { display: "=if(@currentField == '', 'none', 'flex')", 'align-items': 'center' },
    children: [{
      elmType: 'span',
      txtContent: '@currentField',
      style: {
        display: 'inline-block',
        'box-sizing': 'border-box',
        padding: '2px 10px',
        'border-radius': '16px',
        'white-space': 'nowrap',
        'background-color': '=' + col,
      },
    }],
  });
}

// 変更区分/権限の選択肢に、ツールと同色の標準チップ書式を付け、読み取り専用の集計列をフォームから隠す。
// listTitle 省略時は日本語の利用者一覧。lang='en' のときは英語の選択肢値に色を付ける。
async function applyListFormatting(state, listTitle, lang) {
  const target = listTitle || LIST_USERS;
  const tr = (lang === 'en');
  // 追加系=緑 / 更新系=青 / 削除=赤 / 変更なし=灰(ツールのチップと同じ RGB)
  const ctMap = {};
  ctMap[tr ? toEnChangeType('追加') : '追加'] = CHIP_ADD;
  ctMap[tr ? toEnChangeType('新規') : '新規'] = CHIP_ADD;
  ctMap[tr ? toEnChangeType('更新') : '更新'] = CHIP_UPD;
  ctMap[tr ? toEnChangeType('変更') : '変更'] = CHIP_UPD;
  ctMap[tr ? toEnChangeType('削除') : '削除'] = CHIP_DEL;
  ctMap[tr ? toEnChangeType('変更なし') : '変更なし'] = CHIP_GRAY;
  const pmMap = {};
  pmMap[tr ? toEnPermission('更新者') : '更新者'] = CHIP_UPD;
  pmMap[tr ? toEnPermission('閲覧者') : '閲覧者'] = CHIP_GRAY;
  const setFmt = async (internal, json) => {
    try {
      await spMerge(lt(target) + "/fields/getbyinternalnameortitle('" + internal + "')",
        { CustomFormatter: json });
    } catch { /* 書式設定は失敗しても反映は継続 */ }
  };
  await setFmt('ChangeType', chipFormatterJson(ctMap, CHIP_GRAY));
  await setFmt('Permission', chipFormatterJson(pmMap, CHIP_GRAY));

  // 読み取り専用の集計列(統合列 OrgLevel2 + 中間列 O2S_*)を新規/編集フォームから隠す
  const calcCols = ['OrgLevel2'];
  try {
    const subs = await spGet(lt(target) +
      "/fields?$select=InternalName&$filter=startswith(InternalName,'O2S_')");
    for (const f of (subs.value || [])) calcCols.push(f.InternalName);
  } catch { /* ignore */ }
  for (const c of calcCols) {
    try { await spPost(lt(target) + "/fields/getbyinternalnameortitle('" + c + "')/setshowinnewform(false)"); } catch { /* ignore */ }
    try { await spPost(lt(target) + "/fields/getbyinternalnameortitle('" + c + "')/setshowineditform(false)"); } catch { /* ignore */ }
  }
}

// 既定ビューの表示列と並び(ユーザー指定)を明示設定し、SP標準フォーム(FieldLinks)の
// 列順を orderedManaged(組織区分1 → すべて → 集計列 → 組織区分2チェック列)に揃える。
// 既定ビュー = 利用者名/会社名/メール/変更区分/権限/組織区分1/組織区分2/特記事項/
//              システム反映日/システム削除/更新日時/更新者(個別の L2_* チェック列は出さない)
async function applyColumnOrder(orderedManaged, listTitle) {
  const target = listTitle || LIST_USERS;
  const TITLE_ALIAS = new Set(['LinkTitle', 'Title', 'LinkTitleNoMenu']);
  const DESIRED = ['LinkTitle', 'Company', 'Email', 'ChangeType', 'Permission',
    'OrgLevel1', 'OrgLevel2', 'Notes', 'AppliedDate', 'SystemDeleted', 'Modified', 'Editor'];

  let current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];
  // 過去の重複追加(実機 addviewfield の仕様)を掃除。
  // removeviewfield は1回の呼び出しで1つしか消えないため、出現回数分削除して1つ追加し直す
  const counts = new Map();
  current.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
  let hadDupes = false;
  for (const [n, c] of counts) {
    if (c <= 1) continue;
    hadDupes = true;
    for (let i = 0; i < c; i++) {
      try {
        await spPost(lt(target) + "/defaultview/viewfields/removeviewfield('" + n + "')");
      } catch { break; /* 全部消えたら終了 */ }
    }
    await spPost(lt(target) + "/defaultview/viewfields/addviewfield('" + n + "')");
  }
  if (hadDupes) current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];

  // ビューにあるタイトル列の内部名(LinkTitle 既定)を使う
  const titleField = current.find((n) => TITLE_ALIAS.has(n)) || 'LinkTitle';
  const desired = DESIRED.map((n) => (n === 'LinkTitle' ? titleField : n));
  const desiredSet = new Set(desired);
  // 指定外の列(L2_*・組織区分2のすべて・中間列・改廃ステータス等)をビューから外す
  for (const n of current) {
    if (desiredSet.has(n) || TITLE_ALIAS.has(n)) continue;
    try { await spPost(lt(target) + "/defaultview/viewfields/removeviewfield('" + n + "')"); } catch { /* ignore */ }
  }
  // 不足列を追加
  current = (await spGet(lt(target) + '/defaultview/viewfields')).Items || [];
  for (const n of desired) {
    if (!current.includes(n)) {
      try { await spPost(lt(target) + "/defaultview/viewfields/addviewfield('" + n + "')"); } catch { /* 追加不可の組込列はスキップ */ }
    }
  }
  // 指定順に並べる(ビューに無い列はスキップ)
  for (let i = 0; i < desired.length; i++) {
    try {
      await spPost(lt(target) + '/defaultview/viewfields/moveviewfieldto', { field: desired[i], index: i });
    } catch { /* ignore */ }
  }

  // SP標準フォーム: FieldLinks の全体順(管理対象以外は現状維持で先頭、管理対象を末尾)
  const managedSet = new Set(orderedManaged);
  const cts = await spGet(lt(target) + "/contenttypes?$select=StringId");
  const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
  if (!ct) return;
  const links = await spGet(lt(target) + "/contenttypes('" + ct.StringId + "')/fieldlinks?$select=Name");
  const names = (links.value || []).map((f) => f.Name);
  const ordered = names.filter((n) => !managedSet.has(n))
    .concat(orderedManaged.filter((n) => names.includes(n)));
  await spReorderContentTypeFields(target, ordered);
}
