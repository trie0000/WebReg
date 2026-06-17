// UI 基盤部品: el / esc / toast(右上) / modal(確認・入力)
// 通知は必ず toast、破壊的操作の確認は必ず modal を使う(alert/confirm/prompt 禁止)

let _root = null;
function setRoot(root) {
  _root = root;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// kind: 'ok'(2秒) | 'warn'(3秒) | 'err'(手動close + コピーボタン)
// opts.sticky=true で自動消滅させない(閉じるボタン/クリックで明示的に消すまで残す)。
// 件数報告など読ませたい通知に使う。残る通知には内容コピーボタンも付ける
function toast(kind, msg, opts) {
  let host = _root.querySelector('.pr-toasts');
  if (!host) {
    host = el('<div class="pr-toasts" role="status" aria-live="polite"></div>');
    _root.appendChild(host);
  }
  const sticky = !!(opts && opts.sticky);
  const showCopy = kind === 'err' || sticky;
  const t = el(`
    <div class="pr-toast pr-toast--${kind}">
      <div class="pr-msg"></div>
      ${showCopy ? `<button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="copy" aria-label="内容をコピー">${ico('copy')}</button>` : ''}
      <button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="close" aria-label="閉じる">${ico('x')}</button>
    </div>`);
  t.querySelector('.pr-msg').textContent = msg;
  t.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tact]');
    if (!b) return;
    if (b.dataset.tact === 'copy') navigator.clipboard.writeText(msg).catch(() => {});
    else t.remove();
  });
  host.appendChild(t);
  if (sticky || kind === 'err') return; // 明示的に閉じるまで残す
  if (kind === 'ok') setTimeout(() => t.remove(), 2000);
  if (kind === 'warn') setTimeout(() => t.remove(), 3000);
}

