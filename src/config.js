// webreg 全体で共有する定数。localStorage キーは 'webreg.' プレフィックスで統一
const PRODUCT = 'webreg';
const ROOT_ID = 'webreg-root';

const LS_WEB_URL = 'webreg.webUrl';
const LS_DEV_SOURCE = 'webreg.dev.bundle-source'; // 'local' なら開発者モード
const LS_DEV_BASE = 'webreg.dev.local-base';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/webreg';

// このツールが作成/参照する SP リスト名。設定の「接頭辞」を付けて解決する。
// 接頭辞を変更しても既存リストの改名はしない(以後は新しい名前のリストを参照/作成)
const LS_LIST_PREFIX = 'webreg.listPrefix';
const BASE_LIST_L1 = '組織区分第1階層マスタ';
const BASE_LIST_L2 = '組織区分第2階層マスタ';
const BASE_LIST_USERS = '利用者一覧';
const BASE_LIST_CONF = 'WebReg設定';
let LIST_L1, LIST_L2, LIST_USERS, LIST_CONF;
function listPrefix() {
  try { return (localStorage.getItem(LS_LIST_PREFIX) || '').trim(); } catch { return ''; }
}
function applyListPrefix() {
  const p = listPrefix();
  LIST_L1 = p + BASE_LIST_L1;
  LIST_L2 = p + BASE_LIST_L2;
  LIST_USERS = p + BASE_LIST_USERS;
  LIST_CONF = p + BASE_LIST_CONF;
}
applyListPrefix();

// 変更区分/権限の既定選択肢(リスト作成時のみ使用。以後はリスト列のChoicesが正)
const CHANGE_TYPE_DEFAULTS = ['新規', '変更', '削除', '変更なし'];
const PERMISSION_DEFAULTS = ['更新者', '閲覧者'];

// 詳細ログ(コンソール)。エラーは常時出力、'1' なら全リクエストを出力
const LS_DEBUG = 'webreg.debug';
const isDebug = () => {
  try { return localStorage.getItem(LS_DEBUG) === '1'; } catch { return false; }
};

// 通知/ポーリング
const POLL_INTERVAL = 30000;
const LS_NOTIFY_EVENTS = 'webreg.notify.events';
const LS_NOTIFY_READAT = 'webreg.notify.readAt';

// UI/列の表示名で使う呼称(リスト名は互換のため変更しない)
const LABEL_L1 = '組織区分1';
const LABEL_L2 = '組織区分2';

// 旧ツール名(permreg)からの localStorage 設定移行(初回のみ。URL中のパスも書き換える)
try {
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith('permreg.')) continue;
    const nk = 'webreg.' + k.slice('permreg.'.length);
    if (localStorage.getItem(nk) == null) {
      localStorage.setItem(nk, String(localStorage.getItem(k)).replace('/permreg', '/webreg'));
    }
    // 移行後は旧キーを削除(残すと webreg.* を消したときに古い設定が復活してしまう)
    localStorage.removeItem(k);
  }
} catch { /* ignore */ }

// build.py がビルド時に __BUILD__ を版識別子文字列に置換する(未置換の直接実行時は 'dev')
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
