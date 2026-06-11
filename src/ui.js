// UI 基盤部品: el / esc / toast(右上) / modal(確認・入力)
// 通知は必ず toast、破壊的操作の確認は必ず modal を使う(alert/confirm/prompt 禁止)
import { ico } from './icons.js';

let _root = null;
export function setRoot(root) {
  _root = root;
}

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// kind: 'ok'(2秒) | 'warn'(3秒) | 'err'(手動close + コピーボタン)
export function toast(kind, msg) {
  let host = _root.querySelector('.pr-toasts');
  if (!host) {
    host = el('<div class="pr-toasts" role="status" aria-live="polite"></div>');
    _root.appendChild(host);
  }
  const t = el(`
    <div class="pr-toast pr-toast--${kind}">
      <div class="pr-msg"></div>
      ${kind === 'err' ? `<button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="copy" aria-label="エラー内容をコピー">${ico('copy')}</button>` : ''}
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
  if (kind === 'ok') setTimeout(() => t.remove(), 2000);
  if (kind === 'warn') setTimeout(() => t.remove(), 3000);
}

// inputValue を渡すと入力モーダル(resolve: string|null)、
// 渡さなければ確認モーダル(resolve: boolean)。
// backdrop は mousedown 起点で判定(ドラッグ操作の誤クローズ防止)。
export function modal({ title, message, inputValue, okLabel, danger }) {
  return new Promise((resolve) => {
    const hasInput = inputValue !== undefined;
    const back = el(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <h4></h4>
          ${message != null ? '<div class="pr-modal-msg"></div>' : ''}
          ${hasInput ? '<input class="pr-input" type="text">' : ''}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">キャンセル</button>
            <button class="pr-btn ${danger ? 'pr-btn--danger' : 'pr-btn--primary'}" data-mact="ok"></button>
          </div>
        </div>
      </div>`);
    back.querySelector('h4').textContent = title;
    if (message != null) back.querySelector('.pr-modal-msg').textContent = message;
    const input = back.querySelector('input');
    if (input) input.value = inputValue;
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
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (hasInput && e.target === input))) ok();
    };
    document.addEventListener('keydown', onKey, true);

    _root.appendChild(back);
    (input || back.querySelector('[data-mact="ok"]')).focus();
    if (input) input.select();
  });
}
