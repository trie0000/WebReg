// 設定ハブモーダル(Spira と同形・§19/§20):
//   左ナビ = 個人設定 / 共通設定 / 開発者(各項目に保存先のサブタイトル)
//   モーダルは固定サイズ(メニューで大きさを変えない)+ユーザーが端ドラッグでリサイズ可
//   パネルは全て初回に描画して表示切替のみ → ナビを切り替えても入力 draft を失わない(§20)
//   保存は右下の単一ボタンに集約。閉じたら resolve する Promise を返す
function openSettingsModal(state, handlers) {
  return new Promise((resolve) => {
    openSettingsModalInner(state, resolve, handlers || {});
  });
}

function openSettingsModalInner(state, resolve, handlers) {
  const srcInfo = (window.__webregSource && window.__webregSource.base) || '直接実行(埋め込み/開発コンソール)';
  const isLocal = localStorage.getItem(LS_DEV_SOURCE) === 'local';
  const localBase = localStorage.getItem(LS_DEV_BASE) || DEFAULT_LOCAL_BASE;

  const back = el(`
    <div class="pr-backdrop">
      <div class="pr-modal pr-modal--hub" role="dialog" aria-modal="true" aria-label="設定">
        <h4>設定</h4>
        <div class="pr-hub-body">
          <nav class="pr-hub-nav" aria-label="設定メニュー">
            <button class="pr-nav-item active" data-hub="personal">個人設定<small>この端末に保存</small></button>
            <button class="pr-nav-item" data-hub="shared">共通設定<small>SP リストに保存(全員に適用)</small></button>
            <button class="pr-nav-item" data-hub="dev">開発者<small>配信元 / バージョン</small></button>
          </nav>
          <div class="pr-hub-panels">
            <div class="pr-hub-panel" data-hubpanel="personal">
              <div class="pr-field">
                <label>操作ログ(このツールからの更新作業の記録)</label>
                <button class="pr-btn pr-btn--secondary" data-sact="audit">${ico('refresh-cw')}操作ログを開く</button>
                <span class="pr-note">参照操作は記録されません。更新作業だけを新しい順に表示します(全員共有)。</span>
              </div>
            </div>
            <div class="pr-hub-panel" data-hubpanel="shared" style="display:none">
              <div class="pr-field">
                <label>リスト名の接頭辞(このツールが作成/参照する SP リスト名の先頭。全員で共有)</label>
                <input type="text" class="pr-input" id="pr-list-prefix" value="${esc(listPrefix())}" placeholder="例: WebReg_">
                <span class="pr-note">現在の対象: ${esc(LIST_L1)} / ${esc(LIST_L2)} / ${esc(LIST_USERS)}。
                  「${esc(LIST_COMMON)}」リストに保存し、起動時に全員がこの接頭辞を参照します。
                  変更しても既存リストの名前は変わりません(以後は新しい接頭辞のリストを参照/作成)。</span>
              </div>
              <div class="pr-field">
                <label>「変更区分」の選択肢(1行1件)</label>
                <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-ct" rows="4" ${state.usersReady ? '' : 'disabled'}></textarea>
              </div>
              <div class="pr-field">
                <label>「権限」の選択肢(1行1件)</label>
                <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-pm" rows="3" ${state.usersReady ? '' : 'disabled'}></textarea>
                ${state.usersReady ? '' : '<span class="pr-note">「リストへ反映」で利用者一覧リストを作成すると編集できます。</span>'}
              </div>
              <span class="pr-note">保存すると利用者一覧リストの列の選択肢に即反映されます(全員に適用)。</span>
              <div class="pr-field">
                <label>管理者グループ(「権限を反映」時に全行へフルコントロールを付与)</label>
                <div class="pr-checks pr-checks--perm" id="pr-admin-groups"><span class="pr-note">権限グループを取得中…</span></div>
                <span class="pr-note">「${esc(LIST_CONF)}」リストに保存します(全員共有)。行の参照/更新グループの割当はマスタ管理の鍵アイコンから。</span>
              </div>
              <div class="pr-field">
                <label>データ管理(バックアップ / リストア / リセット)</label>
                <div style="display:flex; gap:var(--s-3); flex-wrap:wrap">
                  <button class="pr-btn pr-btn--secondary" data-sact="backup">バックアップ取得</button>
                  <button class="pr-btn pr-btn--secondary" data-sact="restore">リストア(復元)</button>
                  <button class="pr-btn pr-btn--danger" data-sact="reset">リストを空にする</button>
                </div>
                <span class="pr-note">バックアップ=管理用を含む全リストの内容・集計式・条件式・書式をJSONで保存。
                  リストア=そのJSONから復元(空のリストからでも戻せます)。
                  リセット=管理対象リストの全アイテムを削除して空にします(構造は残ります)。</span>
              </div>
            </div>
            <div class="pr-hub-panel" data-hubpanel="dev" style="display:none">
              <div class="pr-kv">バージョン: <code>${esc(BUILD)}</code> / 今回の読込元: <code>${esc(srcInfo)}</code></div>
              <div class="pr-field">
                <label>bundle の配信元(ブックマークレット起動時にどこから本体を読むか)</label>
                <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${isLocal ? '' : 'checked'}>
                  SharePoint (ドキュメント/webreg/ に配置した dist)</label>
                <label class="pr-radio"><input type="radio" name="pr-src" value="local" ${isLocal ? 'checked' : ''}>
                  ローカル開発サーバ(開発者モード)</label>
              </div>
              <div class="pr-field">
                <label>ローカル配信 URL(開発者モード時)</label>
                <input type="text" class="pr-input" id="pr-dev-base" value="${esc(localBase)}" placeholder="${esc(DEFAULT_LOCAL_BASE)}">
                <span class="pr-note">リポジトリで <code>python dev/serve.py</code> を起動して配信します。</span>
              </div>
              <div class="pr-field">
                <label>配信フォルダ(ローカル配信サーバが参照するフォルダ)</label>
                <input type="text" class="pr-input" id="pr-bundle-dir" placeholder="配信サーバから取得中…">
                <span class="pr-note">webreg.bundle.js を含むフォルダの絶対パス。保存で即切替(サーバ再起動で既定の dist/ に戻る)。</span>
              </div>
              <label class="pr-check"><input type="checkbox" id="pr-debug" ${isDebug() ? 'checked' : ''}>
                詳細ログをブラウザのコンソールに出力(全RESTリクエスト。エラーは常時出力)</label>
              <span class="pr-note">通常運用は「SharePoint」を選べばサーバ類は一切不要です(dist を ドキュメント/webreg/ に配置)。
                ローカル開発サーバと配信フォルダは開発時のみ使用。配信設定は次回のブックマークレット起動から反映されます。</span>
              <div class="pr-field">
                <label>利用OSS・ライセンス</label>
                <div class="pr-oss">このツールは<b>外部のOSS・ライブラリを実行時に一切使用していません</b>(ランタイム依存ゼロ／
                  ブラウザ標準APIのみ)。.xlsx の読み書き・ZIP 展開・CSV 解析・UI もすべて自前実装で、
                  CDN 等から外部コードを取得することもありません。ビルドは Python 標準ライブラリのみ(外部パッケージ不要)。
                  したがって第三者OSSのライセンス表記の対象はありません。</div>
              </div>
            </div>
          </div>
        </div>
        <div class="pr-modal-actions">
          <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
        </div>
      </div>
    </div>`);

  // ナビ切替(パネルは描画済みのまま表示だけ切替 → draft 保持)
  back.querySelector('.pr-hub-nav').addEventListener('click', (e) => {
    const item = e.target.closest('[data-hub]');
    if (!item) return;
    back.querySelectorAll('.pr-hub-nav .pr-nav-item').forEach((n) => n.classList.toggle('active', n === item));
    back.querySelectorAll('.pr-hub-panel').forEach((p) => {
      p.style.display = p.dataset.hubpanel === item.dataset.hub ? '' : 'none';
    });
  });

  // 操作ログを開く(設定モーダルは閉じずに重ねて表示)
  back.querySelector('[data-sact="audit"]').addEventListener('click', () => { openAuditLogModal(); });
  // データ管理: バックアップは設定を開いたまま、リストア/リセットは設定を閉じてから実行
  back.querySelector('[data-sact="backup"]').addEventListener('click', () => { if (handlers.onBackup) handlers.onBackup(); });
  back.querySelector('[data-sact="restore"]').addEventListener('click', () => { close(); if (handlers.onRestore) handlers.onRestore(); });
  back.querySelector('[data-sact="reset"]').addEventListener('click', () => { close(); if (handlers.onReset) handlers.onReset(); });

  // 配信フォルダ欄はローカル配信サーバから現在値を取得して埋める(サーバ未起動なら無効化)
  const dirInput = back.querySelector('#pr-bundle-dir');
  (async () => {
    const base = localBase.replace(/\/+$/, '');
    try {
      const r = await fetch(base + '/bundle-dir?t=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      dirInput.value = (await r.json()).dir || '';
      dirInput.dataset.loaded = '1';
    } catch {
      dirInput.placeholder = '配信サーバに接続できません(python dev/serve.py を起動して開き直し)';
      dirInput.disabled = true;
    }
  })();

  // 選択肢の現在値をプリフィル
  back.querySelector('#pr-choice-ct').value = state.choices.changeType.join('\n');
  back.querySelector('#pr-choice-pm').value = state.choices.permission.join('\n');

  // 管理者グループ: サイトのグループ一覧 + 保存済みの選択をチェックリストで表示
  const adminBox = back.querySelector('#pr-admin-groups');
  let adminLoadedIds = null; // 取得成功時のみ保存対象にする
  (async () => {
    try {
      const [groups, ids] = await Promise.all([fetchSiteGroups(), loadAdminGroupIds()]);
      adminLoadedIds = ids;
      adminBox.innerHTML = permChecksHtml('a', groups, ids);
    } catch (e) {
      adminBox.innerHTML = '<span class="pr-note">権限グループを取得できません — ' + esc(e.message) + '</span>';
    }
  })();

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    back.remove();
    resolve();
  };

  const save = async () => {
    // 共通設定: リスト名の接頭辞(共通設定リストに保存し全員で共有。端末にもキャッシュ)
    const prefix = back.querySelector('#pr-list-prefix').value.trim();
    if (/[\\/:*?"<>|#%]/.test(prefix)) {
      toast('warn', '接頭辞に \\ / : * ? " < > | # % は使えません');
      return;
    }
    const prefixChanged = prefix !== listPrefix();
    if (prefixChanged) {
      try {
        await setCommonSetting('listPrefix', prefix);
        auditLog('接頭辞の変更', 'リスト接頭辞を「' + (prefix || '(なし)') + '」に設定');
      } catch (e) {
        toast('err', '接頭辞の保存に失敗しました — ' + e.message);
        return; // モーダルは開いたまま再試行できる
      }
      localStorage.setItem(LS_LIST_PREFIX, prefix);
      applyListPrefix();
    }

    // 共通設定: 変更区分/権限の選択肢(接頭辞を変えた直後は参照先が変わるためスキップ)
    if (state.usersReady && !prefixChanged) {
      const parseLines = (id) => [...new Set(back.querySelector(id).value
        .split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
      const ct = parseLines('#pr-choice-ct');
      const pm = parseLines('#pr-choice-pm');
      if (!ct.length || !pm.length) {
        toast('warn', '変更区分/権限の選択肢は1件以上必要です');
        return;
      }
      const changedCt = ct.join('\n') !== state.choices.changeType.join('\n');
      const changedPm = pm.join('\n') !== state.choices.permission.join('\n');
      if (changedCt || changedPm) {
        try {
          if (changedCt) await setChoices(LIST_USERS, 'ChangeType', '変更区分', ct, true);
          if (changedPm) await setChoices(LIST_USERS, 'Permission', '権限', pm, true);
          state.choices = { changeType: ct, permission: pm };
          auditLog('選択肢の変更', [changedCt ? '変更区分' : '', changedPm ? '権限' : ''].filter(Boolean).join(' / ') + 'を更新');
        } catch (e) {
          toast('err', '選択肢の更新に失敗しました — ' + e.message);
          return; // モーダルは開いたまま再試行できる
        }
      }
    }

    // 共通設定: 管理者グループ(取得に成功していて選択が変わったときだけ保存)
    if (adminLoadedIds && !prefixChanged) {
      const ids = collectPermIds(back, 'a');
      if (JSON.stringify(ids) !== JSON.stringify(adminLoadedIds)) {
        try {
          await saveAdminGroupIds(ids);
          auditLog('管理者グループの変更', '管理者グループを ' + ids.length + '件に設定');
          adminLoadedIds = ids;
        } catch (e) {
          toast('err', '管理者グループの保存に失敗しました — ' + e.message);
          return; // モーダルは開いたまま再試行できる
        }
      }
    }

    // 開発者: 詳細ログ/配信元/ローカルURL/配信フォルダ
    if (back.querySelector('#pr-debug').checked) localStorage.setItem(LS_DEBUG, '1');
    else localStorage.removeItem(LS_DEBUG);
    const local = back.querySelector('input[name="pr-src"][value="local"]').checked;
    const base = back.querySelector('#pr-dev-base').value.trim().replace(/\/+$/, '') || DEFAULT_LOCAL_BASE;
    if (local) {
      localStorage.setItem(LS_DEV_SOURCE, 'local');
      localStorage.setItem(LS_DEV_BASE, base);
    } else {
      localStorage.removeItem(LS_DEV_SOURCE);
    }
    if (local && dirInput.dataset.loaded && dirInput.value.trim()) {
      try {
        const r = await fetch(base + '/bundle-dir', {
          method: 'POST',
          body: JSON.stringify({ dir: dirInput.value.trim() }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        toast('ok', '保存しました(配信フォルダ: ' + j.dir + ')');
      } catch (e) {
        toast('err', '配信フォルダの変更に失敗しました — ' + e.message);
        return; // モーダルは開いたまま(修正して再保存できるように)
      }
    } else {
      toast('ok', '保存しました');
    }
    close();
  };

  let downOnBack = false;
  back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
  back.addEventListener('click', (e) => {
    if (e.target === back) {
      if (downOnBack) close(); // リサイズドラッグ等の誤クローズ防止(mousedown 起点で判定)
      return;
    }
    const b = e.target.closest('[data-mact]');
    if (b) (b.dataset.mact === 'ok' ? save() : close());
  });
  const onKey = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
  };
  document.addEventListener('keydown', onKey, true);

  document.getElementById(ROOT_ID).appendChild(back);
  back.querySelector('#pr-list-prefix').focus();
}
