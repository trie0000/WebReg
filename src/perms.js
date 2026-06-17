// 行レベル権限: 組織区分1ごとに SP 権限グループを割り当て、
// 利用者一覧の各アイテムへ行単位のアクセス権として反映する。
//   - 割当グループには「投稿」ロールを付与(更新=参照を含むため参照/更新は分けない)
//   - 割当は L1 マスタの PermEdit 列(グループIDのJSON配列)に保存(全員共有)。
//     旧版で PermRead に保存した分も読み込み時に統合する(保存時に PermEdit へ寄せる)
//   - 管理者グループ(全行フルコントロール)は「WebReg設定」リストに保存(設定ハブから編集)
//   - 反映: 全行の継承を解除し、既定で継承されている割当(サイトの全権限グループ等)を
//     取り除いてから [管理者=フル / 割当=投稿] のみを付与する。
//     組織区分1にグループ未割当の行は管理者グループのみアクセス可になる
//   ※ 継承解除時、実行者自身は SP の仕様でフルコントロールが自動付与される(ロックアウトしない)。
//     copyroleassignments=false でもテナント挙動の差異に備え、残った割当は明示的に削除する

const CONF_KEY_ADMIN_GROUPS = 'adminGroups';

// ---- サイトの権限グループ / ロール定義 --------------------------------

let _siteGroupsCache = null;
async function fetchSiteGroups(force) {
  if (_siteGroupsCache && !force) return _siteGroupsCache;
  const j = await spGet('/_api/web/sitegroups?$select=Id,Title&$top=999');
  _siteGroupsCache = (j.value || [])
    // SP が自動生成するシステムグループ(共有リンク・制限付きアクセス)は割当対象にしない
    .filter((g) => !/^(SharingLinks\.|Limited Access System Group)/.test(g.Title))
    .sort((a, b) => a.Title.localeCompare(b.Title, 'ja'));
  return _siteGroupsCache;
}

// 読み取り(RoleTypeKind 2) / 投稿(3、無ければ編集 6) / フルコントロール(5)
async function fetchPermRoles() {
  const j = await spGet('/_api/web/roledefinitions?$select=Id,Name,RoleTypeKind');
  const defs = j.value || [];
  const byKind = (k) => defs.find((d) => d.RoleTypeKind === k);
  const read = byKind(2);
  const edit = byKind(3) || byKind(6);
  const full = byKind(5);
  if (!read || !edit || !full) {
    throw new Error('サイトのロール定義(読み取り/投稿/フルコントロール)を取得できません');
  }
  return { read, edit, full };
}

// ---- 設定の保存・読込 ---------------------------------------------------

const parseGroupIds = (s) => {
  try {
    const a = JSON.parse(s || '[]');
    return Array.isArray(a) ? a.map(Number).filter((n) => n > 0) : [];
  } catch { return []; }
};

// L1 の割当グループID(旧版の PermRead 保存分も統合して返す)
const permGroupIdsOf = (l1) =>
  [...new Set(parseGroupIds(l1.PermEdit).concat(parseGroupIds(l1.PermRead)))];

// L1 マスタに割当保存用の列を用意(冪等)
async function ensurePermColumns() {
  await ensureField(LIST_L1, 'PermEdit', '権限グループ', { FieldTypeKind: 3 });
}

// 共有設定リスト(キー/値)。管理者グループの保存先
async function ensureConfList() {
  await ensureList(LIST_CONF, 'WebReg の共有設定(キー/値)');
  await ensureField(LIST_CONF, 'Value', '値', { FieldTypeKind: 3 });
}

async function getConfItem(key) {
  if (!(await listId(LIST_CONF))) return null;
  const j = await spGet(lt(LIST_CONF) + "/items?$select=Id,Value&$filter=Title eq '" + key + "'&$top=1");
  return (j.value || [])[0] || null;
}

async function loadAdminGroupIds() {
  try {
    const it = await getConfItem(CONF_KEY_ADMIN_GROUPS);
    return it ? parseGroupIds(it.Value) : [];
  } catch { return []; }
}

async function saveAdminGroupIds(ids) {
  await ensureConfList();
  const it = await getConfItem(CONF_KEY_ADMIN_GROUPS);
  const body = { Title: CONF_KEY_ADMIN_GROUPS, Value: JSON.stringify(ids) };
  if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', body);
  else await spPost(lt(LIST_CONF) + '/items', body);
}

