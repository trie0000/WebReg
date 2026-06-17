// バックアップ / リストア / リセット。
//   バックアップ: 管理用を含む全リストのスキーマ(集計式・条件式・書式・選択肢・ビュー順)と
//     全アイテムを1つのJSONに出力する。空のリストからでも戻せるよう、復元に必要な情報を含む。
//   リストア: マスタを復元 →「リストへ反映」でスキーマ(集計列・条件式・書式)を再構築 →
//     利用者を復元(組織区分2は名称で対応付けるためIDが変わっても正しく復元)。
//   リセット: 管理対象リストの全アイテムを削除して空にする(構造は残す)。

const BACKUP_VERSION = 1;

function backupDownload(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function pickJsonFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); inp.remove(); } };
    inp.addEventListener('change', () => settle(inp.files && inp.files[0] ? inp.files[0] : null));
    window.addEventListener('focus', () => setTimeout(() => settle(null), 500), { once: true });
    document.body.appendChild(inp);
    inp.click();
  });
}

// 1リストの内容(列定義・ビュー列順・全アイテム)を取得。存在しなければ null
async function dumpList(title) {
  if (!(await listId(title))) return null;
  const fields = (await spGet(lt(title) +
    '/fields?$select=InternalName,Title,TypeAsString,Formula,ClientValidationFormula,' +
    'CustomFormatter,Choices,DefaultValue,Hidden,ReadOnlyField&$filter=Hidden eq false')).value || [];
  let view = [];
  try { view = (await spGet(lt(title) + '/defaultview/viewfields')).Items || []; } catch { /* ignore */ }
  const items = (await spGet(lt(title) + '/items?$select=*&$top=5000')).value || [];
  return {
    name: title,
    fields: fields.map((f) => ({
      internal: f.InternalName, title: f.Title, type: f.TypeAsString,
      formula: f.Formula || null, condition: f.ClientValidationFormula || null,
      formatter: f.CustomFormatter || null, choices: f.Choices || null,
      defaultValue: f.DefaultValue || null,
    })),
    view, items,
  };
}

// 全リストをまとめてバックアップ(stamp は呼び出し側で渡す — スクリプト内で時刻取得不可のため)
async function buildBackup(state, stamp) {
  const lists = {};
  for (const [key, title] of [['l1', LIST_L1], ['l2', LIST_L2], ['users', LIST_USERS],
    ['conf', LIST_CONF], ['audit', LIST_AUDIT], ['common', LIST_COMMON]]) {
    lists[key] = await dumpList(title);
  }
  return { version: BACKUP_VERSION, exportedAt: stamp || '', prefix: listPrefix(), lists };
}

// ---- リセット ----------------------------------------------------------

// 管理対象リストのアイテムを削除して空にする(構造は残す)。
//   既定: 利用者データ(利用者一覧 / 英語版利用者一覧)のみ削除し、マスタは残す。
//   opts.includeMasters=true: 組織区分マスタ(第1/第2階層)も削除し、利用者一覧の派生列も一掃する。
//   操作ログ・共通設定は常に残す(監査の連続性のため。QAM のデータリセットと同様)。
async function resetAllItems(log, opts) {
  const includeMasters = !!(opts && opts.includeMasters);
  const targets = [['利用者一覧', LIST_USERS], ['英語版利用者一覧', LIST_USERS_EN]];
  if (includeMasters) targets.push([LABEL_L2, LIST_L2], [LABEL_L1, LIST_L1]); // 子→親の順で削除
  const summary = {};
  for (const [label, title] of targets) {
    if (!(await listId(title))) { summary[label] = 0; continue; }
    const items = (await spGet(lt(title) + '/items?$select=Id&$top=5000')).value || [];
    let n = 0;
    for (const it of items) {
      log(label + 'を空にしています… (' + (++n) + '/' + items.length + ')');
      try { await spDelete(lt(title) + '/items(' + it.Id + ')'); } catch { /* ignore */ }
    }
    summary[label] = items.length;
  }
  // マスタごと消す場合は、旧マスタID由来の派生列(L2_*/O2S_*/OrgLevel2)を一掃して
  // 次回の「リストへ反映」で表示名重複が起きないようにする
  if (includeMasters) {
    log('派生列を整理中…');
    try { await dropDerivedUserColumns(); } catch { /* ignore */ }
  }
  return summary;
}

