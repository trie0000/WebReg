// マスタリストのスキーマ定義と初期セットアップ(冪等)

async function listId(title) {
  try {
    return (await spGet(lt(title) + '?$select=Id')).Id;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function ensureList(title, description) {
  const id = await listId(title);
  if (id) return id;
  const j = await spPost('/_api/web/lists', {
    Title: title,
    BaseTemplate: 100,
    Description: description,
  });
  return j.Id;
}

// ⚠ 存在しない列への getbyinternalnameortitle は 404 ではなく
// 400 (System.ArgumentException) を返すため、$filter で判定する(実機のみで顕在化)
async function fieldExists(title, internal) {
  const j = await spGet(lt(title) + "/fields?$select=Id&$filter=InternalName eq '" + internal + "'");
  return !!(j.value && j.value.length);
}

// 内部名を英語に固定するため、いったん英語名で作成してから表示名だけ日本語に変える
async function ensureField(title, internal, display, createBody) {
  if (await fieldExists(title, internal)) return;
  await spPost(lt(title) + '/fields', Object.assign({ Title: internal }, createBody));
  await spMerge(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
}

async function ensureLookupField(title, internal, display, targetListId) {
  if (await fieldExists(title, internal)) return;
  const xml = "<Field Type='Lookup' DisplayName='" + internal + "' Name='" + internal +
    "' StaticName='" + internal + "' List='{" + targetListId + "}' ShowField='Title' Required='TRUE'/>";
  await spPost(lt(title) + '/fields/createfieldasxml', { parameters: { SchemaXml: xml } });
  await spMerge(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')", { Title: display });
}

async function addViewFields(title, internals) {
  for (const f of internals) {
    try {
      await spPost(lt(title) + "/defaultview/viewfields/addviewfield('" + f + "')");
    } catch { /* 既に追加済みなら無視 */ }
  }
}

async function setup(log) {
  log('「' + LIST_L1 + '」を確認中…');
  const id1 = await ensureList(LIST_L1, '権限登録リスト用 組織区分(第1階層)マスタ');
  await ensureField(LIST_L1, 'SortOrder', '並び順', { FieldTypeKind: 9 });
  await ensureField(LIST_L1, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
  await addViewFields(LIST_L1, ['SortOrder', 'Active']);

  log('「' + LIST_L2 + '」を確認中…');
  await ensureList(LIST_L2, '権限登録リスト用 組織区分(第2階層)マスタ');
  await ensureLookupField(LIST_L2, 'Level1', '第1階層', id1);
  await ensureField(LIST_L2, 'SortOrder', '並び順', { FieldTypeKind: 9 });
  await ensureField(LIST_L2, 'Active', '有効', { FieldTypeKind: 8, DefaultValue: '1' });
  await addViewFields(LIST_L2, ['Level1', 'SortOrder', 'Active']);

  log('セットアップ完了');
}