// inputValue を渡すと入力モーダル(resolve: string|null)、
// 渡さなければ確認モーダル(resolve: boolean)。
// multiline: true で複数行テキストエリア(自動伸縮・上限55vh。確定は Cmd/Ctrl+Enter のみ)。
// backdrop は mousedown 起点で判定(ドラッグ操作の誤クローズ防止)。
function modal({ title, message, inputValue, multiline, okLabel, danger }) {
  return new Promise((resolve) => {
    const hasInput = inputValue !== undefined;
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <h4></h4>
          ${message != null ? '<div class="pr-modal-msg"></div>' : ''}
          ${hasInput ? (multiline
            ? '<textarea class="pr-input pr-modal-ta" rows="8"></textarea>'
            : '<input class="pr-input" type="text">') : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn ${danger ? 'pr-btn--danger' : 'pr-btn--primary'}" data-mact="ok"></button>
          </div>
        </div>
      </div>`);
    back.querySelector('h4').textContent = title;
    if (message != null) back.querySelector('.pr-modal-msg').textContent = message;
    const input = back.querySelector('input, textarea');
    if (input) input.value = inputValue;
    if (input && multiline) {
      const fit = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight + 4, window.innerHeight * 0.55) + 'px';
      };
      input.addEventListener('input', fit);
      setTimeout(fit, 0);
    }
    back.querySelector('[data-mact="ok"]').textContent = okLabel || 'OK';

    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const cancel = () => done(hasInput ? null : false);
    const ok = () => done(hasInput ? input.value.trim() : true);

    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        if (downOnBack) cancel();
        return;
      }
      const b = e.target.closest('[data-mact]');
      if (b) (b.dataset.mact === 'ok' ? ok() : cancel());
    });
    const onKey = (e) => {
      // IME 変換確定の Enter で確定させない(keyCode 229 は古い Chrome/Safari 対策)
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      // 複数行入力では Enter は改行。確定は Cmd/Ctrl+Enter のみ
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (hasInput && !multiline && e.target === input))) ok();
    };
    document.addEventListener('keydown', onKey, true);

    _root.appendChild(back);
    (input || back.querySelector('[data-mact="ok"]')).focus();
    if (input) input.select();
  });
}

// ---- 進捗モーダル(時間のかかるリスト更新中に表示) ----------------------
// run() が progressArm/progressDone で囲み、setStatus 経由の進捗文字列を
// progressFeed が受け取る。「… (3/25)」形式なら進捗バー+残り時間の目安を出す。
// 0.6秒未満で終わる操作には出さない(チラつき防止)

let _prog = null;

const progFmtDur = (ms) => {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return s + '秒';
  return Math.floor(s / 60) + '分' + (s % 60 ? (s % 60) + '秒' : '');
};

function progressArm(label) {
  progressDone();
  _prog = { label, opened: false, el: null, phase: '', phaseStart: Date.now(), counts: null };
  _prog.openTimer = setTimeout(progressShow, 600);
  _prog.tick = setInterval(progressRender, 1000);
}

function progressShow() {
  if (!_prog || _prog.opened) return;
  _prog.opened = true;
  _prog.el = el(`
    <div class="pr-backdrop pr-prog-back">
      <div class="pr-modal pr-prog" role="dialog" aria-modal="true" aria-label="処理中">
        <h4></h4>
        <div class="pr-prog-msg">処理中…</div>
        <div class="pr-prog-track"><div class="pr-prog-fill ind"></div></div>
        <div class="pr-prog-meta"><span class="pr-prog-count"></span><span class="pr-prog-eta"></span></div>
        <span class="pr-note">このまま閉じずにお待ちください(進捗と残り時間は目安です)</span>
      </div>
    </div>`);
  _prog.el.querySelector('h4').textContent = _prog.label + '…';
  document.getElementById(ROOT_ID).appendChild(_prog.el);
  progressRender();
}

function progressFeed(msg) {
  if (!_prog) return;
  const m = String(msg).match(/^(.*?)\s*\((\d+)\/(\d+)\)\s*$/);
  const phase = m ? m[1] : String(msg);
  if (phase !== _prog.phase) {
    _prog.phase = phase;
    _prog.phaseStart = Date.now();
    _prog.counts = null;
  }
  if (m) {
    const n = +m[2];
    const total = +m[3];
    if (!_prog.counts) _prog.counts = { firstN: n - 1, firstT: Date.now() };
    _prog.counts.n = n;
    _prog.counts.total = total;
    // 件数付きの処理は残りがあるならすぐモーダルを出す
    if (!_prog.opened && total - n > 1) {
      clearTimeout(_prog.openTimer);
      progressShow();
    }
  }
  progressRender();
}

function progressRender() {
  if (!_prog || !_prog.opened) return;
  const e = _prog.el;
  e.querySelector('.pr-prog-msg').textContent = _prog.phase || '処理中…';
  const c = _prog.counts;
  const fill = e.querySelector('.pr-prog-fill');
  if (c && c.total) {
    fill.classList.remove('ind');
    fill.style.width = Math.min(100, Math.round((c.n / c.total) * 100)) + '%';
    e.querySelector('.pr-prog-count').textContent = c.n + ' / ' + c.total + '件';
    const span = c.n - c.firstN;
    let eta = '';
    if (c.n >= c.total) eta = 'まもなく完了…';
    else if (span >= 2) {
      const per = (Date.now() - c.firstT) / span;
      eta = '残り 約' + progFmtDur(per * (c.total - c.n));
    } else eta = '残り時間を計測中…';
    e.querySelector('.pr-prog-eta').textContent = eta;
  } else {
    // 件数の無い工程は経過時間で「動いている」ことを示す(バーは流れるアニメ)
    fill.classList.add('ind');
    fill.style.width = '40%';
    e.querySelector('.pr-prog-count').textContent = '';
    e.querySelector('.pr-prog-eta').textContent = '経過 ' + progFmtDur(Date.now() - _prog.phaseStart);
  }
}

function progressDone() {
  if (!_prog) return;
  clearTimeout(_prog.openTimer);
  clearInterval(_prog.tick);
  if (_prog.el) _prog.el.remove();
  _prog = null;
}

// マスタの名称変更(日本語+英語の2項目)モーダル。resolve: {title, titleEn} | null
function openRenameMasterModal(item) {
  return new Promise((resolve) => {
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="名称変更">
          <h4>名称変更</h4>
          <div class="pr-field"><label>名称(日本語)</label>
            <input type="text" class="pr-input" id="rn-ja"></div>
          <div class="pr-field"><label>英語名(任意)</label>
            <input type="text" class="pr-input" id="rn-en"></div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">保存</button>
          </div>
        </div>
      </div>`);
    back.querySelector('#rn-ja').value = item.Title || '';
    back.querySelector('#rn-en').value = item.TitleEn || '';
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const ok = () => {
      const title = back.querySelector('#rn-ja').value.trim();
      if (!title) { toast('warn', '日本語の名称は必須です'); return; }
      done({ title, titleEn: back.querySelector('#rn-en').value.trim() });
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) { if (downOnBack) done(null); return; }
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
    back.querySelector('#rn-ja').focus();
  });
}

