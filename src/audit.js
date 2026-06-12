// 操作ログ(更新作業の監査ログ)と共通設定リスト。
//   - 共通設定リスト(LIST_COMMON, 接頭辞なしの固定名): キー/値。リスト接頭辞をここに保存し、
//     起動時に参照する(全員で共有。端末ごとの localStorage ではなく SP リストが正)。
//   - 操作ログリスト(LIST_AUDIT, 接頭辞あり): 更新系の操作だけを1行ずつ記録。参照は記録しない。
//     設定画面から一覧で確認できる。

// ---- 共通設定リスト(キー/値) ------------------------------------------

async function ensureCommonList() {
  await ensureList(LIST_COMMON, 'WebReg の共通設定(全員で共有。リスト接頭辞など)');
  await ensureField(LIST_COMMON, 'Value', '値', { FieldTypeKind: 3 });
}

async function getCommonItem(key) {
  if (!(await listId(LIST_COMMON))) return null;
  const j = await spGet(lt(LIST_COMMON) + "/items?$select=Id,Value&$filter=Title eq '" + key + "'&$top=1");
  return (j.value || [])[0] || null;
}

async function getCommonSetting(key) {
  try {
    const it = await getCommonItem(key);
    return it ? (it.Value || '') : null;
  } catch { return null; }
}

async function setCommonSetting(key, value) {
  await ensureCommonList();
  const it = await getCommonItem(key);
  const body = { Title: key, Value: value };
  if (it) await spMerge(lt(LIST_COMMON) + '/items(' + it.Id + ')', body);
  else await spPost(lt(LIST_COMMON) + '/items', body);
}

// 起動時に共通設定からリスト接頭辞を読み、端末キャッシュ(localStorage)へ反映する。
// 戻り値 true: 接頭辞が変わった(呼び出し側で applyListPrefix + 再読込が必要)
async function bootstrapPrefixFromCommon() {
  const remote = await getCommonSetting('listPrefix'); // null=リスト未作成/未設定
  if (remote == null) return false;
  const cur = listPrefix();
  if (remote === cur) return false;
  try { localStorage.setItem(LS_LIST_PREFIX, remote); } catch { /* ignore */ }
  applyListPrefix();
  return true;
}

// ---- 操作ログ ----------------------------------------------------------

async function ensureAuditList() {
  if (await listId(LIST_AUDIT)) return false;
  await ensureList(LIST_AUDIT, 'WebReg の操作ログ(更新作業の記録)');
  await spMerge(lt(LIST_AUDIT) + "/fields/getbyinternalnameortitle('Title')", { Title: '操作' });
  await ensureField(LIST_AUDIT, 'ActedAt', '日時', { FieldTypeKind: 4 });
  await ensureField(LIST_AUDIT, 'Actor', '実行者', { FieldTypeKind: 2 });
  await ensureField(LIST_AUDIT, 'Detail', '内容', { FieldTypeKind: 3 });
  try { await addViewFields(LIST_AUDIT, ['ActedAt', 'Actor', 'Detail']); } catch { /* ignore */ }
  return true;
}

// 実行ユーザー名(取得できなければ空)。1セッション1回だけ問い合わせてキャッシュ
let _auditActor = null;
async function auditActor() {
  if (_auditActor != null) return _auditActor;
  try {
    const me = await spGet('/_api/web/currentuser?$select=Title,Email');
    _auditActor = me.Title || me.Email || '';
  } catch { _auditActor = ''; }
  return _auditActor;
}

// 更新系の操作を1件記録する(best-effort。失敗してもユーザー操作は止めない)
async function auditLog(action, detail) {
  try {
    await ensureAuditList();
    const actor = await auditActor();
    await spPost(lt(LIST_AUDIT) + '/items', {
      Title: action,
      ActedAt: new Date().toISOString(),
      Actor: actor,
      Detail: detail || '',
    });
  } catch (e) {
    if (isDebug()) console.warn('[WebReg] 操作ログの記録に失敗:', e.message);
  }
}

// 直近の操作ログを取得(新しい順)
async function loadAuditLog(limit) {
  if (!(await listId(LIST_AUDIT))) return [];
  const top = Math.min(Math.max(limit || 200, 1), 2000);
  const j = await spGet(lt(LIST_AUDIT) +
    '/items?$select=Title,ActedAt,Actor,Detail&$orderby=ActedAt desc,Id desc&$top=' + top);
  return j.value || [];
}

// ---- 操作ログの閲覧モーダル -------------------------------------------

function openAuditLogModal() {
  return new Promise((resolve) => {
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="操作ログ">
          <h4>操作ログ(更新作業)</h4>
          <span class="pr-note">このツールから行った更新操作の記録です(参照操作は記録されません)。新しい順に最大200件。</span>
          <div class="pr-rows" style="max-height:50vh">
            <table class="pr-utable">
              <colgroup><col style="width:140px"><col style="width:120px"><col style="width:110px"><col></colgroup>
              <thead><tr><th>日時</th><th>操作</th><th>実行者</th><th>内容</th></tr></thead>
              <tbody><tr><td colspan="4" class="pr-empty">読み込み中…</td></tr></tbody>
            </table>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          </div>
        </div>
      </div>`);
    const done = () => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve();
    };
    const fmt = (iso) => {
      const d = new Date(iso || '');
      if (isNaN(+d)) return '';
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' +
        p(d.getHours()) + ':' + p(d.getMinutes());
    };
    (async () => {
      let rows;
      try { rows = await loadAuditLog(200); } catch (e) {
        back.querySelector('tbody').innerHTML =
          '<tr><td colspan="4" class="pr-empty">取得に失敗しました — ' + esc(e.message) + '</td></tr>';
        return;
      }
      back.querySelector('tbody').innerHTML = rows.length
        ? rows.map((r) => '<tr><td>' + esc(fmt(r.ActedAt)) + '</td><td>' + esc(r.Title || '') +
            '</td><td>' + esc(r.Actor || '') + '</td><td>' + esc(r.Detail || '') + '</td></tr>').join('')
        : '<tr><td colspan="4" class="pr-empty">記録された操作ログはありません</td></tr>';
    })();
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) { if (downOnBack) done(); return; }
      if (e.target.closest('[data-mact]')) done();
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(); }
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
  });
}
