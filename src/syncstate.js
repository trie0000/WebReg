// 未反映の変更の検知・内訳表示・破棄(巻き戻し)。
// 「リストへ反映」が成功した時点のマスタ/権限設定のスナップショットを
// WebReg設定リスト(キー syncFingerprint)に保存し、現在の設定と突き合わせる。
//   - master 部: L1/L2 の {id, 名称, 並び順, 有効, (L2は親)} — 反映/並べ替え時に保存
//   - perms 部: L1ごとの割当グループ + 管理者グループ — 権限適用の成功時に保存
// 差分は種類別(追加/名称変更/並び替え/有効・無効/移動/権限未反映/削除)に判定し、
// マスタ管理画面のバッジとバナーに出す。「破棄」はスナップショットへ書き戻す。

function computeMasterSnap(state) {
  return {
    l1: state.l1.map((x) => ({ id: x.Id, t: x.Title, o: x.SortOrder || 0, a: x.Active !== false })),
    l2: state.l2.map((x) => ({
      id: x.Id, t: x.Title, o: x.SortOrder || 0, a: x.Active !== false,
      p: x.Level1 ? x.Level1.Id : null,
    })),
  };
}

function computePermsSnap(state, adminIds) {
  return {
    g: state.l1.map((x) => [x.Id, permGroupIdsOf(x).slice().sort((a, b) => a - b)]),
    admins: (adminIds || []).slice().sort((a, b) => a - b),
  };
}

// 現在の設定とスナップショットの差分。
// 戻り値: {pending, canDiscard, l1Badges:Map(id→[種別]), l2Badges, l1Reorder, l2Reorder,
//          removed:[名称], adminsChanged, summary:[文言], masterUnknown, permsUnknown}
function diffSyncState(state, adminIds, fp) {
  const res = {
    pending: false, canDiscard: false,
    l1Badges: new Map(), l2Badges: new Map(),
    l1Reorder: false, l2Reorder: false,
    removed: [], adminsChanged: false, summary: [],
    masterUnknown: false, permsUnknown: false,
  };
  const counts = {};
  const bump = (k, n) => { counts[k] = (counts[k] || 0) + (n == null ? 1 : n); };
  const badge = (map, id, label) => {
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(label);
    bump(label);
  };

  // ---- master 部
  const masterSnap = fp && typeof fp.master === 'object' ? fp.master : null;
  if (!masterSnap) {
    res.masterUnknown = true;
    res.pending = true;
  } else {
    const cur = computeMasterSnap(state);
    const cmp = (kind, curArr, oldArr) => {
      const oldBy = new Map(oldArr.map((x) => [x.id, x]));
      const curIds = new Set(curArr.map((x) => x.id));
      const map = kind === 'l1' ? res.l1Badges : res.l2Badges;
      for (const c of curArr) {
        const o = oldBy.get(c.id);
        if (!o) { badge(map, c.id, '追加'); continue; }
        if (o.t !== c.t) badge(map, c.id, '名称変更');
        if (o.a !== c.a) badge(map, c.id, c.a ? '有効化' : '無効化');
        if (kind === 'l2' && o.p !== c.p) badge(map, c.id, '移動');
      }
      for (const o of oldArr) {
        if (!curIds.has(o.id)) {
          res.removed.push((kind === 'l1' ? LABEL_L1 : LABEL_L2) + '「' + o.t + '」');
          bump('削除');
        }
      }
      // 並び順: 双方に存在する id の相対順序で比較
      const oldOrder = oldArr.filter((x) => curIds.has(x.id)).map((x) => x.id);
      const curOrder = curArr.filter((x) => oldBy.has(x.id)).map((x) => x.id);
      return JSON.stringify(oldOrder) !== JSON.stringify(curOrder);
    };
    res.l1Reorder = cmp('l1', cur.l1, masterSnap.l1 || []);
    res.l2Reorder = cmp('l2', cur.l2, masterSnap.l2 || []);
    if (res.l1Reorder || res.l2Reorder) bump('並び替え', 0);
  }

  // ---- perms 部
  const permsSnap = fp && typeof fp.perms === 'object' ? fp.perms : null;
  const curPerms = computePermsSnap(state, adminIds);
  if (!permsSnap) {
    // 記録なし: 権限設定を使っていれば「未反映の可能性あり」として扱う
    if (state.l1.some((x) => permGroupIdsOf(x).length) || (adminIds || []).length) {
      res.permsUnknown = true;
      res.pending = true;
      for (const x of state.l1) {
        if (permGroupIdsOf(x).length) badge(res.l1Badges, x.Id, '権限未反映');
      }
    }
  } else {
    const oldG = new Map((permsSnap.g || []).map(([id, ids]) => [id, JSON.stringify(ids)]));
    for (const [id, ids] of curPerms.g) {
      if ((oldG.get(id) || '[]') !== JSON.stringify(ids)) badge(res.l1Badges, id, '権限未反映');
    }
    res.adminsChanged = JSON.stringify(curPerms.admins) !== JSON.stringify(permsSnap.admins || []);
    if (res.adminsChanged) bump('管理者グループ変更');
  }

  res.pending = res.pending || res.l1Badges.size > 0 || res.l2Badges.size > 0 ||
    res.l1Reorder || res.l2Reorder || res.removed.length > 0 || res.adminsChanged;
  // 破棄は、巻き戻し先のスナップショットが揃っているときだけ可能
  res.canDiscard = res.pending && !!masterSnap &&
    (!res.permsUnknown) && (permsSnap != null ||
      !(res.adminsChanged || [...res.l1Badges.values()].some((b) => b.includes('権限未反映'))));

  // バナー用の内訳文言
  if (res.l1Reorder || res.l2Reorder) res.summary.push('並び替え');
  for (const [k, n] of Object.entries(counts)) {
    if (k === '並び替え') continue;
    res.summary.push(k + (n > 1 ? ' ' + n + '件' : ''));
  }
  if (res.masterUnknown) res.summary.push('(前回反映の記録なし — 反映で記録されます)');
  return res;
}