// L1 に1件でもグループ割当があるか(行単位の自動反映を行うかの判定)
const hasAnyPermConfig = (state) => state.l1.some((x) => permGroupIdsOf(x).length);

// ---- 未反映の変更の検知(フィンガープリント) ----------------------------
// 「リストへ反映」が適用した時点のマスタ/権限設定のスナップショットを
// WebReg設定リストに保存し、現在の設定と違えばマスタ管理画面に表示する

const CONF_KEY_SYNC_FP = 'syncFingerprint';

// 共有設定からまとめて読む: 管理者グループ + 反映済みスナップショット
async function loadSyncState() {
  try {
    if (!(await listId(LIST_CONF))) return { adminIds: [], fp: null };
    const j = await spGet(lt(LIST_CONF) + '/items?$select=Title,Value&$top=50');
    const map = new Map((j.value || []).map((x) => [x.Title, x.Value]));
    let fp = null;
    try { fp = JSON.parse(map.get(CONF_KEY_SYNC_FP) || 'null'); } catch { /* ignore */ }
    return { adminIds: parseGroupIds(map.get(CONF_KEY_ADMIN_GROUPS)), fp };
  } catch { return { adminIds: [], fp: null }; }
}

// part: 'master' | 'perms'。反映が成功した部分だけ更新する
async function saveSyncFp(part, value) {
  try {
    await ensureConfList();
    const it = await getConfItem(CONF_KEY_SYNC_FP);
    let fp = {};
    try { fp = JSON.parse((it && it.Value) || '{}') || {}; } catch { /* ignore */ }
    fp[part] = value;
    const body = { Title: CONF_KEY_SYNC_FP, Value: JSON.stringify(fp) };
    if (it) await spMerge(lt(LIST_CONF) + '/items(' + it.Id + ')', body);
    else await spPost(lt(LIST_CONF) + '/items', body);
  } catch { /* 記録に失敗しても反映自体は成立している */ }
}

// ---- 反映(アイテムへの権限適用) ---------------------------------------

// 反映に使う文脈(ロール定義・管理者・L1ごとの割当・実行者情報)を一度だけ組み立てる
async function buildPermContext(state) {
  const roles = await fetchPermRoles();
  const adminIds = await loadAdminGroupIds();
  const me = await spGet('/_api/web/currentuser?$select=Id,IsSiteAdmin');
  let myGroupIds = [];
  try { myGroupIds = ((await spGet('/_api/web/currentuser/groups?$select=Id')).value || []).map((g) => g.Id); }
  catch { /* 取得不可なら安全側(実行者の個別権限を維持)に倒す */ }
  // 実行者がサイト管理者 or 管理者グループのメンバーなら、グループ経由で全行にアクセスできるので
  // 個別ユーザ権限は外してよい。そうでなければ外すとロックアウトするので個別権限を残す(安全弁)
  const adminSet = new Set(adminIds);
  const keepExecutor = !(me.IsSiteAdmin || myGroupIds.some((id) => adminSet.has(id)));
  const cfgByTitle = new Map();
  for (const x of state.l1) cfgByTitle.set(x.Title, permGroupIdsOf(x));
  return { roles, adminIds, cfgByTitle, currentUserId: me.Id, keepExecutor };
}

// 1アイテムへ適用: 継承を解除し、[管理者=フル / 割当グループ=投稿] を付与してから、
// 付与したグループ以外(既定の継承グループ・継承解除で自動付与される実行者の個別権限など)を削除する。
//   - 付与を先に行うのが重要: 実行者の権限を消す前にグループを付けることで、付与の途中で実行者が
//     アイテムを見失って 400「アイテムが存在しません」になるのを防ぐ。
//   - 個別ユーザ権限は残さない(グループだけで構成)。ただし実行者がどの管理者グループにも属さない
//     場合だけは ctx.keepExecutor で個別権限を残し、自分をロックアウトしないようにする。
async function applyPermToItem(ctx, itemId, l1Title) {
  const groupIds = ctx.cfgByTitle.get(l1Title || '') || [];
  const base = lt(LIST_USERS) + '/items(' + itemId + ')';
  await spPost(base + '/breakroleinheritance(copyroleassignments=false,clearsubscopes=true)');
  // 1) 先にグループを付与する(実行者の権限を消す前に付ける)
  const assign = (gid, roleId) =>
    spPost(base + '/roleassignments/addroleassignment(principalid=' + gid + ',roledefid=' + roleId + ')');
  const keep = new Set(); // 残す principalId(付与したグループ)
  for (const gid of ctx.adminIds) {
    if (keep.has(gid)) continue;
    await assign(gid, ctx.roles.full.Id);
    keep.add(gid);
  }
  for (const gid of groupIds) {
    if (keep.has(gid)) continue;
    await assign(gid, ctx.roles.edit.Id);
    keep.add(gid);
  }
  // 2) 付与したグループ以外を削除(既定グループ・実行者の個別権限など)。付与後なのでアクセスは維持
  const current = (await spGet(base + '/roleassignments?$select=PrincipalId')).value || [];
  for (const ra of current) {
    if (keep.has(ra.PrincipalId)) continue;
    if (ctx.keepExecutor && ra.PrincipalId === ctx.currentUserId) continue; // 安全弁
    await spDelete(base + '/roleassignments/getbyprincipalid(' + ra.PrincipalId + ')');
  }
  return 'applied';
}

