// Feather 風アイコン (stroke 1.7 / 24x24 viewBox / currentColor)。絵文字を UI 要素に使わない。
// パスは Spira (src/icons.ts) と同一に揃える — 共通アイコンはコピーして使う
const ICONS = {
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'edit-2': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  'x': '<path d="M6 6l12 12M18 6L6 18"/>',
  'refresh-cw': '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  'sync': '<path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'copy': '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
};

const ico = (n) => '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.7"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
