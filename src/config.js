// webreg 全体で共有する定数。localStorage キーは 'webreg.' プレフィックスで統一
const PRODUCT = 'webreg';
const ROOT_ID = 'webreg-root';

const LS_WEB_URL = 'webreg.webUrl';
const LS_DEV_SOURCE = 'webreg.dev.bundle-source'; // 'local' なら開発者モード
const LS_DEV_BASE = 'webreg.dev.local-base';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/webreg';

const LIST_L1 = '組織区分第1階層マスタ';
const LIST_L2 = '組織区分第2階層マスタ';
const LIST_USERS = '利用者一覧';

// 変更区分/権限の既定選択肢(リスト作成時のみ使用。以後はリスト列のChoicesが正)
const CHANGE_TYPE_DEFAULTS = ['新規', '変更', '削除', '変更なし'];
const PERMISSION_DEFAULTS = ['参照者', '更新者'];

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
  }
} catch { /* ignore */ }

// build.py がビルド時に __BUILD__ を版識別子文字列に置換する(未置換の直接実行時は 'dev')
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