// 指定した行へ反映。targets: [{id, l1}]。log(msg) で進捗を出す
async function applyPermissionsToItems(state, targets, log) {
  const ctx = await buildPermContext(state);
  const summary = { applied: 0, adminOnly: 0, errors: [] };
  let done = 0;
  for (const t of targets) {
    done++;
    log('権限を反映中… (' + done + '/' + targets.length + ')');
    try {
      await applyPermToItem(ctx, t.id, t.l1);
      const hasGroups = (ctx.cfgByTitle.get(t.l1 || '') || []).length > 0;
      summary[hasGroups ? 'applied' : 'adminOnly']++;
    } catch (e) {
      summary.errors.push({ id: t.id, msg: e.message });
    }
  }
  return summary;
}

// 全アイテムへ反映(初回や全面再適用用)
async function applyPermissionsAll(state, log) {
  const items = (await spGet(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=4999')).value || [];
  return applyPermissionsToItems(state, items.map((it) => ({ id: it.Id, l1: it.OrgLevel1 })), log);
}

// 個別ユーザ権限を残さない方式に変更した版番号。旧スナップショット(この版より前に反映)では
// 既存行に実行者の個別権限が残っているため、一度だけ全行へ再適用して掃除する
const PERM_APPLY_VER = 2;

// 前回反映時のスナップショットと比べ、権限設定が変わった行だけに反映する。
// 「リストへ反映」でマスタ名や並びだけ変えたときに全件更新が走らないようにする。
//   - 管理者グループが変わった or スナップショット無し or 版が古い → 全行に適用
//   - それ以外 → 割当が変わった組織区分1の行だけに適用(変化なしなら何もしない)
// 戻り値は applyPermissionsToItems と同じ + {scanned, skipped:true(一切適用せず)}
async function applyPermissionsChanged(state, fp, adminIds, log) {
  const permsSnap = fp && typeof fp.perms === 'object' ? fp.perms : null;
  const verOk = !!(fp && fp.permsVer === PERM_APPLY_VER); // 旧版は一度だけ全行で掃除
  let targetTitles = null; // null = 全行
  if (permsSnap && verOk) {
    const oldG = new Map((permsSnap.g || []).map(([id, ids]) => [id, JSON.stringify(ids.slice().sort((a, b) => a - b))]));
    const oldAdmins = JSON.stringify((permsSnap.admins || []).slice().sort((a, b) => a - b));
    const curAdmins = JSON.stringify((adminIds || []).slice().sort((a, b) => a - b));
    if (oldAdmins === curAdmins) {
      // 管理者据え置き → 割当が変わった組織区分1だけ
      const titles = new Set();
      for (const x of state.l1) {
        const cur = JSON.stringify(permGroupIdsOf(x).slice().sort((a, b) => a - b));
        if ((oldG.get(x.Id) || '[]') !== cur) titles.add(x.Title);
      }
      targetTitles = titles;
    }
  }
  const items = (await spGet(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=4999')).value || [];
  const targets = (targetTitles === null ? items
    : items.filter((it) => targetTitles.has(it.OrgLevel1 || '')))
    .map((it) => ({ id: it.Id, l1: it.OrgLevel1 }));
  if (!targets.length) {
    return { applied: 0, adminOnly: 0, errors: [], scanned: items.length, skipped: true };
  }
  const r = await applyPermissionsToItems(state, targets, log);
  r.scanned = items.length;
  r.skipped = false;
  return r;
}

// 登録/編集直後の1行に適用(割当が1件も無ければ何もしない)。失敗は警告どまり
async function applyPermAfterWrite(state, itemId, l1Title) {
  if (!hasAnyPermConfig(state)) return;
  try {
    const ctx = await buildPermContext(state);
    await applyPermToItem(ctx, itemId, l1Title);
  } catch (e) {
    toast('warn', '行の権限設定に失敗しました(データは保存済み) — ' + e.message);
  }
}

// ---- UI: 組織区分1への権限グループ割当モーダル --------------------------

// グループ選択チェックリストの HTML(field: 'r' 参照 / 'e' 更新 / 'a' 管理者)
function permChecksHtml(field, groups, checkedIds) {
  const set = new Set(checkedIds);
  return groups.map((g) => `
    <label class="pr-check"><input type="checkbox" data-pg="${field}" value="${g.Id}"
      ${set.has(g.Id) ? 'checked' : ''}>${esc(g.Title)}</label>`).join('') ||
    '<span class="pr-note">権限グループがありません</span>';
}

const collectPermIds = (back, field) =>
  [...back.querySelectorAll('input[data-pg="' + field + '"]:checked')].map((x) => +x.value);

// 保存したら true を resolve(呼び出し側で再読込)
function openL1PermModal(state, l1) {
  return new Promise((resolve) => {
    let groups = [];
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="権限グループの割当">
          <h4>権限グループの割当 — ${esc(l1.Title)}</h4>
          <span class="pr-note">この${esc(LABEL_L1)}の行を参照・更新できる SP 権限グループを選びます
            (投稿のアクセス権を付与。更新には参照が含まれます)。反映は「権限を反映」ボタンで実行します。</span>
          <div class="pr-field">
            <label>参照・更新できるグループ</label>
            <input type="text" class="pr-input" data-pgfilter placeholder="グループ名で絞り込み" aria-label="グループ名で絞り込み">
            <div class="pr-checks pr-checks--perm" data-pglist="g"><span class="pr-note">グループを取得中…</span></div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok" disabled>保存</button>
          </div>
        </div>
      </div>`);

    // 絞り込み(チェック状態は DOM に残るため、表示だけを切り替える)
    back.querySelector('[data-pgfilter]').addEventListener('input', (ev) => {
      const q = ev.target.value.trim().toLowerCase();
      back.querySelectorAll('[data-pglist="g"] .pr-check').forEach((lb) => {
        lb.style.display = !q || lb.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    (async () => {
      try {
        groups = await fetchSiteGroups();
        // 既に付与済みのグループをリストの先頭に並べる(残りは名前順のまま)
        const assigned = new Set(permGroupIdsOf(l1));
        const sorted = [...groups].sort((a, b) =>
          (assigned.has(b.Id) ? 1 : 0) - (assigned.has(a.Id) ? 1 : 0));
        back.querySelector('[data-pglist="g"]').innerHTML =
          permChecksHtml('g', sorted, [...assigned]);
        back.querySelector('[data-mact="ok"]').disabled = false;
      } catch (e) {
        back.querySelectorAll('.pr-checks--perm').forEach((p) => {
          p.innerHTML = '<span class="pr-note">権限グループを取得できません — ' + esc(e.message) + '</span>';
        });
      }
    })();

    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const save = async () => {
      const okBtn = back.querySelector('[data-mact="ok"]');
      okBtn.disabled = true;
      try {
        await ensurePermColumns();
        const body = { PermEdit: JSON.stringify(collectPermIds(back, 'g')) };
        // 旧版の参照/更新分離で保存した分は PermEdit へ寄せて空にする(列がある場合のみ)
        if (l1.PermRead !== undefined) body.PermRead = '[]';
        await spMerge(lt(LIST_L1) + '/items(' + l1.Id + ')', body);
        auditLog('権限グループ割当', '「' + l1.Title + '」の権限グループを ' +
          collectPermIds(back, 'g').length + '件に設定');
        toast('ok', '「' + l1.Title + '」の権限グループを保存しました(反映は「リストへ反映」)');
        done(true);
      } catch (e) {
        toast('err', '保存に失敗しました — ' + e.message);
        okBtn.disabled = false; // モーダルは開いたまま再試行できる
      }
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) done(false);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? save() : done(false));
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
  });
}