// 未反映の変更を破棄してスナップショットの状態へ書き戻す。
// スナップショット後に追加された行は削除、変更された行は元の値に戻す。
// スナップショット時点に在って今は無い行は復元できない(missing で返す)
async function revertSyncState(state, fp, log) {
  const out = { reverted: 0, deleted: 0, missing: [] };
  const masterSnap = fp.master;
  const cur = computeMasterSnap(state);
  const permsSnap = (typeof fp.perms === 'object' && fp.perms) || null;
  const oldG = permsSnap ? new Map((permsSnap.g || []).map(([id, ids]) => [id, ids])) : null;

  // L2 → L1 の順(追加された L1 を消す前に、その配下の追加 L2 を消す)
  const doList = async (kind, listTitle, curArr, oldArr) => {
    const oldBy = new Map(oldArr.map((x) => [x.id, x]));
    for (const c of curArr) {
      log('変更を破棄中…');
      const o = oldBy.get(c.id);
      if (!o) {
        await spDelete(lt(listTitle) + '/items(' + c.id + ')');
        out.deleted++;
        continue;
      }
      const body = {};
      if (o.t !== c.t) body.Title = o.t;
      if ((o.o || 0) !== (c.o || 0)) body.SortOrder = o.o || 0;
      if (o.a !== c.a) body.Active = o.a;
      if (kind === 'l2' && o.p !== c.p && o.p != null) body.Level1Id = o.p;
      if (kind === 'l1' && oldG) {
        const item = state.l1.find((x) => x.Id === c.id);
        const curIds = item ? permGroupIdsOf(item).slice().sort((a, b) => a - b) : [];
        const oldIds = (oldG.get(c.id) || []).slice().sort((a, b) => a - b);
        if (JSON.stringify(curIds) !== JSON.stringify(oldIds)) {
          await ensurePermColumns();
          body.PermEdit = JSON.stringify(oldIds);
          if (item && item.PermRead !== undefined) body.PermRead = '[]';
        }
      }
      if (Object.keys(body).length) {
        await spMerge(lt(listTitle) + '/items(' + c.id + ')', body);
        out.reverted++;
      }
    }
    for (const o of oldArr) {
      if (!curArr.some((c) => c.id === o.id)) out.missing.push(o.t);
    }
  };
  await doList('l2', LIST_L2, cur.l2, masterSnap.l2 || []);
  await doList('l1', LIST_L1, cur.l1, masterSnap.l1 || []);

  // 管理者グループも戻す
  if (permsSnap) {
    const curAdmins = await loadAdminGroupIds();
    const oldAdmins = (permsSnap.admins || []).slice().sort((a, b) => a - b);
    if (JSON.stringify(curAdmins.slice().sort((a, b) => a - b)) !== JSON.stringify(oldAdmins)) {
      await saveAdminGroupIds(oldAdmins);
      out.reverted++;
    }
  }
  return out;
}
