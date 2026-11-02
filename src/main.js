/* webreg — システム利用者の権限登録リスト 管理用 bookmarklet 本体
 *
 * 配布は loader 方式(src/loader.js → dist/bookmarklet.txt)。本体は
 * dist/webreg.bundle.js として SP のドキュメントライブラリ or ローカル開発サーバから配信。
 * 開発基準は DEVELOPMENT.md、UI 規約は CLAUDE.md と Notion「UI/デザインルール」を参照。
 * このファイルは画面の器・描画・イベント振り分け・起動だけを持つ。状態とデータ読込は appcore.js、
 * 各操作は userflows / ioflows / masteractions にある。
 */

(() => {
  'use strict';

  // 多重起動したら前のパネルを消して開き直す
  const prev = document.getElementById(ROOT_ID);
  if (prev) prev.remove();

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

  // ---------------------------------------------------------------- views
  function render() {
    const views = {
      users: () => usersViewHtml(state), master: () => masterViewHtml(state),
      reqs: () => reqViewHtml(state), compare: () => compareViewHtml(state),
      help: () => helpViewHtml(),
    };
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
          ${navItem('reqs', '改廃依頼一覧' + (reqPendingCount() ? '<span class="pr-navbadge">' + reqPendingCount() + '</span>' : ''), '実機への登録作業待ち')}
          ${navItem('compare', '実機差分チェック', '実機CSVとリストの差分')}
          ${navItem('master', 'マスタ管理', LABEL_L1 + ' / ' + LABEL_L2)}
          ${navItem('help', 'ヘルプ', '使い方')}
        </nav>
        <div class="pr-main">${views[state.view]()}</div>
      </div>
      <div class="pr-status">${state.ready ? '準備OK' : 'マスタリスト未作成'} / ${esc(BUILD)}</div>`;

    if (state.view === 'users') {
      usersAfterRender(app, state, { rerender: render, onEdit: userEditFlow });
    } else if (state.view === 'reqs') {
      reqAfterRender(app, state, { rerender: render, onEdit: userEditFlow, onStatusChange: userStatusChange });
    }
  }
  bindAppShell(root, app, render);

  // 改廃依頼(作業待ち=結果確認済み以外の対象)の件数。ナビのバッジに使う
  function reqPendingCount() {
    if (!state.usersReady) return 0;
    return state.users.filter((u) => isReqTarget(u) && reqStatusOf(u) !== WORK_STATUS_DONE).length;
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
      const kindLabel = row.dataset.kind === 'l1' ? LABEL_L1 : LABEL_L2;
      const listTitle = row.dataset.kind === 'l1' ? LIST_L1 : LIST_L2;
      run('マスタ更新', async () => {
        auditNote(kindLabel + 'マスタ(ID ' + row.dataset.id + ')を' + (t.checked ? '有効化' : '無効化'));
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

  // 行に依存しないボタン(data-act)の振り分け先
  const ACTIONS = {
    close: () => root.remove(),
    reload: () => run('再読込', reload),
    settings: () => openSettingsModal(state, { onBackup: backupFlow, onRestore: restoreFlow, onReset: resetFlow })
      .then(() => run('再読込', reload)),
    setup: setupFlow,
    'user-add': userAddFlow,
    'user-import': () => userImportFlow(),
    'user-export': userExportFlow,
    'user-import-xlsx': () => userImportXlsxFlow(),
    'compare-import': () => compareImportFlow(),
    'user-bulk': userBulkFlow,
    'user-resync': userResyncFlow,
    'user-del-selected': userDeleteFlow,
    'user-clear-sel': () => { selectedUserIds.clear(); render(); },
    'req-bulk-status': reqBulkStatusFlow,
    'req-clear-sel': () => { selectedReqIds.clear(); render(); },
    'sync-users': masterSyncFlow,
    'perm-reapply-all': permReapplyAllFlow,
    'discard-pending': discardPendingFlow,
    'bulk-l1': () => masterBulkAddFlow(true),
    'bulk-l2': () => masterBulkAddFlow(false),
    'add-l1': () => masterAddFlow(true),
    'add-l2': () => masterAddFlow(false),
  };

  app.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'nav') { state.view = t.dataset.view; render(); return; }
    if (act === 'user-open-sp') { openSpListFlow(!!t.dataset.en); return; }
    if (ACTIONS[act]) { ACTIONS[act](); return; }

    // マスタ管理の行ボタン
    const row = t.closest('.pr-row');
    if (!row) return;
    const kind = row.dataset.kind;
    const id = +row.dataset.id;
    if (act === 'select') { state.selectedL1 = id; render(); return; }
    const items = kind === 'l1' ? state.l1
      : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
    const item = items.find((x) => x.Id === id);
    if (item) masterRowAction(act, kind, item, items);
  });

  // ---------------------------------------------------------------- start
  render();
  // 共通設定リストからリスト接頭辞を取り込んでから読み込む(全員で共有・SP が正)
  run('読込', async () => {
    try { await bootstrapPrefixFromCommon(); } catch { /* リスト未作成なら端末設定のまま */ }
    await reload();
  });
  window.__webreg = {
    state,
    build: BUILD,
    importCsvText: (t) => userImportFlow(t),
    exportXlsx: (titles) => buildExportXlsx(state, titles),
    importXlsx: (buf) => userImportXlsxFlow(buf),
    compareCsvText: (t) => compareImportFlow(t),
  };
  startUpdateWatcher(BUILD); // 読込元の version.txt を監視し、新版があれば更新モーダル→自動更新

  // 利用者一覧の定期ポーリング(他ユーザーの変更を検知して再描画)。新インスタンス起動時に旧タイマー停止
  if (window.__webregUsersPoll) clearInterval(window.__webregUsersPoll);
  // 件数または各行の更新日時に変化があれば「変わった」とみなす
  const usersFingerprint = (arr) =>
    arr.length + '|' + arr.map((u) => u.Id + ':' + (u.Modified || '')).sort().join(',');
  const pollUsers = async () => {
    if (document.hidden || state.busy || !state.usersReady) return;
    if (root.querySelector('.pr-backdrop')) return; // モーダル操作中は触らない
    try {
      const next = await spGetAll(usersAllPath());
      if (usersFingerprint(state.users) === usersFingerprint(next)) return;
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
