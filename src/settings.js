// 設定モーダル: bundle 配信元(SP/ローカル)・ローカル配信URL・配信フォルダ・バージョン情報・
// 変更区分/権限の選択肢編集。保存は右下の単一ボタン(§20)。閉じたら resolve する Promise を返す。
function openSettingsModal(state) {
  return new Promise((resolve) => {
  openSettingsModalInner(state, resolve);
  });
}

function openSettingsModalInner(state, resolve) {
  const srcInfo = (window.__permregSource && window.__permregSource.base) || '直接実行(埋め込み/開発コンソール)';
  const isLocal = localStorage.getItem(LS_DEV_SOURCE) === 'local';
  const localBase = localStorage.getItem(LS_DEV_BASE) || DEFAULT_LOCAL_BASE;

  const back = el(`
    <div class="pr-backdrop">
      <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="設定">
        <h4>設定</h4>
        <div class="pr-kv">バージョン: <code>${esc(BUILD)}</code> / 今回の読込元: <code>${esc(srcInfo)}</code></div>
        <div class="pr-field">
          <label>bundle の配信元(ブックマークレット起動時にどこから本体を読むか)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${isLocal ? '' : 'checked'}>
            SharePoint (ドキュメント/permreg/ に配置した dist)</label>
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
          <span class="pr-note">permreg.bundle.js を含むフォルダの絶対パス。保存で即切替(サーバ再起動で既定の dist/ に戻る)。</span>
        </div>
        <div class="pr-field">
          <label>「変更区分」の選択肢(1行1件。利用者一覧リストの列に反映)</label>
          <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-ct" rows="4" ${state.usersReady ? '' : 'disabled'}></textarea>
        </div>
        <div class="pr-field">
          <label>「権限」の選択肢(1行1件)</label>
          <textarea class="pr-input pr-modal-ta pr-ta-sm" id="pr-choice-pm" rows="3" ${state.usersReady ? '' : 'disabled'}></textarea>
          ${state.usersReady ? '' : '<span class="pr-note">「リストへ反映」で利用者一覧リストを作成すると編集できます。</span>'}
        </div>
        <span class="pr-note">配信設定は次回のブックマークレット起動から反映されます。選択肢は保存時に即反映されます。</span>
        <div class="pr-modal-actions">
          <button class="pr-btn pr-btn--secondary" data-mact="cancel">閉じる</button>
          <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
        </div>
      </div>
    </div>`);

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
    // 変更区分/権限の選択肢(利用者一覧リストの列 Choices に反映)
    if (state.usersReady) {
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
    const local = back.querySelector('input[name="pr-src"][value="local"]').checked;
    const base = back.querySelector('#pr-dev-base').value.trim().replace(/\/+$/, '') || DEFAULT_LOCAL_BASE;
    if (local) {
      localStorage.setItem(LS_DEV_SOURCE, 'local');
      localStorage.setItem(LS_DEV_BASE, base);
    } else {
      localStorage.removeItem(LS_DEV_SOURCE);
    }
    // 配信フォルダはローカル配信サーバ側の設定なので、取得済みのときだけ POST で切替
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
      if (downOnBack) close();
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
  back.querySelector('input[name="pr-src"]:checked').focus();
}
