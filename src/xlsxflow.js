// Excel エクスポート / インポート(同一フォーマットで往復)。
// 形式(組織区分1ごとに1シート、横=利用者 / 縦=項目):
//   1行目: 組織区分1 | <名前>
//   2行目: 利用者名 | 利用者ごとの列…(右に空列があり、新しい利用者を追記できる)
//   会社名 / メールアドレス / 権限(ドロップダウン) / 更新内容(ドロップダウン) /
//   組織区分2のすべて / 以降は組織区分2を1行ずつ並べ、付与する欄に ✓
// インポートは「更新内容」で動きが決まる:
//   変更なし=何もしない / 追加=新規登録 / 更新=メール(無ければ利用者名)で突合して更新 /
//   削除=論理削除(システム削除=ON)
// 罫線・色・ドロップダウンは xlsx.js の固定スタイル/入力規則で付与する。

const XLSX_LBL_L1 = '組織区分1';
const XLSX_LBL_NAME = '利用者名';
const XLSX_LBL_COMP = '会社名';
const XLSX_LBL_MAIL = 'メールアドレス';
const XLSX_LBL_PERM = '権限';
const XLSX_LBL_ACTION = '更新内容';
const XLSX_LBL_L2ALL = LABEL_L2 + 'のすべて';
const XLSX_ACTIONS = ['変更なし', '追加', '削除', '更新'];
const XLSX_CHECK = '✓';
const XLSX_EXTRA_COLS = 3; // 新しい利用者を追記できるよう右側に空けておく列数

const xlsxIsCheck = (s) => /^(✓|✔|○|◯|レ|1|true|はい)$/i.test(String(s == null ? '' : s).trim());

// ---- エクスポート -------------------------------------------------------

// Excel のシート名に使えない文字を避けて31文字に収める(重複は連番を付ける)
function xlsxSheetName(title, used) {
  let base = String(title).replace(/[\\/?*:[\]]/g, '_').slice(0, 31) || 'シート';
  let name = base;
  let n = 2;
  while (used.has(name)) {
    const suf = '(' + n + ')';
    name = base.slice(0, 31 - suf.length) + suf;
    n++;
  }
  used.add(name);
  return name;
}

// 1つの組織区分1 → シート定義(行列+スタイル+ドロップダウン)
function xlsxSheetForL1(state, l1) {
  const users = state.users
    .filter((u) => (u.OrgLevel1 || '') === l1.Title && u.SystemDeleted !== true)
    .sort((a, b) => a.Id - b.Id);
  const l2list = activeL2Of(state, l1.Title);
  const cols = users.length + XLSX_EXTRA_COLS;
  const label = (v) => ({ v, s: XST_LABEL });
  const head = (v) => ({ v, s: XST_HEAD });
  const cellRow = (vals, style) => {
    const row = [];
    for (let i = 0; i < cols; i++) row.push({ v: vals ? (vals[i] != null ? vals[i] : '') : '', s: style });
    return row;
  };
  const rows = [];
  rows.push([label(XLSX_LBL_L1), head(l1.Title)]);
  rows.push([label(XLSX_LBL_NAME)].concat(cellRow(users.map((u) => u.Title || ''), XST_HEAD)));
  rows.push([label(XLSX_LBL_COMP)].concat(cellRow(users.map((u) => u.Company || ''), XST_BORDER)));
  rows.push([label(XLSX_LBL_MAIL)].concat(cellRow(users.map((u) => u.Email || ''), XST_BORDER)));
  rows.push([label(XLSX_LBL_PERM)].concat(cellRow(users.map((u) => u.Permission || ''), XST_CENTER)));
  rows.push([label(XLSX_LBL_ACTION)].concat(cellRow(users.map(() => '変更なし'), XST_CENTER)));
  rows.push([label(XLSX_LBL_L2ALL)].concat(cellRow(users.map((u) => u.L2All === true ? XLSX_CHECK : ''), XST_CENTER)));
  for (const m of l2list) {
    rows.push([label(m.Title)].concat(cellRow(
      users.map((u) => (u.L2All === true || u['L2_' + m.Id] === true) ? XLSX_CHECK : ''), XST_CENTER)));
  }
  const last = xlsxColName(cols); // B 始まりで cols 列分
  return {
    rows,
    users,
    colWidths: [24].concat(Array.from({ length: cols }, () => 16)),
    freeze: 'B3',
    validations: [
      { sqref: 'B5:' + last + '5', list: state.choices.permission },
      { sqref: 'B6:' + last + '6', list: XLSX_ACTIONS },
      // チェック欄(すべて行 + 組織区分2の各行)も ✓ のリスト選択(空欄に戻すのは Delete)
      { sqref: 'B7:' + last + (7 + l2list.length), list: [XLSX_CHECK] },
    ],
  };
}

