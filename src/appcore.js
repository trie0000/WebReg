// アプリ実行時の共有コア: state(画面の状態とSPから読んだデータ) / データ読込 / アイテム操作 /
// 直列実行(run)とステータス表示。フロー(userflows/ioflows/masteractions)と main がこれを使う。
// 画面の器(root/app)と描画関数は main が bindAppShell で渡す(core から main への逆参照を作らない)

const state = {
  view: 'users',   // 'users' | 'reqs' | 'compare' | 'master'(既定は利用者一覧)
  l1: [],          // [{Id, Title, SortOrder, Active}]
  l2: [],          // [{Id, Title, SortOrder, Active, Level1:{Id}}]
  selectedL1: null, // Id
  ready: false,      // マスタリストが存在するか
  usersReady: false, // 利用者一覧リストが存在するか
  users: [],         // 利用者一覧のアイテム
  choices: { changeType: CHANGE_TYPE_DEFAULTS, permission: PERMISSION_DEFAULTS },
  busy: false,
};

let _shellRoot = null;
let _shellApp = null;
let _render = () => {};
function bindAppShell(root, app, render) {
  _shellRoot = root;
  _shellApp = app;
  _render = render;
}
const appRender = () => _render();
const appEl = () => _shellApp;

// ---------------------------------------------------------------- data
async function checkReady() {
  state.ready = !!(await listId(LIST_L1)) && !!(await listId(LIST_L2));
  state.usersReady = !!(await listId(LIST_USERS));
}

// 組織区分2の読込。lookup(Level1)を $expand する場合は $select に Level1/Id を明示する必要がある(実機要件)。
// 一方 TitleEn(英語名)列は英語機能より前の既存リストには無く、明示すると 400 になる。
// そこで TitleEn 付きで試し、無い列で 400 になったら TitleEn を外して再取得する(両構文とも実機で確実に通る)。
async function loadL2() {
  const sel = (en) => lt(LIST_L2) + '/items?$select=Id,Title,' + (en ? 'TitleEn,' : '') +
    'SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=5000';
  try { return await spGetAll(sel(true)); } catch { return await spGetAll(sel(false)); }
}

async function loadAll() {
  const [r1, r2, ru] = await Promise.all([
    // $select=* : 権限グループ割当列(PermRead/PermEdit。未作成でも可)も読む
    spGetAll(lt(LIST_L1) + '/items?$select=*&$orderby=SortOrder,Id&$top=5000'),
    loadL2(),
    state.usersReady ? spGetAll(usersAllPath()) : Promise.resolve([]),
  ]);
  state.l1 = r1;
  state.l2 = r2;
  state.users = ru;
  if (state.usersReady) {
    try {
      // 列が無い場合に 400 を出さないよう $filter で照会(実機の罠: 404 ではなく 400)
      const fr = await spGet(lt(LIST_USERS) +
        "/fields?$select=TypeAsString&$filter=InternalName eq 'OrgLevel2'");
      const t = ((fr.value || [])[0] || {}).TypeAsString;
      state.org2Mode = (t === 'Text' || t === 'Note') ? 'text' : 'calc';
    } catch {
      state.org2Mode = 'calc';
    }
    try {
      const [ct, pm] = await Promise.all([
        spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('ChangeType')?$select=Choices"),
        spGet(lt(LIST_USERS) + "/fields/getbyinternalnameortitle('Permission')?$select=Choices"),
      ]);
      let pmChoices = (pm.Choices && pm.Choices.length) ? pm.Choices : PERMISSION_DEFAULTS;
      // 廃止した「参照者」は、使っている行が無ければツールの選択肢にも出さない
      // (リスト側の選択肢は「リストへ反映」時に自動で掃除される)
      if (!state.users.some((u) => u.Permission === '参照者')) {
        pmChoices = pmChoices.filter((x) => x !== '参照者');
        if (!pmChoices.length) pmChoices = PERMISSION_DEFAULTS;
      }
      state.choices = {
        changeType: (ct.Choices && ct.Choices.length) ? ct.Choices : CHANGE_TYPE_DEFAULTS,
        permission: pmChoices,
      };
    } catch { /* 既定値のまま */ }
  }
  if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
  if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;

  // 未反映の変更の検知(前回「リストへ反映」した時点のスナップショットと比較)
  state.syncDiff = null;
  state.syncFp = null;
  // 組織区分1ごとの利用者リスト振り分け(日本語/英語/両方)を共通設定から読む
  try { state.listAssign = await loadListAssign(); } catch { state.listAssign = {}; }

  if (state.usersReady) {
    let ss = await loadSyncState();
    // スナップショットが未記録/旧形式(masterが文字列等)なら、現在のマスタを
    // ベースラインとして一度だけ記録する。これで以後の編集が「未反映」として
    // 検知・破棄できるようになる(旧バージョンからの移行時の救済)
    if (!ss.fp || typeof ss.fp.master !== 'object') {
      try {
        await saveSyncFp('master', computeMasterSnap(state));
        await saveSyncFp('perms', computePermsSnap(state, ss.adminIds));
        ss = await loadSyncState();
      } catch { /* 記録に失敗してもバナー表示は続行 */ }
    }
    state.adminGroupIds = ss.adminIds;
    state.syncFp = ss.fp;
    state.syncDiff = diffSyncState(state, ss.adminIds, ss.fp);
  }
}

