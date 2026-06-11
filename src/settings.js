// 設定ハブモーダル(Spira と同形・§19/§20):
//   左ナビ = 個人設定 / 共通設定 / 開発者(各項目に保存先のサブタイトル)
//   モーダルは固定サイズ(メニューで大きさを変えない)+ユーザーが端ドラッグでリサイズ可
//   パネルは全て初回に描画して表示切替のみ → ナビを切り替えても入力 draft を失わない(§20)
//   保存は右下の単一ボタンに集約。閉じたら resolve する Promise を返す
function openSettingsModal(state) {
  return new Promise((resolve) => {
    openSettingsModalInner(state, resolve);
  });
}

function openSettingsModalInner(state, resolve) {
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
            <button class="pr-nav-item" data-hub="shared">共通設定<small>利用者一覧リストに保存</small></button>
            <button class="pr-nav-item" data-hub="dev">開発者<small>配信元 / バージョン</small></button>
          </nav>
          <div class="pr-hub-panels">
            <div class="pr-hub-panel" data-hubpanel="personal">
              <div class="pr-field">
                <label>リスト名の接頭辞(このツールが作成/参照する SP リスト名の先頭に付ける)</label>
                <input type="text" class="pr-input" id="pr-list-prefix" value="${esc(listPrefix())}" placeholder="例: WebReg_">
                <span class="pr-note">現在の対象: ${esc(LIST_L1)} / ${esc(LIST_L2)} / ${esc(LIST_USERS)}。
                  変更しても既存リストの名前は変わりません(以後は新しい接頭辞のリストを参照し、無ければセットアップ/反映で作成します)。</span>
              </div>
            </div>
            <div class="pr-hub-panel" data-hubpanel="shared" style="display:none">
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
              <span class="pr-note">配信設定は次回のブックマークレット起動から反映されます。</span>
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

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    back.remove();
    resolve();
  };

  const save = async () => {
    // 個人設定: リスト名の接頭辞
    const prefix = back.querySelector('#pr-list-prefix').value.trim();
    if (/[\\/:*?"<>|#%]/.test(prefix)) {
      toast('warn', '接頭辞に \\ / : * ? " < > | # % は使えません');
      return;
    }
    const prefixChanged = prefix !== listPrefix();
    if (prefixChanged) {
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
        } catch (e) {
          toast('err', '選択肢の更新に失敗しました — ' + e.message);
          return; // モーダルは開いたまま再試行できる
        }
      }
    }

    // 開発者: 配信元/ローカルURL/配信フォルダ
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
