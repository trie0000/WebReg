// 「リストへ反映」: 組織区分マスタを「利用者一覧」リストの列・選択肢・集計式に反映する。
//
// 列形式(ユーザー指定):
//   組織区分第1階層 = 選択肢(Choice)列 OrgLevel1。選択肢 = 有効な第1階層マスタ
//   第2階層        = 有効なマスタ1件につき はい/いいえ列(内部名 L2_<マスタID> — 改名しても安定)
//   組織区分第2階層 = 集計(Calculated)列 OrgLevel2。「☑欧州/☐北米/…」形式で表示
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

  // 組織区分1: 選択肢列を有効マスタで更新
  log(LABEL_L1 + 'の選択肢を更新中…');
  await setChoices(LIST_USERS, 'OrgLevel1', LABEL_L1, activeL1.map((x) => x.Title), false);

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

  // 集計列: 組織区分1の値で分岐し、その配下の組織区分2だけを ☑/☐ で連結する式に更新
  // (行ごとに自分の組織区分1に紐づく組織だけが表示される。並び替えもここで追従)
  log('集計列(' + LABEL_L2 + ')を更新中…');
  // 組織区分1ごとの分岐は「ネストIF」ではなく相互排他なIFの連結にする。
  // ネストだと組織区分1の数だけ入れ子が深くなり、SPのIF入れ子上限(約19)で
  // 式の作成が失敗する(組織数の多い実データで顕在化)。連結なら深さは常に一定
  const terms = [];
  for (const l1 of activeL1) {
    const kids = activeL2.filter((x) => x.Level1.Id === l1.Id);
    if (!kids.length) continue;
    const perCheck = kids.map((x) => 'IF([' + displayOf(x) + '],"☑","☐")&"' + displayOf(x) + '"')
      .join('&" / "&');
    const allChecked = '"' + kids.map((x) => '☑' + displayOf(x)).join(' / ') + '"';
    terms.push('IF([' + LABEL_L1 + ']="' + safeTitle(l1.Title) +
      '",IF([組織区分2のすべて],' + allChecked + ',' + perCheck + '),"")');
  }
  const formula = terms.length ? '=' + terms.join('&') : '=""';
  // 集計列の方式: 通常は計算列(式)。式が SP の長さ上限(約8千文字)を超える規模では
  // ツールが値を書き込むテキスト列へ自動移行する(SPフォームからは非表示)
  let org2Type = '';
  try {
    org2Type = (await spGet(lt(LIST_USERS) +
      "/fields/getbyinternalnameortitle('OrgLevel2')?$select=TypeAsString")).TypeAsString || '';
  } catch { /* 未作成 */ }

  if (org2Type === 'Text') {
    summary.org2Mode = 'text'; // 既にテキスト方式へ移行済み
  } else {
    try {
      if (!org2Type) {
        const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
          " ResultType='Text' ReadOnly='TRUE'><Formula>=\"\"</Formula>" +
          "<FieldRefs><FieldRef Name='OrgLevel1'/><FieldRef Name='L2All'/></FieldRefs></Field>";
        await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
        await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2 });
      }
      await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: LABEL_L2, Formula: formula });
      summary.org2Mode = 'calc';
    } catch (e) {
      // 式が上限超過など → テキスト列へ移行
      log(LABEL_L2 + '列をテキスト方式へ移行中…');
      try {
        await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')");
        await ensureField(LIST_USERS, 'OrgLevel2', LABEL_L2, { FieldTypeKind: 2 });
        // SP標準フォームには出さない(値はツールが書き込む)
        try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowinnewform(false)"); } catch { /* ignore */ }
        try { await spPost(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')/setshowineditform(false)"); } catch { /* ignore */ }
        summary.org2Mode = 'text';
        summary.org2Migrated = '集計式が上限を超えるため(' + formula.length + '文字)、' +
          LABEL_L2 + '列をツールが書き込むテキスト列に切替えました';
      } catch (e2) {
        summary.formulaWarn = e2.message + '(式の長さ ' + formula.length + '文字)';
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

  await addViewFields(LIST_USERS, ['OrgLevel1', 'OrgLevel2'].concat(newCols));

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

// 既定ビューの列順と、SP標準フォーム(コンテンツタイプ FieldLinks)の列順を
// orderedManaged(組織区分1 → 集計列 → 組織区分2チェック列のマスタ順)に揃える
async function applyColumnOrder(orderedManaged) {
  // 既定ビュー: 管理対象以外の列を先頭に保ち、管理対象を末尾に指定順で並べる
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
  if (hadDupes) {
    current = (await spGet(lt(LIST_USERS) + '/defaultview/viewfields')).Items || [];
  }
  const managedSet = new Set(orderedManaged);
  const baseCount = current.filter((n) => !managedSet.has(n)).length;
  const inView = orderedManaged.filter((n) => current.includes(n));
  for (let i = 0; i < inView.length; i++) {
    await spPost(lt(LIST_USERS) + '/defaultview/viewfields/moveviewfieldto',
      { field: inView[i], index: baseCount + i });
  }
  // SP標準フォーム: FieldLinks の全体順(管理対象以外は現状維持で先頭、管理対象を末尾)
  const cts = await spGet(lt(LIST_USERS) + "/contenttypes?$select=StringId");
  const ct = (cts.value || []).find((c) => c.StringId.indexOf('0x01') === 0);
  if (!ct) return;
  const links = await spGet(lt(LIST_USERS) + "/contenttypes('" + ct.StringId + "')/fieldlinks?$select=Name");
  const names = (links.value || []).map((f) => f.Name);
  const ordered = names.filter((n) => !managedSet.has(n))
    .concat(orderedManaged.filter((n) => names.includes(n)));
  await spReorderContentTypeFields(LIST_USERS, ordered);
}
