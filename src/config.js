// permreg 全体で共有する定数。localStorage キーは 'permreg.' プレフィックスで統一
const PRODUCT = 'permreg';
const ROOT_ID = 'permreg-root';

const LS_WEB_URL = 'permreg.webUrl';
const LS_DEV_SOURCE = 'permreg.dev.bundle-source'; // 'local' なら開発者モード
const LS_DEV_BASE = 'permreg.dev.local-base';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/permreg';

const LIST_L1 = '組織区分第1階層マスタ';
const LIST_L2 = '組織区分第2階層マスタ';

// build.py がビルド時に __BUILD__ を版識別子文字列に置換する(未置換の直接実行時は 'dev')
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
