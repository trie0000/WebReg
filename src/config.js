// permreg 全体で共有する定数。localStorage キーは 'permreg.' プレフィックスで統一
export const PRODUCT = 'permreg';
export const ROOT_ID = 'permreg-root';

export const LS_WEB_URL = 'permreg.webUrl';
export const LS_DEV_SOURCE = 'permreg.dev.bundle-source'; // 'local' なら開発者モード
export const LS_DEV_BASE = 'permreg.dev.local-base';
export const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:18086/permreg';

export const LIST_L1 = '組織区分第1階層マスタ';
export const LIST_L2 = '組織区分第2階層マスタ';

// build.js が esbuild define で注入する(直接実行時は 'dev')
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
