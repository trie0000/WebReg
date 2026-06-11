// 自動更新: ローダが記録した読込元(window.__permregSource)の version.txt を定期確認し、
// 実行中の build と違えば更新モーダル → その場で新しい bundle を再読込する。
// 中継サーバ不要(ローカル開発サーバ / SP のどちらでも同じ仕組み)。
// 版比較は安定識別子 <ver>-<srcSha8> の単純比較(buildTime を含めないため誤検知しない)。

const CHECK_INTERVAL = 30000;

function applyUpdate(src, ver) {
  // bundle 実行「前」に設定する(新インスタンスの監視がこれを読む)
  window.__permregSource = Object.assign({}, src, { ver });
  if (src.dev) {
    // ローカル開発サーバ: CSP 回避のため fetch → eval(ローダと同方式)
    fetch(src.base + '/permreg.bundle.js?v=' + encodeURIComponent(ver))
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((t) => { (0, eval)(t); }) // 新 bundle が旧パネルを除去して再初期化する
      .catch((e) => toast('err', '自動更新に失敗しました — ' + (e && e.message || e)));
  } else {
    const o = document.getElementById('permreg-script');
    if (o) o.remove();
    const s = document.createElement('script');
    s.id = 'permreg-script';
    s.src = src.base + '/permreg.bundle.js?v=' + encodeURIComponent(ver);
    s.onerror = () => toast('err', '自動更新に失敗しました (script load error)');
    document.body.appendChild(s);
  }
}

function startUpdateWatcher(build) {
  // 自動更新で新インスタンスが起動したとき、旧インスタンスの監視を必ず止める
  if (window.__permregWatcher) clearInterval(window.__permregWatcher);
  if (window.__permregOnVisible) document.removeEventListener('visibilitychange', window.__permregOnVisible);

  const src = window.__permregSource;
  if (!src || !src.base) return; // ローダ経由でない(埋め込み/直接実行)場合は監視しない

  let prompting = false;
  let skippedVer = ''; // 「後で」を選んだ版は再通知しない(さらに新しい版が出たら通知)

  async function check() {
    if (prompting) return;
    let ver = '';
    try {
      const r = await fetch(src.base + '/version.txt?t=' + Date.now(), { credentials: 'same-origin' });
      if (!r.ok) return;
      ver = (await r.text()).trim();
    } catch {
      return; // 一時的な取得失敗は黙ってスキップ(次回再確認)
    }
    if (!ver || ver === build || ver === skippedVer) return;
    prompting = true;
    const ok = await modal({
      title: '更新があります',
      message: '新しいバージョン ' + ver + ' が配信されています(実行中: ' + build + ')。' +
        '今すぐ更新しますか? 編集途中の入力は失われます。',
      okLabel: '今すぐ更新',
    });
    if (ok) {
      applyUpdate(src, ver);
      return; // 新インスタンス側で監視が再開される
    }
    skippedVer = ver;
    prompting = false;
  }

  window.__permregWatcher = setInterval(() => { if (!document.hidden) check(); }, CHECK_INTERVAL);
  window.__permregOnVisible = () => { if (!document.hidden) check(); };
  document.addEventListener('visibilitychange', window.__permregOnVisible);
  window.__permregCheckNow = check; // テスト/手動確認用
}
