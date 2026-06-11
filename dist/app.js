/* permreg — システム利用者の権限登録リスト 管理用 bookmarklet
 *
 * フェーズ1: 組織区分マスタ(第1階層/第2階層)の管理UI。
 * SharePoint サイトのページ上で実行し、REST API でマスタリストを作成・編集する。
 *
 * 作成されるリスト:
 *   組織区分第1階層マスタ … Title(名称) / SortOrder(並び順) / Active(有効)
 *   組織区分第2階層マスタ … Title(名称) / Level1(第1階層への参照) / SortOrder / Active
 */
(() => {
  'use strict';

  const PANEL_ID = 'permreg-panel';
  const LS_KEY = 'permreg.webUrl';
  const LIST_L1 = '組織区分第1階層マスタ';
  const LIST_L2 = '組織区分第2階層マスタ';

  // 多重起動したら前のパネルを消して開き直す
  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  // ---------------------------------------------------------------- state
  const state = {
    webUrl: '',
    l1: [],          // [{Id, Title, SortOrder, Active}]
    l2: [],          // [{Id, Title, SortOrder, Active, Level1:{Id}}]
    selectedL1: null, // Id
    ready: false,    // マスタリストが存在するか
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
  state.webUrl = localStorage.getItem(LS_KEY) || guessWebUrl();

  // ---------------------------------------------------------------- REST
  const webUrl = () => state.webUrl.replace(/\/+$/, '');
  let _digest = null; // {value, exp}

  async function getDigest() {
    if (_digest && Date.now() < _digest.exp) return _digest.value;
    const r = await fetch(webUrl() + '/_api/contextinfo', {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'same-origin',
    });
    if (!r.ok) throw new Error('contextinfo の取得に失敗 (HTTP ' + r.status + ')。サイトURLを確認してください。');
    const j = await r.json();
    _digest = {
      value: j.FormDigestValue,
      exp: Date.now() + Math.max(60, (j.FormDigestTimeoutSeconds || 1800) - 60) * 1000,
    };
    return _digest.value;
  }

  async function sp(method, path, body, headers) {
    const h = Object.assign({ Accept: 'application/json;odata=nometadata' }, headers);
    if (method !== 'GET') {
      h['X-RequestDigest'] = await getDigest();
      if (body != null) h['Content-Type'] = 'application/json;odata=nometadata';
    }
    const r = await fetch(webUrl() + path, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: h,
      credentials: 'same-origin',
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try {
        const j = await r.json();
        const m = (j['odata.error'] && j['odata.error'].message && j['odata.error'].message.value)
          || (j.error && j.error.message && (j.error.message.value || j.error.message));
        if (m) msg += ' — ' + m;
      } catch { /* ignore */ }
      const e = new Error(msg);
      e.status = r.status;
      throw e;
    }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const spGet = (p) => sp('GET', p);
  const spPost = (p, b) => sp('POST', p, b);
  const spMerge = (p, b) => sp('POST', p, b, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
  const spDelete = (p) => sp('POST', p, null, { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' });
  const lt = (title) => "/_api/web/lists/getbytitle('" + encodeURIComponent(title.replace(/'/g, "''")) + "')";

  // ---------------------------------------------------------------- setup
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

  async function fieldExists(title, internal) {
    try {
      await spGet(lt(title) + "/fields/getbyinternalnameortitle('" + internal + "')?$select=Id");
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
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

    log('セットアップ完了 ✓');
  }

  // ---------------------------------------------------------------- data
  async function checkReady() {
    state.ready = !!(await listId(LIST_L1)) && !!(await listId(LIST_L2));
  }

  async function loadAll() {
    const [r1, r2] = await Promise.all([
      spGet(lt(LIST_L1) + '/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999'),
      spGet(lt(LIST_L2) + '/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999'),
    ]);
    state.l1 = r1.value || [];
    state.l2 = r2.value || [];
    if (state.selectedL1 && !state.l1.some((x) => x.Id === state.selectedL1)) state.selectedL1 = null;
    if (!state.selectedL1 && state.l1.length) state.selectedL1 = state.l1[0].Id;
  }

  const nextOrder = (items) => items.reduce((m, x) => Math.max(m, x.SortOrder || 0), 0) + 10;

  async function addItem(listTitle, body) {
    await spPost(lt(listTitle) + '/items', body);
  }
  async function updateItem(listTitle, id, body) {
    await spMerge(lt(listTitle) + '/items(' + id + ')', body);
  }
  async function deleteItem(listTitle, id) {
    await spDelete(lt(listTitle) + '/items(' + id + ')');
  }

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

  // ---------------------------------------------------------------- UI
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const css = `
#${PANEL_ID}{position:fixed;top:0;right:0;width:760px;max-width:96vw;height:100vh;z-index:2147483000;
  background:#fff;color:#222;border-left:1px solid #c8c8c8;box-shadow:-4px 0 16px rgba(0,0,0,.25);
  font:13px/1.5 "Segoe UI","Yu Gothic UI","Hiragino Sans",sans-serif;display:flex;flex-direction:column}
#${PANEL_ID} *{box-sizing:border-box}
#${PANEL_ID} header{display:flex;gap:8px;align-items:center;padding:10px 12px;background:#0b5cab;color:#fff}
#${PANEL_ID} header b{font-size:14px;white-space:nowrap}
#${PANEL_ID} header input{flex:1;min-width:120px;border:none;border-radius:3px;padding:4px 8px;font-size:12px}
#${PANEL_ID} .pr-btn{border:1px solid #aaa;background:#f5f5f5;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:12px;white-space:nowrap}
#${PANEL_ID} .pr-btn:hover{background:#e8e8e8}
#${PANEL_ID} .pr-btn.pri{background:#0b5cab;border-color:#0b5cab;color:#fff}
#${PANEL_ID} .pr-btn.pri:hover{background:#094d8f}
#${PANEL_ID} .pr-btn.warn{color:#b00020}
#${PANEL_ID} .pr-body{flex:1;display:flex;min-height:0}
#${PANEL_ID} .pr-col{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid #ddd}
#${PANEL_ID} .pr-col:last-child{border-right:none}
#${PANEL_ID} .pr-col h3{margin:0;padding:8px 12px;font-size:13px;background:#f0f4f8;border-bottom:1px solid #ddd}
#${PANEL_ID} .pr-add{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #eee}
#${PANEL_ID} .pr-add input{flex:1;border:1px solid #bbb;border-radius:3px;padding:4px 8px}
#${PANEL_ID} .pr-rows{flex:1;overflow:auto}
#${PANEL_ID} .pr-row{display:flex;gap:6px;align-items:center;padding:6px 12px;border-bottom:1px solid #f0f0f0;cursor:default}
#${PANEL_ID} .pr-row.sel{background:#e7f1fb}
#${PANEL_ID} .pr-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
#${PANEL_ID} .pr-row .nm .cnt{color:#888;font-size:11px}
#${PANEL_ID} .pr-row.off .nm{color:#aaa;text-decoration:line-through}
#${PANEL_ID} .pr-mini{border:1px solid #ccc;background:#fafafa;border-radius:3px;width:24px;height:22px;cursor:pointer;font-size:11px;line-height:1}
#${PANEL_ID} .pr-mini:hover{background:#eee}
#${PANEL_ID} footer{padding:6px 12px;border-top:1px solid #ddd;background:#fafafa;color:#555;font-size:12px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${PANEL_ID} .pr-setup{padding:24px;text-align:center}
#${PANEL_ID} .pr-setup p{color:#555}
#${PANEL_ID} .pr-busy{opacity:.5;pointer-events:none}
`;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  document.body.appendChild(panel);

  function setStatus(msg) {
    const f = panel.querySelector('footer');
    if (f) f.textContent = msg;
  }

  // 操作を直列化しつつ busy 表示。エラーは footer + alert に出す
  async function run(label, fn) {
    if (state.busy) return;
    state.busy = true;
    panel.querySelector('.pr-body').classList.add('pr-busy');
    setStatus(label + '…');
    try {
      await fn();
      setStatus(label + ' 完了');
    } catch (e) {
      setStatus('エラー: ' + e.message);
      alert('permreg エラー:\n' + e.message);
    } finally {
      state.busy = false;
      const b = panel.querySelector('.pr-body');
      if (b) b.classList.remove('pr-busy');
    }
  }

  function render() {
    const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
    const sel = state.l1.find((x) => x.Id === state.selectedL1);

    let bodyHtml;
    if (!state.ready) {
      bodyHtml = `
        <div class="pr-setup" style="flex:1">
          <p>マスタリストがまだありません。<br>このサイトに「${esc(LIST_L1)}」「${esc(LIST_L2)}」を作成します。</p>
          <button class="pr-btn pri" data-act="setup">初期セットアップ(リスト作成)</button>
        </div>`;
    } else {
      const rowHtml = (x, kind, extra) => `
        <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
          <button class="pr-mini" data-act="up" title="上へ">▲</button>
          <button class="pr-mini" data-act="down" title="下へ">▼</button>
          <span class="nm" data-act="${kind === 'l1' ? 'select' : ''}" title="${esc(x.Title)}">${esc(x.Title)}
            ${kind === 'l1' ? `<span class="cnt">(${l2of(x.Id).length})</span>` : ''}</span>
          <label title="有効/無効"><input type="checkbox" data-act="active" ${x.Active !== false ? 'checked' : ''}></label>
          <button class="pr-mini" data-act="rename" title="名称変更">✏</button>
          <button class="pr-mini warn" data-act="del" title="削除">🗑</button>
        </div>`;

      bodyHtml = `
        <div class="pr-col">
          <h3>第1階層 (${state.l1.length}件)</h3>
          <div class="pr-add">
            <input type="text" id="pr-add-l1" placeholder="第1階層の名称を入力">
            <button class="pr-btn pri" data-act="add-l1">追加</button>
          </div>
          <div class="pr-rows">${state.l1.map((x) =>
            rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
            '<div style="padding:16px;color:#888">未登録</div>'}</div>
        </div>
        <div class="pr-col">
          <h3>第2階層 ${sel ? '— ' + esc(sel.Title) + ' (' + l2of(sel.Id).length + '件)' : ''}</h3>
          ${sel ? `
          <div class="pr-add">
            <input type="text" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称を入力">
            <button class="pr-btn pri" data-act="add-l2">追加</button>
          </div>
          <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
            '<div style="padding:16px;color:#888">未登録</div>'}</div>`
          : '<div style="padding:16px;color:#888">左で第1階層を選択してください</div>'}
        </div>`;
    }

    panel.innerHTML = `
      <style>${css}</style>
      <header>
        <b>permreg マスタ管理</b>
        <input type="text" id="pr-weburl" value="${esc(state.webUrl)}" title="SharePoint サイトURL">
        <button class="pr-btn" data-act="reload">再読込</button>
        <button class="pr-btn" data-act="close">✕</button>
      </header>
      <div class="pr-body">${bodyHtml}</div>
      <footer>${state.ready ? '準備OK' : 'マスタリスト未作成'}</footer>`;
  }

  async function reload() {
    await checkReady();
    if (state.ready) await loadAll();
    render();
  }

  // ---------------------------------------------------------------- events
  panel.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'pr-weburl') {
      state.webUrl = t.value.trim();
      localStorage.setItem(LS_KEY, state.webUrl);
      _digest = null;
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

  panel.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'pr-add-l1') panel.querySelector('[data-act="add-l1"]').click();
    if (ev.target.id === 'pr-add-l2') panel.querySelector('[data-act="add-l2"]').click();
  });

  panel.addEventListener('click', (ev) => {
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

    if (act === 'close') { panel.remove(); return; }
    if (act === 'reload') { run('再読込', reload); return; }
    if (act === 'setup') {
      run('セットアップ', async () => {
        await setup(setStatus);
        await reload();
      });
      return;
    }
    if (act === 'select') { state.selectedL1 = id; render(); return; }

    if (act === 'add-l1' || act === 'add-l2') {
      const input = panel.querySelector(act === 'add-l1' ? '#pr-add-l1' : '#pr-add-l2');
      const name = input.value.trim();
      if (!name) return;
      const pool = act === 'add-l1' ? state.l1
        : state.l2.filter((x) => x.Level1 && x.Level1.Id === state.selectedL1);
      if (pool.some((x) => x.Title === name)) { alert('「' + name + '」は既に登録されています。'); return; }
      run('追加', async () => {
        const body = { Title: name, SortOrder: nextOrder(pool), Active: true };
        if (act === 'add-l2') body.Level1Id = state.selectedL1;
        await addItem(act === 'add-l1' ? LIST_L1 : LIST_L2, body);
        await reload();
      });
      return;
    }

    if (!item) return;

    if (act === 'rename') {
      const name = prompt('新しい名称:', item.Title);
      if (!name || name.trim() === item.Title) return;
      run('名称変更', async () => {
        await updateItem(listTitle, id, { Title: name.trim() });
        await reload();
      });
    } else if (act === 'del') {
      if (kind === 'l1') {
        const children = state.l2.filter((x) => x.Level1 && x.Level1.Id === id);
        if (children.length) {
          alert('「' + item.Title + '」には第2階層が ' + children.length + ' 件あります。先に第2階層を削除してください。');
          return;
        }
      }
      if (!confirm('「' + item.Title + '」を削除しますか?')) return;
      run('削除', async () => {
        await deleteItem(listTitle, id);
        await reload();
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
})();
