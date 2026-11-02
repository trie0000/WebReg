// マスタ管理画面(組織区分1/2の一覧・未反映バナー・反映ボタン)の HTML

function masterViewHtml(state) {
  const l2of = (l1id) => state.l2.filter((x) => x.Level1 && x.Level1.Id === l1id);
  const sel = state.l1.find((x) => x.Id === state.selectedL1);

  const permBtn = (x) => {
    const n = permGroupIdsOf(x).length;
    return `<button class="pr-btn pr-btn--icon pr-btn--icon-action${n ? ' pr-perm-on' : ''}" data-act="perm"
      aria-label="権限グループ" title="権限グループの割当${n ? '(' + n + '件)' : '(未設定)'}">${ico('key')}</button>`;
  };
  // 鍵アイコンの隣: この組織区分1の利用者行だけアクセス権を再適用する
  const permApplyBtn = (x) => `<button class="pr-btn pr-btn--icon pr-btn--icon-action" data-act="perm-apply-row"
    aria-label="この${esc(LABEL_L1)}のアクセス権を再設定"
    title="この「${esc(x.Title)}」の利用者行だけアクセス権を再設定(割当グループ＋管理者)">${ico('sync')}</button>`;
  const diff = state.syncDiff;
  const staleHtml = (kind, x) => {
    const labels = diff ? (kind === 'l1' ? diff.l1Badges : diff.l2Badges).get(x.Id) || [] : [];
    return labels.map((b) => `<span class="pr-stale${b === '権限未反映' ? ' pr-stale--perm' : ''}">${esc(b)}</span>`).join('');
  };
  const rowHtml = (x, kind, extra) => `
    <div class="pr-row${x.Active === false ? ' off' : ''}${extra || ''}" data-kind="${kind}" data-id="${x.Id}">
      <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="上へ" title="上へ">${ico('chevron-up')}</button>
      <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="下へ" title="下へ">${ico('chevron-down')}</button>
      <span class="pr-name" ${kind === 'l1' ? 'data-act="select"' : ''} title="${esc(x.Title)}">${esc(x.Title)}${
        x.TitleEn ? '<span class="pr-name-en">' + esc(x.TitleEn) + '</span>' : ''}${
        kind === 'l1' ? `<span class="pr-childcount">${l2of(x.Id).length}</span>` : ''}${staleHtml(kind, x)}</span>
      <label class="pr-active" title="有効/無効">
        <input type="checkbox" data-act="active" aria-label="有効" ${x.Active !== false ? 'checked' : ''}>
      </label>
      ${kind === 'l1' ? permBtn(x) + permApplyBtn(x) : ''}
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
  const pend = state.usersReady && diff && diff.pending;
  return `
    ${pend ? `
    <div class="pr-pending"><span>⚠ 未反映の変更: ${esc(diff.summary.join(' / ') || '(内訳不明)')}${
        diff.removed.length ? ' — 削除: ' + esc(diff.removed.slice(0, 3).join('、')) + (diff.removed.length > 3 ? ' ほか' : '') : ''}
      — 「リストへ反映」で適用できます</span>
      ${diff.canDiscard ? `<button class="pr-btn pr-btn--sm pr-btn--danger" data-act="discard-pending">変更を破棄して戻す</button>` : ''}
    </div>` : ''}
    <div class="pr-syncbar">
      <span>マスタの内容を「${esc(LIST_USERS)}」リストの列・選択肢・✅集計表示に反映します(無効はスキップ。列の削除はしません)。
        権限グループ割当があれば各行のアクセス権も適用します</span>
      <button class="pr-btn pr-btn--primary" data-act="sync-users">${ico('sync')}リストへ反映</button>
      <button class="pr-btn pr-btn--secondary" data-act="perm-reapply-all"
        title="全組織の利用者行のアクセス権を、マスタ指定の権限グループ＋管理者で一括再設定(増分ではなく全行)">${ico('key')}アクセス権を再設定</button>
    </div>
    <div class="pr-cols">
      <div class="pr-col">
        <div class="pr-sub"><b>${esc(LABEL_L1)}</b>${diff && diff.l1Reorder ? '<span class="pr-stale">並び替え</span>' : ''}<span class="pr-count">${state.l1.length}件</span></div>
        <div class="pr-toolbar">
          <input type="text" class="pr-input" id="pr-add-l1" placeholder="${esc(LABEL_L1)}の名称(日本語)">
          <input type="text" class="pr-input" id="pr-add-l1-en" placeholder="英語名(任意)">
          <button class="pr-btn pr-btn--primary" data-act="add-l1">${ico('plus')}追加</button>
          <button class="pr-btn pr-btn--ghost" data-act="bulk-l1" title="複数行でまとめて追加。既存と同名の行は英語名だけ一括更新(日本語[タブ/カンマ]英語)">まとめて</button>
        </div>
        <div class="pr-rows">${state.l1.map((x) =>
          rowHtml(x, 'l1', x.Id === state.selectedL1 ? ' sel' : '')).join('') ||
          '<div class="pr-empty">未登録</div>'}</div>
      </div>
      <div class="pr-col">
        <div class="pr-sub"><b>${esc(LABEL_L2)}${sel ? ' — ' + esc(sel.Title) : ''}</b>${
          diff && diff.l2Reorder ? '<span class="pr-stale">並び替え</span>' : ''}
          <span class="pr-count">${sel ? l2of(sel.Id).length + '件' : ''}</span></div>
        ${sel ? `
        <div class="pr-toolbar">
          <input type="text" class="pr-input" id="pr-add-l2" placeholder="「${esc(sel.Title)}」配下の名称(日本語)">
          <input type="text" class="pr-input" id="pr-add-l2-en" placeholder="英語名(任意)">
          <button class="pr-btn pr-btn--primary" data-act="add-l2">${ico('plus')}追加</button>
          <button class="pr-btn pr-btn--ghost" data-act="bulk-l2" title="複数行でまとめて追加。既存と同名の行は英語名だけ一括更新(日本語[タブ/カンマ]英語)">まとめて</button>
        </div>
        <div class="pr-rows">${l2of(sel.Id).map((x) => rowHtml(x, 'l2')).join('') ||
          '<div class="pr-empty">未登録</div>'}</div>`
        : '<div class="pr-empty">左で' + LABEL_L1 + 'を選択してください</div>'}
      </div>
    </div>`;
}
