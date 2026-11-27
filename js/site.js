/* ============================================================
   SAIZEN警備保障 共通スクリプト（ヘッダーのメニュー開閉）
   ============================================================ */
(function () {
  'use strict';
  var btn = document.getElementById('menuButton');
  var drawer = document.getElementById('menuDrawer');
  var overlay = document.getElementById('menuOverlay');
  if (!btn || !drawer || !overlay) return;

  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    drawer.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) drawer.removeAttribute('inert'); else drawer.setAttribute('inert', '');
    document.documentElement.classList.toggle('menu-open', open);
    if (open) {
      var first = drawer.querySelector('a');
      if (first) first.focus();
    }
  }

  drawer.setAttribute('inert', '');
  btn.addEventListener('click', function () {
    setOpen(btn.getAttribute('aria-expanded') !== 'true');
  });
  overlay.addEventListener('click', function () { setOpen(false); });
  drawer.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      btn.focus();
    }
  });
  // PC幅に戻ったら閉じる
  var mq = window.matchMedia('(min-width: 1241px)');
  var onChange = function (e) { if (e.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();

/* ============================================================
   問い合わせの成果を Google アナリティクスに記録する
   - 電話番号のタップ：click_tel ／ メールアドレスのタップ：click_mail
   - 問い合わせ・警備の依頼フォームの送信完了：generate_lead
   - 採用の応募フォームの送信完了：job_apply
   （フォームの処理には手を入れず、「送信完了」の表示が出たことで判断する）
   ============================================================ */
(function () {
  'use strict';
  function send(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  function place(a) {
    if (a.closest('.site-header, .mbar')) return 'header';
    if (a.closest('.site-footer')) return 'footer';
    if (a.closest('.cta')) return 'cta';
    return 'body';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="mailto:"]') : null;
    if (!a) return;
    var isTel = a.getAttribute('href').indexOf('tel:') === 0;
    send(isTel ? 'click_tel' : 'click_mail', { link_location: place(a) });
  });

  var page = location.pathname.replace(/\//g, '') || 'top';
  [['successMsg', page === 'recruit' ? 'job_apply' : 'generate_lead'], ['orderSuccess', 'generate_lead']].forEach(function (f) {
    var el = document.getElementById(f[0]);
    if (!el || !window.MutationObserver) return;
    var done = false;
    var obs = new MutationObserver(function () {
      if (done || getComputedStyle(el).display === 'none') return;
      done = true;
      obs.disconnect();
      send(f[1], { form_name: page });
    });
    obs.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  });
})();
