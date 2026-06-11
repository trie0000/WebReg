/* webreg — システム利用者の権限登録リスト 管理用 bookmarklet 本体
 *
 * 配布は loader 方式(src/loader.js → dist/bookmarklet.txt)。本体は
 * dist/webreg.bundle.js として SP のドキュメントライブラリ or ローカル開発サーバから配信。
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
    choices: { changeType: CHANGE_TYPE_DEFAULTS, permission: PERMISSION_DEFAULTS },
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
      // $select=* : 権限グループ割当列(PermRead/PermEdit。未作成でも可)も読む
      spGet(lt(LIST_L1) + '/items?$select=*&$orderby=SortOrder,Id&$top=4999'),
      spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
      state.usersReady
        ? spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999')
        : Promise.resolve({ value: [] }),
    ]);
    state.l1 = r1.value || [];
    state.l2 = r2.value || [];
    state.users = ru.value || [];
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
        state.choices = {
          changeType: (ct.Choices && ct.Choices.length) ? ct.Choices : CHANGE_TYPE_DEFAULTS,
          permission: (pm.Choices && pm.Choices.length) ? pm.Choices : PERMISSION_DEFAULTS,
        };
      } catch { /* 既定値のまま */ }
    }
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
    if (isDebug()) console.log('[WebReg] status:', msg);
  }

  // 操作を直列化しつつ busy 表示。エラーは右上トーストに出す(コピー可)
  async function run(label, fn) {
    if (state.busy) return;
    state.busy = true;
    app.style.opacity = '0.55';
    app.style.pointerEvents = 'none';
    setStatus(label + '…');
    try {
      if (isDebug()) console.log('[WebReg] ' + label + ' 開始');
      await fn();
      setStatus(label + ' 完了');
    } catch (e) {
      console.error('[WebReg] ' + label + ' 失敗:', e);
      setStatus('エラー: ' + e.message);
      toast('err', label + 'に失敗しました — ' + e.message);
    } finally {
      state.busy = false;
      app.style.opacity = '';
      app.style.pointerEvents = '';
    }
  }

  // ---------------------------------------------------------------- user flows
  // テキスト方式(集計式が上限超過の大規模データ)では、書込時に組織区分2の表示値も付与する
  function withOrg2Text(body, baseItem) {
    if (state.org2Mode !== 'text') return body;
    body.OrgLevel2 = userOrg2Text(state, Object.assign({}, baseItem || {}, body));
    return body;
  }

  // フォームでチェックした組織区分2の列が未反映なら、先にマスタを反映する(冪等)
  async function ensureCheckedL2Cols(body) {
    const l2Keys = Object.keys(body).filter((k) => k.startsWith('L2_'));
    if (!l2Keys.length) return;
    const existing = await spGet(lt(LIST_USERS) +
      "/fields?$select=InternalName&$filter=startswith(InternalName,'L2_')");
    const have = new Set((existing.value || []).map((f) => f.InternalName));
    if (l2Keys.some((k) => !have.has(k))) {
      setStatus('マスタ未反映分をリストへ反映中…');
      await syncMastersToUserList(state, setStatus);
    }
  }

  async function userAddFlow() {
    const result = await openUserForm(state, async (body) => {
      await ensureCheckedL2Cols(body);
      const j = await addItem(LIST_USERS, withOrg2Text(body));
      // 権限グループ割当があれば、登録した行に行レベル権限を即適用(失敗は警告どまり)
      if (j && j.Id) await applyPermAfterWrite(state, j.Id, body.OrgLevel1);
      return body.Title;
    });
    if (!result) return;
    run('登録', async () => {
      await reload();
      toast('ok', '「' + result + '」を登録しました');
    });
  }

  async function userEditFlow(item) {
    const result = await openUserForm(state, async (body) => {
      await ensureCheckedL2Cols(body);
      await updateItem(LIST_USERS, item.Id, withOrg2Text(body, item));
      // 組織区分1の変更で参照可能なグループが変わるため、編集後も再適用
      await applyPermAfterWrite(state, item.Id, body.OrgLevel1);
      return body.Title;
    }, item);
    if (!result) return;
    run('保存', async () => {
      await reload();
      toast('ok', '「' + result + '」を保存しました');
    });
  }

  // CSV インポート(testText を渡すとファイル選択をスキップ — テスト用)
  async function userImportFlow(testText) {
    let text = testText;
    if (text == null) {
      const file = await pickCsvFile();
      if (!file) return;
      try {
        text = decodeCsvBuffer(await file.arrayBuffer());
      } catch (e) {
        toast('err', 'ファイルの読み込みに失敗しました — ' + e.message);
        return;
      }
    }
    let plan;
    try {
      plan = buildImportPlan(state, parseCsvText(text));
    } catch (e) {
      toast('err', 'CSVの解析に失敗しました — ' + e.message);
      return;
    }
    if (!plan.targets.length) {
      toast('warn', '取り込み対象の行がありません(権限が対象外、または空データ)');
      return;
    }
    const ok = await openImportConfirmModal(plan);
    if (!ok) return;
    run('インポート', async () => {
      // 0) マスタリスト自体が無ければ初期セットアップ(冪等)
      if (!state.ready) {
        setStatus('マスタリストを作成中…');
        await setup(setStatus);
        state.ready = true;
      }
      // 1) 未登録マスタの自動登録(組織区分1 → 再読込 → 組織区分2)
      if (plan.missingL1.length || plan.missingL2.length) {
        setStatus('未登録マスタを登録中…');
        let order1 = nextOrder(state.l1);
        for (const t of plan.missingL1) {
          try {
            await addItem(LIST_L1, { Title: t, SortOrder: order1, Active: true });
          } catch (e) {
            throw new Error(LABEL_L1 + 'マスタ「' + t + '」の登録: ' + e.message);
          }
          order1 += 10;
        }
        if (plan.missingL1.length) await loadAll();
        for (const m of plan.missingL2) {
          const l1 = state.l1.find((x) => x.Title === m.l1);
          if (!l1) continue;
          const siblings = state.l2.filter((x) => x.Level1 && x.Level1.Id === l1.Id);
          try {
            await addItem(LIST_L2, { Title: m.name, SortOrder: nextOrder(siblings), Active: true, Level1Id: l1.Id });
          } catch (e) {
            throw new Error(LABEL_L2 + 'マスタ「' + m.name + '」の登録: ' + e.message);
          }
          await loadAll();
        }
      }
      // 2) 列・選択肢・集計式を反映(部分的な失敗は警告にして取込を続行)
      setStatus('マスタをリストへ反映中…');
      const sres = await syncMastersToUserList(state, setStatus);
      if (sres.org2Migrated) toast('warn', sres.org2Migrated);
      if (sres.org2Mode) state.org2Mode = sres.org2Mode;
      if (sres.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました(取込は継続) — ' + sres.formulaWarn);
      if (sres.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました(取込は継続) — ' + sres.condWarn);
      if (sres.orderWarn) toast('warn', '列の並び替えに失敗しました(取込は継続) — ' + sres.orderWarn);
      // 取込権限(閲覧者など)が選択肢に無ければ追加
      const needPerms = [...new Set(plan.targets.map((t) => t.permission))]
        .filter((pm) => !state.choices.permission.includes(pm));
      if (needPerms.length) {
        const merged = state.choices.permission.concat(needPerms);
        await setChoices(LIST_USERS, 'Permission', '権限', merged, true);
        state.choices = { changeType: state.choices.changeType, permission: merged };
      }
      // 3) 行のアップサート(キー: メールアドレス、無ければ氏名)
      const byKey = new Map(state.users.map((u) => [((u.Email || '').toLowerCase()) || u.Title, u]));
      let added = 0;
      let updated = 0;
      const rowErrors = [];
      let done = 0;
      for (const t of plan.targets) {
        done++;
        setStatus('利用者を取込中… (' + done + '/' + plan.targets.length + ')');
        try {
          const body = buildImportBody(state, t);
          const key = (t.email || '').toLowerCase() || t.name;
          const exist = byKey.get(key);
          if (exist) {
            // 取込内容に無い既存の組織区分2チェックはクリア
            for (const k of Object.keys(exist)) {
              if (k.startsWith('L2_') && exist[k] === true && !(k in body)) body[k] = false;
            }
            await updateItem(LIST_USERS, exist.Id, withOrg2Text(body, exist));
            updated++;
          } else {
            await addItem(LIST_USERS, withOrg2Text(body));
            added++;
          }
        } catch (e) {
          rowErrors.push({ name: t.name, msg: e.message });
        }
      }
      await reload();
      // 4) 権限グループ割当があれば、行レベル権限も追従させる(冪等な全行反映)
      if (hasAnyPermConfig(state)) {
        const ps = await applyPermissionsAll(state, setStatus);
        if (ps.errors.length) {
          toast('warn', '行の権限設定に失敗 ' + ps.errors.length + '件 — 最初のエラー: ' + ps.errors[0].msg);
        }
      }
      toast('ok', 'インポート完了: 追加 ' + added + '件 / 更新 ' + updated + '件' +
        (plan.skippedPerm ? '(対象外の権限 ' + plan.skippedPerm + '件はスキップ)' : ''));
      if (rowErrors.length) {
        toast('err', '取込に失敗した行 ' + rowErrors.length + '件: ' +
          rowErrors.slice(0, 5).map((x) => x.name).join('、') + (rowErrors.length > 5 ? ' ほか' : '') +
          ' — 最初のエラー: ' + rowErrors[0].msg);
      }
    });
  }

  async function userBulkFlow() {
    const ids = [...selectedUserIds];
    if (!ids.length) return;
    const changes = await openBulkModal(state, ids.length);
    if (!changes) return;
    run('一括変更', async () => {
      for (const id of ids) await updateItem(LIST_USERS, id, changes);
      await reload();
      toast('ok', ids.length + '件を一括変更しました');
    });
  }

  async function userDeleteFlow() {
    const ids = [...selectedUserIds];
    if (!ids.length) return;
    const okDel = await modal({
      title: '物理削除の確認',
      message: '選択中の ' + ids.length + '件をリストから完全に削除します。この操作は元に戻せません。' +
        '(復元できる削除は「一括変更」のシステム削除=論理削除を使ってください)',
      okLabel: '完全に削除する',
      danger: true,
    });
    if (!okDel) return;
    run('物理削除', async () => {
      for (const id of ids) await deleteItem(LIST_USERS, id);
      selectedUserIds.clear();
      await reload();
      toast('ok', ids.length + '件を削除しました');
    });
  }

  // ---------------------------------------------------------------- views
  function masterView() {
    const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
    const sel = state.l1.find((x) => x.Id === state.selectedL1);

    const permBtn = (x) => {
      const n = permGroupIdsOf(x).length;
      return `<button class="pr-btn pr-btn--icon pr-btn--icon-action${n ? ' pr-perm-on' : ''}" data-act="perm"
        aria-label="権限グループ" title="権限グループの割当${n ? '(' + n + '件)' : '(未設定)'}">${ico('key')}</button>`;
    };
    const rowHtml = (x, kind, extra) => `
      <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="上へ" title="上へ">${ico('chevron-up')}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="下へ" title="下へ">${ico('chevron-down')}</button>
        <span class="pr-name" ${kind === 'l1' ? 'data-act="select"' : ''} title="${esc(x.Title)}">${esc(x.Title)}${
          kind === 'l1' ? `<span class="pr-childcount">${l2of(x.Id).length}</span>` : ''}</span>
        <label class="pr-active" title="有効/無効">
          <input type="checkbox" data-act="active" aria-label="有効" ${x.Active !== false ? 'checked' : ''}>
        </label>
        ${kind === 'l1' ? permBtn(x) : ''}
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
        <button class="pr-btn pr-btn--secondary" data-act="sync-perms" ${state.usersReady ? '' : 'disabled'}
          title="${esc(LABEL_L1)}ごとの権限グループ割当(鍵アイコン)を各行のアクセス権として適用">${ico('key')}権限を反映</button>
        <button class="pr-btn pr-btn--primary" data-act="sync-users">${ico('sync')}リストへ反映</button>
      </div>
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L1)}</b><span class="pr-count">${state.l1.length}件</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="${esc(LABEL_L1)}の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l1" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${state.l1.map((x) =>
            rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
            '<div class="pr-empty">未登録</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>${esc(LABEL_L2)}${sel ? ' — ' + esc(sel.Title) : ''}</b>
            <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
          ${sel ? `
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称を入力">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
            <button class="pr-btn pr-btn--ghost" data-act="bulk-l2" title="複数行でまとめて追加">まとめて</button>
          </div>
          <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
            '<div class="pr-empty">未登録</div>'}</div>`
          : '<div class="pr-empty">左で' + LABEL_L1 + 'を選択してください</div>'}
        </div>
      </div>`;
  }

  function usersView() {
    return usersViewHtml(state);
  }

  function render() {
    const views = { users: usersView, master: masterView, notify: notifyViewHtml };
    const navItem = (view, label, sub) => `
      <button class="pr-nav-item${state.view === view ? ' active' : ''}" data-act="nav" data-view="${view}">
        ${label}<small>${sub}</small></button>`;

    app.innerHTML = `
      <div class="pr-topbar">
        <span class="pr-brand" aria-hidden="true">N</span><span class="pr-title">WebReg<small>利用者権限登録 管理</small></span>
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
          ${navItem('master', 'マスタ管理', LABEL_L1 + ' / ' + LABEL_L2)}
          ${navItem('notify', '通知' + (notifyUnreadCount() ? '<span class="pr-navbadge">' + notifyUnreadCount() + '</span>' : ''), 'リスト更新の検知')}
        </nav>
        <div class="pr-main">${views[state.view]()}</div>
      </div>
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'} / ${esc(BUILD)}</div>`;

    if (state.view === 'users') {
      usersAfterRender(app, state, { rerender: render, onEdit: userEditFlow });
    }
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
    if (act === 'settings') { openSettingsModal(state).then(() => run('再読込', reload)); return; }
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

    if (act === 'user-add') { userAddFlow(); return; }
    if (act === 'user-import') { userImportFlow(); return; }
    if (act === 'user-bulk') { userBulkFlow(); return; }
    if (act === 'user-del-selected') { userDeleteFlow(); return; }
    if (act === 'user-clear-sel') { selectedUserIds.clear(); render(); return; }
    if (act === 'notify-read') { notifyMarkRead(); render(); return; }

    if (act === 'sync-users') {
      const activeL1 = state.l1.filter((x) => x.Active !== false);
      const activeL1Ids = new Set(activeL1.map((x) => x.Id));
      const activeL2 = state.l2.filter((x) => x.Active !== false && x.Level1 && activeL1Ids.has(x.Level1.Id));
      if (!activeL1.length) {
        toast('warn', '有効な' + LABEL_L1 + 'がありません。先にマスタを登録してください');
        return;
      }
      const ok = await modal({
        title: 'リストへ反映',
        message: '「' + LIST_USERS + '」リスト(無ければ作成)に反映します: ' +
          LABEL_L1 + ' ' + activeL1.length + '件を選択肢に、' + LABEL_L2 + ' ' + activeL2.length +
          '件をチェック列+☑集計表示に。マスタで無効/削除した分の列は消えません(データ保全)。',
        okLabel: '反映する',
      });
      if (!ok) return;
      run('リストへ反映', async () => {
        const s = await syncMastersToUserList(state, setStatus);
        await reload();
        toast('ok', (s.createdList ? '「' + LIST_USERS + '」を作成し、' : '') +
          LABEL_L1 + ' ' + s.l1Count + '件 / ' + LABEL_L2 + ' ' + s.l2Count + '件を反映しました' +
          (s.added ? '(列追加 ' + s.added + ')' : '') + (s.renamed ? '(改名 ' + s.renamed + ')' : ''));
        if (s.orderWarn) toast('warn', '列の並び替えに一部失敗しました — ' + s.orderWarn);
        if (s.org2Migrated) toast('warn', s.org2Migrated);
        if (s.org2Mode) state.org2Mode = s.org2Mode;
        if (s.formulaWarn) toast('err', '集計列(組織区分2)の式の更新に失敗しました — ' + s.formulaWarn);
        if (s.condWarn) toast('warn', 'フォーム条件式の更新に失敗しました — ' + s.condWarn);
      });
      return;
    }

    if (act === 'sync-perms') {
      const configured = state.l1.filter((x) => permGroupIdsOf(x).length);
      if (!configured.length) {
        toast('warn', '権限グループが未割当です。' + LABEL_L1 + 'の鍵アイコンから割り当ててください');
        return;
      }
      const admins = await loadAdminGroupIds();
      if (!admins.length) {
        // 全行の継承を解除するため、管理者グループ無しだと実行者以外は誰も全行を見られなくなる
        toast('warn', '先に管理者グループを設定してください(設定 → 共通設定)。' +
          '全行の継承を解除するため、未設定だと実行者以外の管理者がアクセスできなくなります');
        return;
      }
      const ok = await modal({
        title: '権限を反映',
        message: '「' + LIST_USERS + '」の全行(' + state.users.length + '件)の権限継承を解除し、' +
          '既定で割り当たっているサイトの権限グループを取り除いた上で、' +
          '管理者グループ(' + admins.length + '件)=フルコントロール / 割当グループ=投稿(参照・更新可)のみを付与します。' +
          'グループ未割当の' + LABEL_L1 + 'の行は管理者グループのみアクセス可になります。',
        okLabel: '反映する',
      });
      if (!ok) return;
      run('権限を反映', async () => {
        const s = await applyPermissionsAll(state, setStatus);
        toast('ok', '権限を反映しました: 割当グループ+管理者 ' + s.applied + '行 / 管理者のみ ' + s.adminOnly + '行');
        if (s.errors.length) {
          toast('err', '権限設定に失敗した行 ' + s.errors.length + '件 — 最初のエラー: ' + s.errors[0].msg);
        }
      });
      return;
    }

    if (act === 'bulk-l1' || act === 'bulk-l2') {
      const isL1 = act === 'bulk-l1';
      const selL1 = state.l1.find((x) => x.Id === state.selectedL1);
      const targetLabel = isL1 ? LABEL_L1 : '「' + (selL1 ? selL1.Title : '') + '」配下の' + LABEL_L2;
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

    if (act === 'perm') {
      openL1PermModal(state, item).then((saved) => { if (saved) run('再読込', reload); });
      return;
    }

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
          toast('warn', '「' + item.Title + '」には' + LABEL_L2 + 'が ' + children.length + ' 件あります。先に' + LABEL_L2 + 'を削除してください');
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
        // 並び順は集計式・登録モーダル・リスト列順にも影響するため、利用者一覧があれば自動反映
        if (state.usersReady) {
          setStatus('並び順をリストへ反映中…');
          await syncMastersToUserList(state, setStatus);
        }
      });
    }
  });

  // ---------------------------------------------------------------- start
  render();
  run('読込', reload);
  window.__webreg = { state, build: BUILD, importCsvText: (t) => userImportFlow(t) };
  startUpdateWatcher(BUILD); // 読込元の version.txt を監視し、新版があれば更新モーダル→自動更新

  // 利用者一覧の定期ポーリング(他ユーザーの変更検知→通知)。新インスタンス起動時に旧タイマー停止
  if (window.__webregUsersPoll) clearInterval(window.__webregUsersPoll);
  const pollUsers = async () => {
    if (document.hidden || state.busy || !state.usersReady) return;
    if (root.querySelector('.pr-backdrop')) return; // モーダル操作中は触らない
    try {
      const r = await spGet(lt(LIST_USERS) + '/items?$select=*&$orderby=Id desc&$top=999');
      const next = r.value || [];
      const events = diffUsers(state.users, next);
      if (!events.length) return;
      notifyAdd(events);
      state.users = next;
      // 入力中(フォーカスが入力要素)なら再描画しない(次の操作/検知で反映)
      const ae = document.activeElement;
      if (ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
      render();
    } catch { /* 次回再試行 */ }
  };
  window.__webregUsersPoll = setInterval(pollUsers, POLL_INTERVAL);
  window.__webregPollNow = pollUsers; // テスト/手動確認用
})();
