// 行レベル権限: 組織区分1ごとに SP 権限グループ(参照/更新)を割り当て、
// 利用者一覧の各アイテムへ行単位のアクセス権として反映する。
//   - 割当は L1 マスタの PermRead / PermEdit 列(グループIDのJSON配列)に保存(全員共有)
//   - 管理者グループ(全行フルコントロール)は「WebReg設定」リストに保存(設定ハブから編集)
//   - 反映: 組織区分1に設定がある行 → 継承を解除し [管理者=フル / 更新=投稿 / 参照=読み取り]
//           設定が無い行 → 継承に戻す(リスト既定の権限のまま)
//   ※ 継承解除時、実行者自身は SP の仕様でフルコントロールが自動付与される(ロックアウトしない)

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

// L1 マスタに割当保存用の列を用意(冪等)
async function ensurePermColumns() {
  await ensureField(LIST_L1, 'PermRead', '参照グループ', { FieldTypeKind: 3 });
  await ensureField(LIST_L1, 'PermEdit', '更新グループ', { FieldTypeKind: 3 });
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
const hasAnyPermConfig = (state) => state.l1.some(
  (x) => parseGroupIds(x.PermRead).length || parseGroupIds(x.PermEdit).length);

// ---- 反映(アイテムへの権限適用) ---------------------------------------

// 反映に使う文脈(ロール定義・管理者・L1ごとの割当)を一度だけ組み立てる
async function buildPermContext(state) {
  const roles = await fetchPermRoles();
  const adminIds = await loadAdminGroupIds();
  const cfgByTitle = new Map();
  for (const x of state.l1) {
    cfgByTitle.set(x.Title, {
      read: parseGroupIds(x.PermRead),
      edit: parseGroupIds(x.PermEdit),
    });
  }
  return { roles, adminIds, cfgByTitle };
}

// 1アイテムへ適用。戻り値 'applied'(固有権限を設定) | 'inherit'(継承に戻した)
async function applyPermToItem(ctx, itemId, l1Title) {
  const cfg = ctx.cfgByTitle.get(l1Title || '');
  const base = lt(LIST_USERS) + '/items(' + itemId + ')';
  if (!cfg || (!cfg.read.length && !cfg.edit.length)) {
    await spPost(base + '/resetroleinheritance');
    return 'inherit';
  }
  // 継承を解除して割当をクリア(実行者はSPが自動でフルコントロール付与)
  await spPost(base + '/breakroleinheritance(copyroleassignments=false,clearsubscopes=true)');
  const assign = (gid, roleId) =>
    spPost(base + '/roleassignments/addroleassignment(principalid=' + gid + ',roledefid=' + roleId + ')');
  const done = new Set();
  for (const gid of ctx.adminIds) {
    await assign(gid, ctx.roles.full.Id);
    done.add(gid);
  }
  for (const gid of cfg.edit) {
    if (done.has(gid)) continue;
    await assign(gid, ctx.roles.edit.Id);
    done.add(gid);
  }
  for (const gid of cfg.read) {
    if (done.has(gid)) continue;
    await assign(gid, ctx.roles.read.Id);
  }
  return 'applied';
}

// 全アイテムへ反映。log(msg) で進捗を出す
async function applyPermissionsAll(state, log) {
  const ctx = await buildPermContext(state);
  const items = (await spGet(lt(LIST_USERS) + '/items?$select=Id,OrgLevel1&$top=4999')).value || [];
  const summary = { applied: 0, inherited: 0, errors: [] };
  let done = 0;
  for (const it of items) {
    done++;
    log('権限を反映中… (' + done + '/' + items.length + ')');
    try {
      const r = await applyPermToItem(ctx, it.Id, it.OrgLevel1);
      summary[r === 'applied' ? 'applied' : 'inherited']++;
    } catch (e) {
      summary.errors.push({ id: it.Id, msg: e.message });
    }
  }
  return summary;
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
          <span class="pr-note">この${esc(LABEL_L1)}の行に対して、割り当てた SP 権限グループへ
            参照(読み取り) / 更新(投稿) のアクセス権を付与します。反映は「権限を反映」ボタンで実行します。</span>
          <div class="pr-field">
            <label>参照できるグループ(読み取り)</label>
            <div class="pr-checks pr-checks--perm" data-pglist="r"><span class="pr-note">グループを取得中…</span></div>
          </div>
          <div class="pr-field">
            <label>更新できるグループ(投稿)</label>
            <div class="pr-checks pr-checks--perm" data-pglist="e"><span class="pr-note">グループを取得中…</span></div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok" disabled>保存</button>
          </div>
        </div>
      </div>`);

    (async () => {
      try {
        groups = await fetchSiteGroups();
        back.querySelector('[data-pglist="r"]').innerHTML =
          permChecksHtml('r', groups, parseGroupIds(l1.PermRead));
        back.querySelector('[data-pglist="e"]').innerHTML =
          permChecksHtml('e', groups, parseGroupIds(l1.PermEdit));
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
        await spMerge(lt(LIST_L1) + '/items(' + l1.Id + ')', {
          PermRead: JSON.stringify(collectPermIds(back, 'r')),
          PermEdit: JSON.stringify(collectPermIds(back, 'e')),
        });
        toast('ok', '「' + l1.Title + '」の権限グループを保存しました(反映は「権限を反映」)');
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
