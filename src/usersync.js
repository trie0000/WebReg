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

// 選択肢→色のチップ列フォーマット(SPのモダン列書式 JSON)を生成する。
// 既知の値だけ色を付け、空欄はチップを出さない(display:none)
function chipFormatterJson(colorMap, deflt) {
  const entries = Object.entries(colorMap);
  let bg = "'" + deflt + "'";
  for (let i = entries.length - 1; i >= 0; i--) {
    bg = "if(@currentField == '" + entries[i][0] + "', '" + entries[i][1] + "', " + bg + ")";
  }
  return JSON.stringify({
    $schema: 'https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json',
    elmType: 'div',
    txtContent: '@currentField',
    style: {
      display: "=if(@currentField == '', 'none', 'inline-block')",
      padding: '1px 12px',
      'border-radius': '16px',
      'font-size': '12px',
      'font-weight': '600',
      color: '#323130',
      'background-color': '=' + bg,
    },
  });
}

// 変更区分/権限を色付きチップで表示し、読み取り専用の集計列をフォームから隠す
async function applyListFormatting(state) {
  // 変更区分: 追加系=緑 / 更新系=青 / 削除=赤 / 変更なし=灰
  const ctFmt = chipFormatterJson({
    追加: '#dff6dd', 新規: '#dff6dd',
    更新: '#cfe4fa', 変更: '#cfe4fa',
    削除: '#fde7e9',
    変更なし: '#f3f2f1',
  }, '#f3f2f1');
  // 権限: 更新者=青 / 閲覧者=灰
  const pmFmt = chipFormatterJson({ 更新者: '#cce6ff', 閲覧者: '#eef0f2' }, '#eef0f2');
  const setFmt = async (internal, json) => {
    try {
      await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + internal + "')",
        { CustomFormatter: json });
    } catch { /* 書式設定は失敗しても反映は継続 */ }
  };
  await setFmt('ChangeType', ctFmt);
  await setFmt('Permission', pmFmt);

  // 読み取り専用の集計列(統合列 OrgLevel2 + 中間列 O2S_*)を新規/編集フォームから隠す
  const calcCols = ['OrgLevel2'];
  try {
    const subs = await spGet(lt(LIST_USERS) +
      "/fields?$select=InternalName&$filter=startswith(InternalName,'O2S_')");
    for (const f of (subs.value || [])) calcCols.push(f.InternalName);
  } catch { /* ignore */ }
  for (const c of calcCols) {
    try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + c + "')/setshowinnewform(false)"); } catch { /* ignore */ }
    try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + c + "')/setshowineditform(false)"); } catch { /* ignore */ }
  }
}

// 既定ビューの表示列と並び(ユーザー指定)を明示設定し、SP標準フォーム(FieldLinks)の
// 列順を orderedManaged(組織区分1 → すべて → 集計列 → 組織区分2チェック列)に揃える。
// 既定ビュー = 利用者名/会社名/メール/変更区分/権限/組織区分1/組織区分2/特記事項/
//              システム反映日/システム削除/更新日時/更新者(個別の L2_* チェック列は出さない)
async function applyColumnOrder(orderedManaged) {
  const TITLE_ALIAS = new Set(['LinkTitle', 'Title', 'LinkTitleNoMenu']);
  const DESIRED = ['LinkTitle', 'Company', 'Email', 'ChangeType', 'Permission',
    'OrgLevel1', 'OrgLevel2', 'Notes', 'AppliedDate', 'SystemDeleted', 'Modified', 'Editor'];

  let current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];
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
        await spPost(lt(LIST_USERS) + "/defaultview/viewfields/removeviewfield('" + n + "')");
      } catch { break; /* 全部消えたら終了 */ }
    }
    await spPost(lt(LIST_USERS) + "/defaultview/viewfields/addviewfield('" + n + "')");
  }
  if (hadDupes) current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];

  // ビューにあるタイトル列の内部名(LinkTitle 既定)を使う
  const titleField = current.find((n) => TITLE_ALIAS.has(n)) || 'LinkTitle';
  const desired = DESIRED.map((n) => (n === 'LinkTitle' ? titleField : n));
  const desiredSet = new Set(desired);
  // 指定外の列(L2_*・組織区分2のすべて・中間列・改廃ステータス等)をビューから外す
  for (const n of current) {
    if (desiredSet.has(n) || TITLE_ALIAS.has(n)) continue;
    try { await spPost(lt(LIST_USERS) + "/defaultview/viewfields/removeviewfield('" + n + "')"); } catch { /* ignore */ }
  }
  // 不足列を追加
  current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];
  for (const n of desired) {
    if (!current.includes(n)) {
      try { await spPost(lt(LIST_USERS) + "/defaultview/viewfields/addviewfield('" + n + "')"); } catch { /* 追加不可の組込列はスキップ */ }
    }
  }
  // 指定順に並べる(ビューに無い列はスキップ)
  for (let i = 0; i < desired.length; i++) {
    try {
      await spPost(lt(LIST_USERS) + '/defaultview/viewfields/moveviewfieldto', { field: desired[i], index: i });
    } catch { /* ignore */ }
  }

  // SP標準フォーム: FieldLinks の全体順(管理対象以外は現状維持で先頭、管理対象を末尾)
  const managedSet = new Set(orderedManaged);
  const cts = await spGet(lt(LIST_USERS) + "/contenttypes?$select=StringId");
  const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
  if (!ct) return;
  const links = await spGet(lt(LIST_USERS) + "/contenttypes('" + ct.StringId + "')/fieldlinks?$select=Name");
  const names = (links.value || []).map((f) => f.Name);
  const ordered = names.filter((n) => !managedSet.has(n))
    .concat(orderedManaged.filter((n) => names.includes(n)));
  await spReorderContentTypeFields(LIST_USERS, ordered);
}
