// 通知: 利用者一覧の定期ポーリングで検知した 追加/更新/削除 のイベント履歴と既読管理。
// イベントは localStorage に最新50件保持。既読時刻(readAt)より新しい Created/Modified を
// 持つ行には一覧で NEW/更新 バッジが付き、通知ビューを既読化すると消える。

function notifyReadAt() {
  return +(localStorage.getItem(LS_NOTIFY_READAT) || 0);
}
function notifyMarkRead() {
  localStorage.setItem(LS_NOTIFY_READAT, String(Date.now()));
}
function notifyEvents() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_NOTIFY_EVENTS) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function notifyAdd(events) {
  if (!events.length) return;
  localStorage.setItem(LS_NOTIFY_EVENTS, JSON.stringify(events.concat(notifyEvents()).slice(0, 50)));
}
function notifyUnreadCount() {
  const r = notifyReadAt();
  return notifyEvents().filter((e) => e.ts > r).length;
}

// 行バッジ: 既読時刻より後に作成→'new'、更新→'upd'、それ以外 null
function userBadge(u, readAt) {
  const created = Date.parse(u.Created || '') || 0;
  const modified = Date.parse(u.Modified || '') || 0;
  if (created > readAt) return 'new';
  if (modified > readAt) return 'upd';
  return null;
}

// ポーリング結果の差分をイベント化する
function diffUsers(prev, next) {
  const ts = Date.now();
  const prevMap = new Map(prev.map((x) => [x.Id, x]));
  const nextIds = new Set(next.map((x) => x.Id));
  const events = [];
  for (const n of next) {
    const p = prevMap.get(n.Id);
    if (!p) events.push({ ts, kind: 'new', title: n.Title || ('#' + n.Id) });
    else if (p.Modified !== n.Modified) events.push({ ts, kind: 'upd', title: n.Title || ('#' + n.Id) });
  }
  for (const p of prev) {
    if (!nextIds.has(p.Id)) events.push({ ts, kind: 'del', title: p.Title || ('#' + p.Id) });
  }
  return events;
}

function notifyViewHtml() {
  const events = notifyEvents();
  const readAt = notifyReadAt();
  const kindChip = (k) => k === 'new'
    ? '<span class="pr-badge pr-badge--new">NEW</span>'
    : k === 'upd'
      ? '<span class="pr-badge pr-badge--upd">更新</span>'
      : '<span class="pr-badge pr-badge--del">削除</span>';
  const kindText = { new: 'が追加されました', upd: 'が更新されました', del: 'が削除されました' };
  const fmt = (ts) => {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getMonth() + 1 + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  const rows = events.map((e) => `
    <div class="pr-notif${e.ts > readAt ? ' unread' : ''}">
      <span class="pr-notif-time">${fmt(e.ts)}</span>
      ${kindChip(e.kind)}
      <span class="pr-notif-msg">「${esc(e.title)}」${kindText[e.kind] || ''}</span>
    </div>`).join('');
  return `
    <div class="pr-sub"><b>通知</b><span class="pr-count">${events.length}件 / 未読 ${notifyUnreadCount()}件</span>
      <span style="flex:1"></span>
      <button class="pr-btn pr-btn--ghost pr-btn--sm" data-act="notify-read">すべて既読にする</button>
    </div>
    <div class="pr-rows">${rows || '<div class="pr-empty">通知はありません。「' + esc(LIST_USERS) + '」の追加・更新・削除を検知するとここに表示されます。</div>'}</div>`;
}