// リセット範囲の選択モーダル。resolve: { includeMasters } | null
function openResetModal() {
  return new Promise((resolve) => {
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="リストのリセット">
          <h4>リストのリセット</h4>
          <span class="pr-note">SP 上のリストのアイテムを削除して空にします(リストの構造は残ります)。
            この操作は元に戻せません。先に「バックアップ取得」を推奨します。操作ログ・共通設定は残ります。</span>
          <div class="pr-field" style="margin-top:var(--s-3)">
            <label class="pr-check"><input type="radio" name="rst-mode" value="users" checked>
              利用者データのみ削除(マスタは残す)</label>
            <span class="pr-note" style="margin-left:24px">利用者一覧 / 英語版利用者一覧を空にします。${esc(LABEL_L1)}・${esc(LABEL_L2)}マスタは保持。</span>
            <label class="pr-check" style="margin-top:var(--s-2)"><input type="radio" name="rst-mode" value="all">
              マスタも含めて全削除</label>
            <span class="pr-note" style="margin-left:24px">利用者データに加えて${esc(LABEL_L1)}・${esc(LABEL_L2)}マスタも削除し、派生列も一掃します。</span>
          </div>
          <label class="pr-check" style="margin-top:var(--s-3)"><input type="checkbox" id="rst-confirm">
            上記を理解し、削除を実行します</label>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--danger" data-mact="ok" disabled>削除を実行</button>
          </div>
        </div>
      </div>`);
    const okBtn = back.querySelector('[data-mact="ok"]');
    back.querySelector('#rst-confirm').addEventListener('change', (e) => { okBtn.disabled = !e.target.checked; });
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) { if (downOnBack) done(null); return; }
      const b = e.target.closest('[data-mact]');
      if (!b) return;
      if (b.dataset.mact !== 'ok') { done(null); return; }
      if (!back.querySelector('#rst-confirm').checked) return;
      const mode = back.querySelector('input[name="rst-mode"]:checked').value;
      done({ includeMasters: mode === 'all' });
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
  });
}

// ---- リストア(replay 方式) --------------------------------------------

// バックアップJSON から復元する。空のリストからでも完全な状態に戻す。
async function restoreBackup(state, backup, log, reflectFn) {
  if (!backup || !backup.lists) throw new Error('バックアップ形式が不正です');
  const L = backup.lists;

  // 1) マスタリストを作成(冪等)
  log('マスタリストを準備中…');
  await setup(log);

  // 2) 組織区分1 を復元(既存と重複しない Title のみ追加)
  log(LABEL_L1 + 'を復元中…');
  const curL1 = (await spGet(lt(LIST_L1) + '/items?$select=Id,Title')).value || [];
  const l1ByTitle = new Map(curL1.map((x) => [x.Title, x.Id]));
  const oldL1IdToTitle = new Map((L.l1 ? L.l1.items : []).map((x) => [x.Id, x.Title]));
  for (const x of (L.l1 ? L.l1.items : [])) {
    if (l1ByTitle.has(x.Title)) continue;
    const body = { Title: x.Title, SortOrder: x.SortOrder || 0, Active: x.Active !== false };
    if (x.PermEdit) body.PermEdit = x.PermEdit;
    if (x.PermRead) body.PermRead = x.PermRead;
    const j = await spPost(lt(LIST_L1) + '/items', body);
    l1ByTitle.set(x.Title, j.Id);
  }

  // 3) 組織区分2 を復元(親は名称で対応付け)
  log(LABEL_L2 + 'を復元中…');
  const curL2 = (await spGet(lt(LIST_L2) + '/items?$select=Id,Title,Level1/Id&$expand=Level1')).value || [];
  const l2Key = (parentTitle, title) => parentTitle + ' ' + title;
  const l2Have = new Set(curL2.map((x) => {
    const pt = x.Level1 ? [...l1ByTitle.entries()].find(([, id]) => id === x.Level1.Id) : null;
    return l2Key(pt ? pt[0] : '', x.Title);
  }));
  const oldL2 = (L.l2 ? L.l2.items : []);
  const oldL2IdInfo = new Map(); // oldL2Id → {parentTitle, title}
  for (const x of oldL2) {
    const parentTitle = oldL1IdToTitle.get(x.Level1Id || (x.Level1 && x.Level1.Id)) || '';
    oldL2IdInfo.set(x.Id, { parentTitle, title: x.Title });
    if (l2Have.has(l2Key(parentTitle, x.Title))) continue;
    const newParentId = l1ByTitle.get(parentTitle);
    if (!newParentId) continue;
    await spPost(lt(LIST_L2) + '/items', {
      Title: x.Title, SortOrder: x.SortOrder || 0, Active: x.Active !== false, Level1Id: newParentId,
    });
    l2Have.add(l2Key(parentTitle, x.Title));
  }

  // 4) 旧マスタID由来の派生列(L2_*/O2S_*/集計列)を削除してから「リストへ反映」で再構築。
  //    リセットは列を残すため、旧 L2_<旧ID> 列が残っていると新列と表示名が重複し集計式が曖昧になる
  log('派生列を整理中…');
  await dropDerivedUserColumns();
  log('スキーマを再構築中…');
  await loadAllForRestore(state);
  await reflectFn(state, log); // = syncMastersToUserList。集計列・条件式・書式・L2_<新ID>列を再生成

  // 5) 利用者を復元(組織区分2は名称で対応付けて L2_<新ID> に展開)
  log('利用者を復元中…');
  // 新しい (親名称, 組織区分2名称) → L2_<新ID> 列名
  const newL2 = (await spGet(lt(LIST_L2) + '/items?$select=Id,Title,Level1/Id&$expand=Level1')).value || [];
  const l1IdToTitle = new Map([...l1ByTitle.entries()].map(([t, id]) => [id, t]));
  const l2ColByKey = new Map(newL2.map((x) =>
    [l2Key(x.Level1 ? l1IdToTitle.get(x.Level1.Id) : '', x.Title), 'L2_' + x.Id]));
  const users = (L.users ? L.users.items : []);
  let restored = 0;
  for (const u of users) {
    log('利用者を復元中… (' + (++restored) + '/' + users.length + ')');
    const body = {
      Title: u.Title, Company: u.Company || '', Email: u.Email || '',
      ChangeType: u.ChangeType || '', Permission: u.Permission || '', OrgLevel1: u.OrgLevel1 || '',
      Notes: u.Notes || '', SystemDeleted: u.SystemDeleted === true, L2All: u.L2All === true,
      WorkStatus: u.WorkStatus || WORK_STATUS_DEFAULT,
    };
    // 旧 L2_<旧ID>=true を 名称経由で 新 L2_<新ID> にマップ
    for (const k of Object.keys(u)) {
      if (!k.startsWith('L2_') || u[k] !== true) continue;
      const info = oldL2IdInfo.get(+k.slice(3));
      if (!info) continue;
      const col = l2ColByKey.get(l2Key(info.parentTitle, info.title));
      if (col) body[col] = true;
    }
    try { await spPost(lt(LIST_USERS) + '/items', body); } catch { /* 1件失敗しても続行 */ }
  }

  // 6) 共通設定 / 管理者グループ / フィンガープリント を復元
  log('設定を復元中…');
  try {
    for (const it of (L.conf ? L.conf.items : [])) {
      if (it.Title && it.Value != null) await setConfValue(it.Title, it.Value);
    }
    for (const it of (L.common ? L.common.items : [])) {
      if (it.Title && it.Value != null) await setCommonSetting(it.Title, it.Value);
    }
  } catch { /* ignore */ }

  return { l1: l1ByTitle.size, users: restored };
}

// 利用者一覧の派生列(組織区分2チェック L2_* / 中間集計 O2S_* / 統合集計 OrgLevel2)を削除する。
// 反映で作り直すため。旧マスタID由来の重複列を一掃する用途
async function dropDerivedUserColumns() {
  if (!(await listId(LIST_USERS))) return;
  for (const pre of ['L2_', 'O2S_']) {
    const fields = (await spGet(lt(LIST_USERS) +
      "/fields?$select=InternalName&$filter=startswith(InternalName,'" + pre + "')")).value || [];
    for (const f of fields) {
      try { await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('" + f.InternalName + "')"); } catch { /* ignore */ }
    }
  }
  try { await spDelete(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('OrgLevel2')"); } catch { /* ignore */ }
}

// リストア中にマスタだけ読み直す(loadAll は users 等も触るため軽量版)
async function loadAllForRestore(state) {
  const [r1, r2] = await Promise.all([
    spGet(lt(LIST_L1) + '/items?$select=*&$orderby=SortOrder,Id&$top=4999'),
    spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
  ]);
  state.l1 = r1.value || [];
  state.l2 = r2.value || [];
}

// WebReg設定リスト(LIST_CONF)のキー/値を更新(adminGroups / syncFingerprint 用)
async function setConfValue(key, value) {
  await ensureList(LIST_CONF, 'WebReg の設定');
  await ensureField(LIST_CONF, 'Value', '値', { FieldTypeKind: 3 });
  const j = await spGet(lt(LIST_CONF) + "/items?$select=Id&$filter=Title eq '" + key + "'&$top=1");
  const it = (j.value || [])[0];
  if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', { Title: key, Value: value });
  else await spPost(lt(LIST_CONF) + '/items', { Title: key, Value: value });
}
