// Excel エクスポート / インポート(同一フォーマットで往復)。
//   エクスポート: 組織区分1を複数選択 → 該当行を .xlsx で保存(+「エクスポート情報」シート)
//   インポート: 同じファイルを取込み、ID一致=更新 / ID空欄=追加 /
//               エクスポート範囲内でファイルから消えた行=論理削除(システム削除=ON)
// 形式は xlsx.js(自前の最小実装)で読み書きする。

const XLSX_SHEET_DATA = '利用者一覧';
const XLSX_SHEET_META = 'エクスポート情報';
const XLSX_META_SCOPE = 'エクスポート範囲(組織区分1)';
const XLSX_SCOPE_SEP = '／';
// ヘッダー(列順固定)。ID は SP アイテムID(更新・削除の照合キー。新規行は空欄)
const XLSX_HEADERS = ['ID', '利用者名', '会社名', 'メールアドレス', '変更区分', '権限',
  LABEL_L1, LABEL_L2 + '(全角カンマ区切り)', LABEL_L2 + 'のすべて(1=すべて)',
  '特記事項', 'システム削除(1=削除)', '更新日時(参考・取込時は無視)'];

// ---- エクスポート -------------------------------------------------------

function xlsxExportRows(state, l1Titles) {
  const scope = new Set(l1Titles);
  const rows = [XLSX_HEADERS.slice()];
  const users = state.users.filter((u) => scope.has(u.OrgLevel1 || ''));
  // 画面の既定と同じく組織区分1のマスタ順 → ID順で出す
  const orderOf = new Map(state.l1.map((x, i) => [x.Title, i]));
  users.sort((a, b) => (orderOf.get(a.OrgLevel1) ?? 999) - (orderOf.get(b.OrgLevel1) ?? 999) || a.Id - b.Id);
  for (const u of users) {
    const l2names = activeL2Of(state, u.OrgLevel1 || '')
      .filter((m) => u['L2_' + m.Id] === true).map((m) => m.Title);
    rows.push([
      u.Id,
      u.Title || '',
      u.Company || '',
      u.Email || '',
      u.ChangeType || '',
      u.Permission || '',
      u.OrgLevel1 || '',
      l2names.join('，'),
      u.L2All === true ? 1 : '',
      u.Notes || '',
      u.SystemDeleted === true ? 1 : '',
      u.Modified ? new Date(u.Modified).toLocaleString('ja-JP') : '',
    ]);
  }
  return rows;
}

function xlsxDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// 組織区分1の複数選択モーダル → 選択した titles を resolve(キャンセルは null)
function openExportModal(state) {
  return new Promise((resolve) => {
    const counts = new Map();
    for (const u of state.users) {
      const k = u.OrgLevel1 || '';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="Excelエクスポート">
          <h4>Excelエクスポート</h4>
          <span class="pr-note">出力する${esc(LABEL_L1)}を選択してください(複数可)。同じファイルを編集して
            「Excelインポート」で取り込むと、追加・更新・削除(論理削除)を反映できます。</span>
          <div class="pr-field">
            <label><label class="pr-check" style="display:inline-flex">
              <input type="checkbox" data-xall checked>すべて選択</label></label>
            <div class="pr-checks pr-checks--perm">
              ${state.l1.map((x) => `
                <label class="pr-check"><input type="checkbox" data-xl1 value="${esc(x.Title)}" checked>
                  ${esc(x.Title)}<span class="pr-childcount">${counts.get(x.Title) || 0}</span></label>`).join('') ||
                '<span class="pr-note">マスタ未登録</span>'}
            </div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">エクスポート</button>
          </div>
        </div>
      </div>`);
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const picked = () => [...back.querySelectorAll('input[data-xl1]:checked')].map((x) => x.value);
    const ok = () => {
      const titles = picked();
      if (!titles.length) {
        toast('warn', LABEL_L1 + 'を1件以上選択してください');
        return;
      }
      done(titles);
    };
    back.querySelector('[data-xall]').addEventListener('change', (e) => {
      back.querySelectorAll('input[data-xl1]').forEach((c) => { c.checked = e.target.checked; });
    });
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) done(null);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? ok() : done(null));
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok();
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
    back.querySelector('[data-mact="ok"]').focus();
  });
}

// エクスポート本体(blob を返す — テストでも使う)
function buildExportXlsx(state, l1Titles) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '-' + pad(now.getHours()) + pad(now.getMinutes());
  const blob = xlsxBuild([
    { name: XLSX_SHEET_DATA, rows: xlsxExportRows(state, l1Titles) },
    { name: XLSX_SHEET_META, rows: [
      [XLSX_META_SCOPE, l1Titles.join(XLSX_SCOPE_SEP)],
      ['エクスポート日時', now.toLocaleString('ja-JP')],
      ['リスト', LIST_USERS],
      ['形式バージョン', 1],
    ] },
  ]);
  return { blob, filename: LIST_USERS + '_' + stamp + '.xlsx' };
}

// ---- インポート ---------------------------------------------------------

function pickXlsxFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    inp.style.display = 'none';
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); inp.remove(); } };
    inp.addEventListener('change', () => settle(inp.files && inp.files[0] ? inp.files[0] : null));
    window.addEventListener('focus', () => setTimeout(() => settle(null), 500), { once: true });
    document.body.appendChild(inp);
    inp.click();
  });
}

const xlsxCell = (row, i) => String((row || [])[i] == null ? '' : row[i]).trim();
const xlsxFlag = (s) => s === '1' || s === '1.0' || /^true$/i.test(s);

// 取込計画: シート → {scope, adds, updates, deletes, missingL1, missingL2, skipped}
function buildXlsxImportPlan(state, sheets) {
  const data = sheets.find((sh) => sh.name === XLSX_SHEET_DATA) ||
    sheets.find((sh) => (sh.rows[0] || [])[0] === 'ID');
  if (!data || !data.rows.length) throw new Error('シート「' + XLSX_SHEET_DATA + '」が見つかりません');
  const header = data.rows[0].map((h) => String(h || '').trim());
  // 列順は固定だが、念のため先頭2列だけ検証する
  if (header[0] !== 'ID' || header[1] !== XLSX_HEADERS[1]) {
    throw new Error('ヘッダーが想定と異なります(このツールのエクスポート形式のみ取込可能)');
  }
  const meta = sheets.find((sh) => sh.name === XLSX_SHEET_META);
  let scope = [];
  if (meta) {
    const row = meta.rows.find((r) => String((r || [])[0]) === XLSX_META_SCOPE);
    if (row) scope = String(row[1] || '').split(XLSX_SCOPE_SEP).map((s) => s.trim()).filter(Boolean);
  }

  const entries = [];
  let skipped = 0;
  for (const r of data.rows.slice(1)) {
    const name = xlsxCell(r, 1);
    const idRaw = xlsxCell(r, 0).replace(/\.0$/, '');
    if (!name) { if (idRaw || r.some((v) => String(v || '').trim() !== '')) skipped++; continue; }
    entries.push({
      id: /^\d+$/.test(idRaw) ? +idRaw : null,
      name,
      company: xlsxCell(r, 2),
      email: xlsxCell(r, 3),
      changeType: xlsxCell(r, 4),
      permission: xlsxCell(r, 5),
      org1: xlsxCell(r, 6),
      org2names: xlsxCell(r, 7).split(/[，、,]/).map((x) => x.trim()).filter(Boolean),
      l2all: xlsxFlag(xlsxCell(r, 8)),
      notes: xlsxCell(r, 9),
      sysdel: xlsxFlag(xlsxCell(r, 10)),
    });
  }
  if (!entries.length) throw new Error('取込対象の行がありません');
  // ファイルに現れた組織区分1も削除判定の範囲に含める(メタシートが消された場合の保険)
  const scopeSet = new Set(scope.concat(entries.map((e) => e.org1).filter(Boolean)));

  // 未登録マスタの洗い出し(CSV取込と同じ流儀で自動登録できるように返す)
  const l1Titles = new Set(state.l1.map((x) => x.Title));
  const l2Keys = new Set(state.l2.filter((x) => x.Level1).map((x) => {
    const l1 = state.l1.find((y) => y.Id === x.Level1.Id);
    return (l1 ? l1.Title : '') + ' ' + x.Title;
  }));
  const missingL1 = [];
  const missingL2 = [];
  for (const e of entries) {
    if (e.org1 && !l1Titles.has(e.org1) && !missingL1.includes(e.org1)) missingL1.push(e.org1);
    for (const nm of e.org2names) {
      const key = e.org1 + ' ' + nm;
      if (!l2Keys.has(key)) {
        l2Keys.add(key);
        missingL2.push({ l1: e.org1, name: nm });
      }
    }
  }

  const byId = new Map(state.users.map((u) => [u.Id, u]));
  const fileIds = new Set(entries.map((e) => e.id).filter((x) => x != null));
  const adds = entries.filter((e) => e.id == null || !byId.has(e.id));
  const updates = entries.filter((e) => e.id != null && byId.has(e.id));
  // エクスポート範囲内でファイルから消えた行 → 論理削除(削除済みの行は対象外)
  const deletes = state.users.filter((u) =>
    scopeSet.has(u.OrgLevel1 || '') && u.SystemDeleted !== true && !fileIds.has(u.Id));
  return { entries, scope: [...scopeSet], adds, updates, deletes, missingL1, missingL2, skipped };
}

// 取込行 → リストアイテムのボディ(既存行は前回チェックのクリアも含める)
function buildXlsxBody(state, e, existing) {
  const body = {
    Title: e.name,
    Company: e.company,
    Email: e.email,
    ChangeType: e.changeType || '変更なし',
    Permission: e.permission,
    OrgLevel1: e.org1,
    Notes: e.notes,
    SystemDeleted: e.sysdel,
    L2All: e.l2all,
  };
  const l1 = state.l1.find((x) => x.Title === e.org1);
  if (l1) {
    for (const nm of e.org2names) {
      const m = state.l2.find((x) => x.Level1 && x.Level1.Id === l1.Id && x.Title === nm);
      if (m) body['L2_' + m.Id] = true;
    }
  }
  if (existing) {
    for (const k of Object.keys(existing)) {
      if (k.startsWith('L2_') && existing[k] === true && !(k in body)) body[k] = false;
    }
  }
  return body;
}

// 既存行と取込行の差分があるときだけ更新する(Modified の無駄な更新を避ける)
function xlsxRowChanged(state, e, u) {
  const body = buildXlsxBody(state, e, u);
  for (const [k, v] of Object.entries(body)) {
    const cur = k.startsWith('L2_') || k === 'L2All' || k === 'SystemDeleted'
      ? u[k] === true : (u[k] || '');
    const next = typeof v === 'boolean' ? v : (v || '');
    if (cur !== next) return true;
  }
  return false;
}

// 取込内容の確認モーダル
function openXlsxConfirmModal(plan, changedCount) {
  return new Promise((resolve) => {
    const names = (list, f) => list.slice(0, 5).map(f).map(esc).join('、') + (list.length > 5 ? ' ほか' : '');
    const missing = plan.missingL1.map((t) => esc(LABEL_L1) + ': ' + esc(t))
      .concat(plan.missingL2.map((m) => esc(LABEL_L2) + ': ' + esc(m.name) + '(' + esc(m.l1) + ')'));
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="Excelインポートの確認">
          <h4>Excelインポートの確認</h4>
          <div class="pr-kv">追加 <code>${plan.adds.length}件</code> / 更新 <code>${changedCount}件</code>
            (変更なし ${plan.updates.length - changedCount}件はスキップ) /
            論理削除 <code>${plan.deletes.length}件</code>
            ${plan.skipped ? ' / 利用者名が空の行 ' + plan.skipped + '件は無視' : ''}</div>
          ${plan.adds.length ? `<span class="pr-note">追加: ${names(plan.adds, (x) => x.name)}</span>` : ''}
          ${plan.deletes.length ? `<span class="pr-note">論理削除(ファイルに無い行。システム削除=ONになります):
            ${names(plan.deletes, (x) => x.Title)}</span>` : ''}
          <span class="pr-note">削除判定の範囲(${esc(LABEL_L1)}): ${esc(plan.scope.join(' / '))}</span>
          ${missing.length ? `
          <div class="pr-field">
            <label>マスタ未登録の組織(OK でマスタへ自動登録してから取り込みます)</label>
            <div class="pr-checks" style="display:block; max-height:140px; overflow:auto;">
              ${missing.map((m) => '<div>' + m + '</div>').join('')}
            </div>
          </div>` : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">取り込む</button>
          </div>
        </div>
      </div>`);
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) done(false);
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) done(b.dataset.mact === 'ok');
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done(true);
    };
    document.addEventListener('keydown', onKey, true);
    document.getElementById(ROOT_ID).appendChild(back);
    back.querySelector('[data-mact="ok"]').focus();
  });
}