// エクスポート本体(blob を返す — テストでも使う)
function buildExportXlsx(state, l1Titles) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '-' + pad(now.getHours()) + pad(now.getMinutes());
  const used = new Set();
  const sheets = [];
  let count = 0;
  for (const t of l1Titles) {
    const l1 = state.l1.find((x) => x.Title === t);
    if (!l1) continue;
    const sh = xlsxSheetForL1(state, l1);
    count += sh.users.length;
    sheets.push({
      name: xlsxSheetName(t, used),
      rows: sh.rows,
      colWidths: sh.colWidths,
      freeze: sh.freeze,
      validations: sh.validations,
    });
  }
  return { blob: xlsxBuild(sheets), filename: LIST_USERS + '_' + stamp + '.xlsx', count };
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
      if (u.SystemDeleted === true) continue;
      const k = u.OrgLevel1 || '';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="Excelエクスポート">
          <h4>Excelエクスポート</h4>
          <span class="pr-note">出力する${esc(LABEL_L1)}を選択してください(複数可。1つにつき1シート)。
            ファイルを編集して「Excel取込」すると、各列の「更新内容」に応じて
            追加・更新・削除(論理削除)を反映できます。システム削除済みの行は出力されません。</span>
          <div class="pr-field">
            <label class="pr-check" style="display:inline-flex">
              <input type="checkbox" data-xall checked>すべて選択</label>
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
    const ok = () => {
      const titles = [...back.querySelectorAll('input[data-xl1]:checked')].map((x) => x.value);
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

// 取込計画: シート群 → {entries, adds, updates, deletes, notFound, missingL1, missingL2, skipped}
function buildXlsxImportPlan(state, sheets) {
  const entries = [];
  const missingL1 = [];
  const missingL2 = [];
  const l1Titles = new Set(state.l1.map((x) => x.Title));
  const l2Keys = new Set(state.l2.filter((x) => x.Level1).map((x) => {
    const l1 = state.l1.find((y) => y.Id === x.Level1.Id);
    return (l1 ? l1.Title : '') + ' ' + x.Title;
  }));
  let found = 0;
  for (const sh of sheets) {
    const rows = sh.rows;
    const cellAt = (r, c) => String((rows[r] && rows[r][c] != null) ? rows[r][c] : '').trim();
    if (cellAt(0, 0) !== XLSX_LBL_L1) continue; // 形式外のシートは無視
    const l1Title = cellAt(0, 1);
    if (!l1Title) continue;
    found++;
    const findRow = (lbl) => rows.findIndex((r) => String((r || [])[0] || '').trim() === lbl);
    const rName = findRow(XLSX_LBL_NAME);
    const rComp = findRow(XLSX_LBL_COMP);
    const rMail = findRow(XLSX_LBL_MAIL);
    const rPerm = findRow(XLSX_LBL_PERM);
    const rAct = findRow(XLSX_LBL_ACTION);
    const rAll = findRow(XLSX_LBL_L2ALL);
    if (rName < 0 || rPerm < 0 || rAct < 0) {
      throw new Error('シート「' + sh.name + '」の形式が想定と異なります(利用者名/権限/更新内容の行が必要)');
    }
    // 組織区分2の行(「すべて」行より下の、A列に名称がある行すべて)
    const l2rows = [];
    for (let r = (rAll >= 0 ? rAll : rAct) + 1; r < rows.length; r++) {
      const nm = String((rows[r] || [])[0] || '').trim();
      if (nm) l2rows.push({ r, name: nm });
    }
    if (l1Title && !l1Titles.has(l1Title) && !missingL1.includes(l1Title)) missingL1.push(l1Title);
    for (const x of l2rows) {
      const key = l1Title + ' ' + x.name;
      if (!l2Keys.has(key)) {
        l2Keys.add(key);
        missingL2.push({ l1: l1Title, name: x.name });
      }
    }
    const width = Math.max(0, ...rows.map((r) => (r || []).length));
    for (let c = 1; c < width; c++) {
      const name = cellAt(rName, c);
      if (!name) continue;
      entries.push({
        l1: l1Title,
        name,
        company: rComp >= 0 ? cellAt(rComp, c) : '',
        email: rMail >= 0 ? cellAt(rMail, c) : '',
        permission: cellAt(rPerm, c),
        action: cellAt(rAct, c) || '変更なし',
        l2all: rAll >= 0 && xlsxIsCheck(cellAt(rAll, c)),
        org2names: l2rows.filter((x) => xlsxIsCheck(cellAt(x.r, c))).map((x) => x.name),
      });
    }
  }
  if (!found) throw new Error('このツールのエクスポート形式のシート(A1が「' + XLSX_LBL_L1 + '」)が見つかりません');
  if (!entries.length) throw new Error('取込対象の利用者がいません(利用者名の行が空)');

  // 「更新内容」で振り分け。更新/削除はメールアドレス(無ければ利用者名)で既存行と突合
  const byEmail = new Map(state.users.filter((u) => u.Email).map((u) => [u.Email.toLowerCase(), u]));
  const byName = new Map(state.users.map((u) => [u.Title, u]));
  const adds = [];
  const updates = [];
  const deletes = [];
  const notFound = [];
  let skipped = 0;
  for (const e of entries) {
    if (e.action === '追加') {
      adds.push(e);
    } else if (e.action === '更新' || e.action === '削除') {
      const u = (e.email && byEmail.get(e.email.toLowerCase())) || byName.get(e.name);
      if (!u) notFound.push(e);
      else if (e.action === '削除') {
        if (u.SystemDeleted === true) skipped++;
        else deletes.push({ e, u });
      } else updates.push({ e, u });
    } else {
      skipped++; // 変更なし(および想定外の値)
    }
  }
  return { entries, adds, updates, deletes, notFound, missingL1, missingL2, skipped };
}

// 取込列 → リストアイテムのボディ。更新時は前回チェックのクリアも含める。
// 「更新内容」は取込の動作指定であり、リストの変更区分には書かない(新規追加のみ既定値を入れる)
function buildXlsxBody(state, e, existing) {
  const body = {
    Title: e.name,
    Company: e.company,
    Email: e.email,
    Permission: e.permission,
    OrgLevel1: e.l1,
    L2All: e.l2all,
  };
  if (!existing) {
    body.ChangeType = state.choices.changeType.includes('新規') ? '新規' : state.choices.changeType[0];
    body.SystemDeleted = false;
  }
  const l1 = state.l1.find((x) => x.Title === e.l1);
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

// 既存行と取込列に差分があるときだけ更新する(Modified の無駄な更新を避ける)
function xlsxRowChanged(state, e, u) {
  const body = buildXlsxBody(state, e, u);
  for (const [k, v] of Object.entries(body)) {
    const cur = (k.startsWith('L2_') || k === 'L2All') ? u[k] === true : (u[k] || '');
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
            (差分なし ${plan.updates.length - changedCount}件はスキップ) /
            論理削除 <code>${plan.deletes.length}件</code>
            ${plan.skipped ? ' / 変更なし ' + plan.skipped + '件' : ''}</div>
          ${plan.adds.length ? `<span class="pr-note">追加: ${names(plan.adds, (x) => x.name)}</span>` : ''}
          ${plan.deletes.length ? `<span class="pr-note">論理削除(システム削除=ONになります):
            ${names(plan.deletes, (x) => x.u.Title)}</span>` : ''}
          ${plan.notFound.length ? `<span class="pr-note" style="color:var(--danger)">
            ⚠ 更新/削除の対象が見つからない列 ${plan.notFound.length}件(スキップされます):
            ${names(plan.notFound, (x) => x.name)}</span>` : ''}
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
