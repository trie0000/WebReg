/* permreg — システム利用者の権限登録リスト 管理用 bookmarklet 本体
 *
 * 配布は loader 方式(src/loader.js → dist/bookmarklet.txt)。本体は
 * dist/permreg.bundle.js として SP のドキュメントライブラリ or ローカル開発サーバから配信。
 * 開発基準は DEVELOPMENT.md、UI 規約は CLAUDE.md と Notion「UI/デザインルール」を参照。
 */

(() => {
  'use strict';

  // 多重起動したら前のパネルを消して開き直す
  const prev = document.getElementById(ROOT_ID);
  if (prev) prev.remove();

  // ---------------------------------------------------------------- state
  const state = {
    view: 'master',  // 'users' | 'master' | 'settings'
    l1: [],          // [{Id, Title, SortOrder, Active}]
    l2: [],          // [{Id, Title, SortOrder, Active, Level1:{Id}}]
    selectedL1: null, // Id
    ready: false,      // マスタリストが存在するか
    usersReady: false, // 利用者一覧リストが存在するか
    users: [],         // 利用者一覧のアイテム
    busy: false,
  };

  function guessWebUrl() {
    try {
      if (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) {
        return window._spPageContextInfo.webAbsoluteUrl;
      }
    } catch { /* ignore */ }
    const m = location.href.match(/^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/);
    return m ? m[1] : location.origin;
  }
  setWebUrl(localStorage.getItem(LS_WEB_URL) || guessWebUrl());

  // ---------------------------------------------------------------- data
  async function checkReady() {
    state.ready = !!(await listId(LIST_L1)) && !!(await listId(LIST_L2));
    state.usersReady = !!(await listId(LIST_USERS));
  }

  async function loadAll() {
    const [r1, r2, ru] = await Promise.all([
      spGet(lt(LIST_L1) + '/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999'),
      spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
      state.usersReady
        ? spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999')
        : Promise.resolve({ value: [] }),
    ]);
    state.l1 = r1.value || [];
    state.l2 = r2.value || [];
    state.users = ru.value || [];
    if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
    if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;
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

  // ---------------------------------------------------------------- root
  const root = document.createElement('div');
  root.id = ROOT_ID;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  root.appendChild(styleEl);
  const app = document.createElement('div');
  app.className = 'pr-app';
  root.appendChild(app);
  document.body.appendChild(root);
  setRoot(root);

  function setStatus(msg) {
    const f = root.querySelector('.pr-status');
    if (f) f.textContent = msg;
  }

  // 操作を直列化しつつ busy 表示。エラーは右上トーストに出す(コピー可)
  async function run(label, fn) {
    if (state.busy) return;
    state.busy = true;
    app.style.opacity = '0.55';
    app.style.pointerEvents = 'none';
    setStatus(label + '…');
    try {
      await fn();
      setStatus(label + ' 完了');
    } catch (e) {
      setStatus('エラー: ' + e.message);
      toast('err', label + 'に失敗しました — ' + e.message);
    } finally {
      state.busy = false;
      app.style.opacity = '';
      app.style.pointerEvents = '';
    }
  }

  // ---------------------------------------------------------------- views
  function masterView() {
    const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
    const sel = state.l1.find((x) => x.Id === state.selectedL1);

    const rowHtml = (x, kind, extra) => `
      <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="上へ" title="上へ">${ico('chevron-up')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="下へ" title="下へ">${ico('chevron-down')}</button>
        <span class="pr-name" ${kind === 'l1' ? 'data-act="select"' : ''} title="${esc(x.Title)}">${esc(x.Title)}${
          kind === 'l1' ? `<span class="pr-childcount">${l2of(x.Id).length}</span>` : ''}</span>
        <label class="pr-active" title="有効/無効">
          <input type="checkbox" data-act="active" aria-label="有効" ${x.Active !== false ? 'checked' : ''}>
        </label>
        <button class="pr-btn pr-btn--icon pr-btn--icon-action" data-act="rename" aria-label="名称変更" title="名称変更">${ico('edit-2')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--icon-trash" data-act="del" aria-label="削除" title="削除">${ico('trash-2')}</button>
      </div>`;

    if (!state.ready) {
      return `
        <div class="pr-hero">
          <h4>マスタリストがまだありません</h4>
          <p>このサイトに「${esc(LIST_L1)}」と「${esc(LIST_L2)}」を作成します。</p>
          <button class="pr-btn pr-btn--primary" data-act="setup">${ico('plus')}初期セットアップ</button>
        </div>`;
    }
    return `
      <div class="pr-syncbar">
        <span>マスタの内容を「${esc(LIST_USERS)}」リストの列・選択肢・☑集計表示に反映します(無効はスキップ。列の削除はしません)</span>
        <button class="pr-btn pr-btn--primary" data-act="sync-users">${ico('sync')}リストへ反映</button>
      </div>
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>第1階層</b><span class="pr-count">${state.l1.length}件</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="第1階層の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l1" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${state.l1.map((x) =>
            rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
            '<div class="pr-empty">未登録</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>第2階層${sel ? ' — ' + esc(sel.Title) : ''}</b>
            <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
          ${sel ? `
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l2" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
            '<div class="pr-empty">未登録</div>'}</div>`
          : '<div class="pr-empty">左で第1階層を選択してください</div>'}
        </div>
      </div>`;
  }

  function usersView() {
    return usersViewHtml(state);
  }

  function render() {
    const views = { users: usersView, master: masterView };
    const navItem = (view, label, sub) => `
      <button class="pr-nav-item${state.view === view ? ' active' : ''}" data-act="nav" data-view="${view}">
        ${label}<small>${sub}</small></button>`;

    app.innerHTML = `
      <div class="pr-topbar">
        <span class="pr-title">permreg<small>利用者権限登録 管理</small></span>
        <input type="text" class="pr-input" id="pr-weburl" style="flex:1" value="${esc(getWebUrl())}"
          aria-label="SharePoint サイトURL" title="SharePoint サイトURL">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="reload" aria-label="再読込" title="再読込">${ico('refresh-cw')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="settings" aria-label="設定" title="設定(配信元 / 開発者モード)">${ico('gear')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="close" aria-label="閉じる" title="閉じる">${ico('x')}</button>
      </div>
      <div class="pr-body">
        <nav class="pr-side" aria-label="メニュー">
          <div class="pr-side-head">メニュー</div>
          ${navItem('users', '利用者一覧', '登録状況の確認ビュー')}
          ${navItem('master', 'マスタ管理', '組織区分(第1/第2階層)')}
        </nav>
        <div class="pr-main">${views[state.view]()}</div>
      </div>
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'} / ${esc(BUILD)}</div>`;
  }

  async function reload() {
    await checkReady();
    if (state.ready) await loadAll();
    render();
  }

  // ---------------------------------------------------------------- events
  app.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'pr-weburl') {
      setWebUrl(t.value.trim());
      localStorage.setItem(LS_WEB_URL, getWebUrl());
      return;
    }
    if (t.dataset.act === 'active') {
      const row = t.closest('.pr-row');
      const listTitle = row.dataset.kind === 'l1' ? LIST_L1 : LIST_L2;
      run('更新', async () => {
        await updateItem(listTitle, +row.dataset.id, { Active: t.checked });
        await reload();
      });
    }
  });

  app.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    // IME 変換確定の Enter で入力を確定させない(keyCode 229 は古い Chrome/Safari 対策)
    if (ev.isComposing || ev.keyCode === 229) return;
    if (ev.target.id === 'pr-add-l1') app.querySelector('[data-act="add-l1"]').click();
    if (ev.target.id === 'pr-add-l2') app.querySelector('[data-act="add-l2"]').click();
  });

  app.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const row = t.closest('.pr-row');
    const kind = row && row.dataset.kind;
    const id = row && +row.dataset.id;
    const listTitle = kind === 'l1' ? LIST_L1 : LIST_L2;
    const items = kind === 'l1' ? state.l1
      : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
    const item = items && items.find((x) => x.Id === id);

    if (act === 'close') { root.remove(); return; }
    if (act === 'nav') { state.view = t.dataset.view; render(); return; }
    if (act === 'settings') { openSettingsModal(); return; }
    if (act === 'reload') { run('再読込', reload); return; }
    if (act === 'setup') {
      run('セットアップ', async () => {
        await setup(setStatus);
        await reload();
        toast('ok', 'マスタリストを作成しました');
      });
      return;
    }
    if (act === 'select') { state.selectedL1 = id; render(); return; }

    if (act === 'user-add') {
      const result = await openUserForm(state, async (body) => {
        // チェックした第2階層の列がまだリストに無い場合(マスタ追加後に未反映)、
        // 先にマスタを反映してから登録する(冪等なので安全)
        const l2Keys = Object.keys(body).filter((k) => k.startsWith('L2_'));
        if (l2Keys.length) {
          const existing = await spGet(lt(LIST_USERS) +
            "/fields?$select=InternalName&$filter=startswith(InternalName,'L2_')");
          const have = new Set((existing.value || []).map((f) => f.InternalName));
          if (l2Keys.some((k) => !have.has(k))) {
            setStatus('マスタ未反映分をリストへ反映中…');
            await syncMastersToUserList(state, setStatus);
          }
        }
        await addItem(LIST_USERS, body);
        return body.Title;
      });
      if (!result) return;
      run('登録', async () => {
        await reload();
        toast('ok', '「' + result + '」を登録しました');
      });
      return;
    }

    if (act === 'sync-users') {
      const activeL1 = state.l1.filter((x) => x.Active !== false);
      const activeL1Ids = new Set(activeL1.map((x) => x.Id));
      const activeL2 = state.l2.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id));
      if (!activeL1.length) {
        toast('warn', '有効な第1階層がありません。先にマスタを登録してください');
        return;
      }
      const ok = await modal({
        title: 'リストへ反映',
        message: '「' + LIST_USERS + '」リスト(無ければ作成)に反映します: ' +
          '第1階層 ' + activeL1.length + '件を選択肢に、第2階層 ' + activeL2.length +
          '件をチェック列+☑集計表示に。マスタで無効/削除した分の列は消えません(データ保全)。',
        okLabel: '反映する',
      });
      if (!ok) return;
      run('リストへ反映', async () => {
        const s = await syncMastersToUserList(state, setStatus);
        await reload();
        toast('ok', (s.createdList ? '「' + LIST_USERS + '」を作成し、' : '') +
          '第1階層 ' + s.l1Count + '件 / 第2階層 ' + s.l2Count + '件を反映しました' +
          (s.added ? '(列追加 ' + s.added + ')' : '') + (s.renamed ? '(改名 ' + s.renamed + ')' : ''));
      });
      return;
    }

    if (act === 'bulk-l1' || act === 'bulk-l2') {
      const isL1 = act === 'bulk-l1';
      const selL1 = state.l1.find((x) => x.Id === state.selectedL1);
      const targetLabel = isL1 ? '第1階層' : '「' + (selL1 ? selL1.Title : '') + '」配下の第2階層';
      const text = await modal({
        title: 'まとめて追加 — ' + targetLabel,
        message: '1行に1件ずつ入力してください(Excel の列を貼り付けてもOK)。既存と重複する名称はスキップされます。確定は Cmd/Ctrl+Enter でも可。',
        inputValue: '',
        multiline: true,
        okLabel: '追加する',
      });
      if (text == null) return;
      const pool = isL1 ? state.l1
        : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
      const existing = new Set(pool.map((x) => x.Title));
      const names = [];
      let dup = 0;
      for (const raw of text.split(/\r?\n/)) {
        const n = raw.trim();
        if (!n) continue;
        if (existing.has(n)) { dup++; continue; }
        existing.add(n);
        names.push(n);
      }
      if (!names.length) {
        toast('warn', '追加できる名称がありません' + (dup ? '(すべて既存と重複)' : ''));
        return;
      }
      run('まとめて追加', async () => {
        let order = nextOrder(pool);
        for (const n of names) {
          const body = { Title: n, SortOrder: order, Active: true };
          if (!isL1) body.Level1Id = state.selectedL1;
          await addItem(isL1 ? LIST_L1 : LIST_L2, body);
          order += 10;
        }
        await reload();
        toast('ok', names.length + '件追加しました' + (dup ? '(' + dup + '件は重複のためスキップ)' : ''));
      });
      return;
    }

    if (act === 'add-l1' || act === 'add-l2') {
      const input = app.querySelector(act === 'add-l1' ? '#pr-add-l1' : '#pr-add-l2');
      const name = input.value.trim();
      if (!name) return;
      const pool = act === 'add-l1' ? state.l1
        : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
      if (pool.some((x) => x.Title === name)) {
        toast('warn', '「' + name + '」は既に登録されています');
        return;
      }
      run('追加', async () => {
        const body = { Title: name, SortOrder: nextOrder(pool), Active: true };
        if (act === 'add-l2') body.Level1Id = state.selectedL1;
        await addItem(act === 'add-l1' ? LIST_L1 : LIST_L2, body);
        await reload();
        toast('ok', '「' + name + '」を追加しました');
      });
      return;
    }

    if (!item) return;

    if (act === 'rename') {
      const name = await modal({ title: '名称変更', inputValue: item.Title, okLabel: '保存' });
      if (!name || name === item.Title) return;
      run('名称変更', async () => {
        await updateItem(listTitle, id, { Title: name });
        await reload();
      });
    } else if (act === 'del') {
      if (kind === 'l1') {
        const children = state.l2.filter((x) => x.Level1 && x.Level1.Id === id);
        if (children.length) {
          toast('warn', '「' + item.Title + '」には第2階層が ' + children.length + ' 件あります。先に第2階層を削除してください');
          return;
        }
      }
      const okDel = await modal({
        title: '削除の確認',
        message: '「' + item.Title + '」を削除します。この操作は元に戻せません。',
        okLabel: '削除する',
        danger: true,
      });
      if (!okDel) return;
      run('削除', async () => {
        await deleteItem(listTitle, id);
        await reload();
        toast('ok', '「' + item.Title + '」を削除しました');
      });
    } else if (act === 'up' || act === 'down') {
      run('並べ替え', async () => {
        await moveItem(listTitle, items, item, act === 'up' ? -1 : 1);
        await reload();
      });
    }
  });

  // ---------------------------------------------------------------- start
  render();
  run('読込', reload);
  window.__permreg = { state, build: BUILD };
  startUpdateWatcher(BUILD); // 読込元の version.txt を監視し、新版があれば更新モーダル→自動更新
})();