// マスタのまとめて追加/英語名一括設定。日本語と英語を2つのテキスト欄に「同じ行=対応」で入力する。
// items(既存マスタ)を日本語・英語の各欄に読み込んでおく(英語が無い行は空行)。順番が対応関係。
// resolve: [{name, en}] (日本語が空の行は除外) | null
function openBulkMasterModal(titleText, items) {
  return new Promise((resolve) => {
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal pr-modal--form" role="dialog" aria-modal="true" aria-label="${esc(titleText)}">
          <h4>${esc(titleText)}</h4>
          <span class="pr-note">日本語名と英語名を<b>同じ行で対応</b>させて入力します。既存の名称は読み込み済みで、
            英語が無い行は空欄です。英語名を入れて保存すると一括設定されます。
            行を増やせば新規追加(日本語のみでも可)。Excel の各列を貼り付けてもOK。</span>
          <div class="pr-bulk2">
            <div class="pr-bulk2-col"><label>日本語名</label>
              <textarea class="pr-input pr-bulk2-ta" id="blk-ja" rows="12" spellcheck="false" wrap="off"></textarea></div>
            <div class="pr-bulk2-col"><label>英語名</label>
              <textarea class="pr-input pr-bulk2-ta" id="blk-en" rows="12" spellcheck="false" wrap="off"></textarea></div>
          </div>
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn pr-btn--primary" data-mact="ok">反映する</button>
          </div>
        </div>
      </div>`);
    const jaTa = back.querySelector('#blk-ja');
    const enTa = back.querySelector('#blk-en');
    jaTa.value = items.map((x) => x.Title || '').join('\n');
    enTa.value = items.map((x) => x.TitleEn || '').join('\n');
    // 縦スクロールを同期して行のずれを防ぐ
    let lock = false;
    const sync = (src, dst) => { if (lock) return; lock = true; dst.scrollTop = src.scrollTop; lock = false; };
    jaTa.addEventListener('scroll', () => sync(jaTa, enTa));
    enTa.addEventListener('scroll', () => sync(enTa, jaTa));
    const done = (val) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      resolve(val);
    };
    const ok = () => {
      const ja = jaTa.value.split(/\r?\n/);
      const en = enTa.value.split(/\r?\n/);
      const pairs = [];
      for (let i = 0; i < ja.length; i++) {
        const n = ja[i].trim();
        if (!n) continue; // 日本語が空の行は対象外
        pairs.push({ name: n, en: (en[i] || '').trim() });
      }
      done(pairs);
    };
    let downOnBack = false;
    back.addEventListener('mousedown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target === back) { if (downOnBack) done(null); return; }
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
    jaTa.focus();
  });
}
