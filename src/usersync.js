// 「リストへ反映」: 組織区分マスタを「利用者一覧」リストの列・選択肢・集計式に反映する。
//
// 列形式(ユーザー指定):
//   組織区分第1階層 = 選択肢(Choice)列 OrgLevel1。選択肢 = 有効な第1階層マスタ
//   第2階層        = 有効なマスタ1件につき はい/いいえ列(内部名 L2_<マスタID> — 改名しても安定)
//   組織区分第2階層 = 集計(Calculated)列 OrgLevel2。「☑欧州/◽北米/…」形式で表示
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
    await spMerge(path, { Choices: choices });
  } catch {
    // nometadata でコレクション更新を受け付けないテナント向けの verbose フォールバック
    await spMergeVerbose(path, 'SP.FieldChoice', { Choices: { results: choices } });
  }
}

async function ensureUserList(log) {
  if (await listId(LIST_USERS)) return false;
  log('「' + LIST_USERS + '」を作成中…');
  await spPost('/_api/web/lists', { Title: LIST_USERS, BaseTemplate: 100, Description: '利用者の権限登録リスト(permreg)' });
  await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Title')", { Title: '利用者名' });
  await ensureField(LIST_USERS, 'Company', '会社名', { FieldTypeKind: 2 });
  await ensureField(LIST_USERS, 'Email', 'メールアドレス', { FieldTypeKind: 2 });
  await createChoiceField(LIST_USERS, 'ChangeType', '変更区分', ['新規', '変更', '削除', '変更なし'], true);
  await createChoiceField(LIST_USERS, 'Permission', '権限', ['参照者', '更新者'], true);
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

  // 第1階層: 選択肢列を有効マスタで更新
  log('組織区分第1階層の選択肢を更新中…');
  await setChoices(LIST_USERS, 'OrgLevel1', '組織区分第1階層', activeL1.map((x) => x.Title), false);

  // 第2階層: 既存の L2_* 列を取得して 追加/改名 を判断
  log('第2階層のチェック列を更新中…');
  const existing = await spGet(lt(LIST_USERS) +
    "/fields?$select=InternalName,Title&$filter=startswith(InternalName,'L2_')");
  const byInternal = new Map((existing.value || []).map((f) => [f.InternalName, f.Title]));

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

  // 集計列: ☑/◽ を有効な第2階層の順で連結する式に更新
  log('集計列(組織区分第2階層)を更新中…');
  const formula = activeL2.length
    ? '=' + activeL2.map((x) => 'IF([' + displayOf(x) + '],"☑","◽")&"' + displayOf(x) + '"')
      .join('&"/"&')
    : '=""';
  if (!(await fieldExists(LIST_USERS, 'OrgLevel2'))) {
    const refs = activeL2.map((x) => "<FieldRef Name='L2_" + x.Id + "'/>").join('');
    const xml = "<Field Type='Calculated' DisplayName='OrgLevel2' Name='OrgLevel2' StaticName='OrgLevel2'" +
      " ResultType='Text' ReadOnly='TRUE'><Formula>" + xmlEsc(formula) + '</Formula>' +
      '<FieldRefs>' + refs + '</FieldRefs></Field>';
    await spPost(lt(LIST_USERS) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
    await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Title: '組織区分第2階層' });
  } else {
    await spMerge(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')", { Formula: formula });
  }

  await addViewFields(LIST_USERS, ['OrgLevel1', 'OrgLevel2'].concat(newCols));
  log('反映完了');
  return summary;
}
