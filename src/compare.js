// 実機差分チェック: 実機の利用者情報を同じCSV形式で取り込み、SP上のリスト登録内容との
// 差分をリストアップする(読み取り専用。書き込みはしない)。
//   - リスト未登録: 実機CSVにあるが、リストに無い(=リストへ追加が必要)
//   - 実機未登録  : リストにあるが、実機CSVに無い(=実機へ登録、または論理削除が必要)
//   - 差分あり    : 両方にあるが 権限/組織区分2/会社名/在籍状態 が相違
// 突合は取込と同じく「組織区分1+メール、無ければ組織区分1+氏名」(組織区分1が違えば別人)。

// 行の組織区分2(チェック済み)の集合を返す。「すべて」フラグは全選択扱い
function spOrg2Set(state, u) {
  return activeL2Of(state, u.OrgLevel1 || '')
    .filter((m) => u.L2All === true || u['L2_' + m.Id] === true)
    .map((m) => m.Title);
}

// targets: 実機の現在状態(buildImportPlan の targets と同形)
function buildCompareResult(state, targets) {
  const active = state.users.filter((u) => u.SystemDeleted !== true);
  const idx = buildUserIndex(active);
  const rows = [];
  const matched = new Set();
  for (const t of targets) {
    const u = findExistingUser(idx, t.org1, t.email, t.name);
    if (!u) {
      rows.push({ type: 'リスト未登録', name: t.name, org1: t.org1,
        detail: '実機にあるがリストに未登録(' + (t.permission || '権限なし') + ')' });
      continue;
    }
    matched.add(u.Id);
    const d = [];
    if ((u.Permission || '') !== (t.permission || '')) {
      d.push('権限: リスト「' + (u.Permission || '空') + '」/ 実機「' + (t.permission || '空') + '」');
    }
    if ((u.Company || '') !== (t.company || '')) {
      d.push('会社名: リスト「' + (u.Company || '空') + '」/ 実機「' + (t.company || '空') + '」');
    }
    const sp = spOrg2Set(state, u).slice().sort();
    const ex = (t.org2names || []).slice().sort();
    if (JSON.stringify(sp) !== JSON.stringify(ex)) {
      const onlySp = sp.filter((x) => !ex.includes(x));
      const onlyEx = ex.filter((x) => !sp.includes(x));
      d.push(LABEL_L2 + ': ' + [onlySp.map((x) => 'リストのみ「' + x + '」').join('、'),
        onlyEx.map((x) => '実機のみ「' + x + '」').join('、')].filter(Boolean).join(' / '));
    }
    // 退職者フラグ(実機) と システム削除(リスト) の食い違い。active 限定なので u は在籍
    if (t.retired === true) d.push('在籍状態: 実機は退職、リストは有効のまま');
    if (d.length) rows.push({ type: '差分あり', name: u.Title, org1: u.OrgLevel1, detail: d.join(' / ') });
  }
  for (const u of active) {
    if (matched.has(u.Id)) continue;
    rows.push({ type: '実機未登録', name: u.Title, org1: u.OrgLevel1,
      detail: 'リストにあるが実機CSVに無い' });
  }
  // 区分→組織区分1→氏名 で安定ソート
  const rank = { '差分あり': 0, 'リスト未登録': 1, '実機未登録': 2 };
  rows.sort((a, b) => (rank[a.type] - rank[b.type]) ||
    a.org1.localeCompare(b.org1, 'ja') || a.name.localeCompare(b.name, 'ja'));
  return rows;
}

const COMPARE_TYPE_CLASS = {
  '差分あり': 'pr-cmp--diff', 'リスト未登録': 'pr-cmp--add', '実機未登録': 'pr-cmp--miss',
};

function compareViewHtml(state) {
  const res = state.compareResult;
  const head = `
    <div class="pr-syncbar">
      <span>実機の利用者情報CSV(CSVインポートと同じ形式)を取り込み、「${esc(LIST_USERS)}」リストとの差分を表示します(読み取り専用)。</span>
      <button class="pr-btn pr-btn--primary" data-act="compare-import" ${state.usersReady ? '' : 'disabled'}>${ico('plus')}実機CSVを選んで比較</button>
    </div>`;
  if (!res) {
    return head + '<div class="pr-hero"><h4>実機CSVを取り込んでください</h4>' +
      '<p>取込対象の権限(更新者/閲覧者に対応する区分)のみ比較します。</p></div>';
  }
  if (!res.rows.length) {
    return head + '<div class="pr-hero"><h4>差分はありません</h4>' +
      '<p>実機CSV ' + res.scanned + '件とリストの登録内容は一致しています。</p></div>';
  }
  const counts = { '差分あり': 0, 'リスト未登録': 0, '実機未登録': 0 };
  for (const r of res.rows) counts[r.type]++;
  const rowsHtml = res.rows.map((r) => `
    <tr>
      <td><span class="pr-cmp ${COMPARE_TYPE_CLASS[r.type] || ''}">${esc(r.type)}</span></td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.org1)}</td>
      <td>${esc(r.detail)}</td>
    </tr>`).join('');
  return head + `
    <div class="pr-sub pr-sub--users">
      <b>差分 ${res.rows.length}件</b>
      <span class="pr-count">差分あり ${counts['差分あり']} / リスト未登録 ${counts['リスト未登録']} / 実機未登録 ${counts['実機未登録']}</span>
      <span class="pr-note">実機CSV ${res.scanned}件と比較</span>
    </div>
    <div class="pr-rows">
      <table class="pr-utable">
        <colgroup><col style="width:96px"><col style="width:160px"><col style="width:140px"><col></colgroup>
        <thead><tr><th>区分</th><th>利用者名</th><th>${esc(LABEL_L1)}</th><th>内容</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}