const nextOrder = (items) => items.reduce((m, x) => Math.max(m, x.SortOrder || 0), 0) + 10;
const addItem = (listTitle, body) => spPost(lt(listTitle) + '/items', body);
const updateItem = (listTitle, id, body) => spMerge(lt(listTitle) + '/items(' + id + ')', body);
const deleteItem = (listTitle, id) => spDelete(lt(listTitle) + '/items(' + id + ')');

// 並び順の入れ替え。SortOrder が未設定/重複の行があれば全体を振り直してから入れ替える
async function moveItem(listTitle, items, item, dir) {
  const idx = items.indexOf(item);
  const j = idx + dir;
  if (j < 0 || j >= items.length) return;
  const orders = items.map((x) => x.SortOrder);
  const broken = orders.some((o, i) => o == null || orders.indexOf(o) !== i);
  if (broken) {
    for (let i = 0; i < items.length; i++) {
      items[i].SortOrder = (i + 1) * 10;
      await updateItem(listTitle, items[i].Id, { SortOrder: items[i].SortOrder });
    }
  }
  const a = items[idx], b = items[j];
  await updateItem(listTitle, a.Id, { SortOrder: b.SortOrder });
  await updateItem(listTitle, b.Id, { SortOrder: a.SortOrder });
}

function setStatus(msg) {
  const f = _shellRoot && _shellRoot.querySelector('.pr-status');
  if (f) f.textContent = msg;
  progressFeed(msg); // 実行中なら進捗モーダルにも反映(件数付きはバー+残り時間)
  if (isDebug()) console.log('[WebReg] status:', msg);
}

// 参照系(更新を伴わない)操作。操作ログには残さない
const AUDIT_SKIP = new Set(['読込', '再読込']);
// run() に渡す監査メモ。fn 内で auditNote(text) を呼ぶとその操作のログ内容になる
let _auditNote = '';
const auditNote = (text) => { _auditNote = text; };

// 操作を直列化しつつ busy 表示。エラーは右上トーストに出す(コピー可)。
// 更新系の操作は成功時に操作ログ(SPリスト)へ best-effort で記録する
async function run(label, fn) {
  if (state.busy) return;
  state.busy = true;
  _shellApp.style.opacity = '0.55';
  _shellApp.style.pointerEvents = 'none';
  progressArm(label); // 0.6秒以上かかる処理は進捗モーダルを表示
  setStatus(label + '…');
  _auditNote = '';
  try {
    if (isDebug()) console.log('[WebReg] ' + label + ' 開始');
    await fn();
    setStatus(label + ' 完了');
    if (!AUDIT_SKIP.has(label)) auditLog(label, _auditNote); // 記録は待たない(best-effort)
  } catch (e) {
    console.error('[WebReg] ' + label + ' 失敗:', e);
    setStatus('エラー: ' + e.message);
    toast('err', label + 'に失敗しました — ' + e.message);
  } finally {
    progressDone();
    state.busy = false;
    _shellApp.style.opacity = '';
    _shellApp.style.pointerEvents = '';
  }
}

async function reload() {
  await checkReady();
  if (state.ready) await loadAll();
  appRender();
}
