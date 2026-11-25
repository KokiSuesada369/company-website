// ============================================================
// お問い合わせの段（CTA 1-A）を全ページで同じ HTML にそろえる
//
// 使い方（リポジトリ直下で）:
//   node tools/sync-cta.mjs            … 確認だけ（ファイルは変えない）
//   node tools/sync-cta.mjs --write    … 実際に書き換える
//
// しくみ:
//   - CTA の HTML は、このファイルの ctaHtml() が「正」。文言を変えるときはここだけ直して実行する
//   - 置き換えた段は <!-- cta:start --> 〜 <!-- cta:end --> で囲む。2回目からは、その間だけを入れ替える
//   - 置く場所：トップ・業務案内・会社概要・料金表・知恵袋一覧（横に並べる形）、
//     知恵袋の各記事の最後（縦に積む形）と右の欄（小さい形）
//   - CTA 以外の部分が1文字でも変わるページは、書き換えずに FAIL と表示する
//   - 見積もり・依頼・お問い合わせ・採用・管理画面・契約書には置かない
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

const ICON = (id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="/images/icons.svg#${id}"/></svg>`;

// 形：'page'（横に並べる）・'stack'（縦に積む）・'side'（右の欄）
function ctaHtml(kind, indent) {
  const side = kind === 'side';
  const cls = kind === 'page' ? 'cta' : `cta cta--${kind}`;
  const titleTag = kind === 'page' ? 'h2' : 'p';
  const titleId = kind === 'page' ? ' id="ctaTitle"' : '';
  const title = side
    ? '警備のご依頼・ご相談'
    : '<span class="ib">警備のご依頼・お見積もりは、</span><br><span class="ib">お気軽にどうぞ。</span>';
  const btn = (mod, href, icon, t, tShort, sub, subCls) =>
    `    <a class="cta-btn${mod}" href="${href}"><span class="cta-btn-ico">${ICON(icon)}</span>` +
    `<span class="cta-btn-body"><span class="cta-btn-title">${side ? tShort : t}</span>` +
    `<span class="cta-btn-sub${subCls}">${sub}</span></span>${ICON('i-arrow', 'i cta-btn-arrow')}</a>`;
  const lines = [
    '<!-- cta:start -->',
    `<div class="${cls}">`,
    '  <div class="cta-head">',
    ...(side ? [] : ['    <p class="cta-eyebrow">CONTACT</p>']),
    `    <${titleTag} class="cta-title"${titleId}>${title}</${titleTag}>`,
    '    <p class="cta-lead">' +
      (side ? '' : '<span class="cta-lead-long"><span class="ib">見積もり・ご相談は無料です。</span><br><span class="ib">ご都合のよい方法を</span><span class="ib">お選びください。</span></span>') +
      '<span class="cta-lead-short"><span class="ib">見積もり・ご相談は無料です</span></span></p>',
    '  </div>',
    '  <div class="cta-btns">',
    btn(' cta-btn--primary', '/estimate/', 'i-calc', '料金を見て、見積もる', '無料で見積もり', '選ぶだけで料金が分かる', ''),
    btn('', 'tel:080-5624-1393', 'i-phone', '電話で相談する', '電話で相談', '080-5624-1393', ' is-tel'),
    btn('', '/contact/', 'i-edit', 'フォームで問い合わせ', 'フォームで問合せ', '24時間受付', ''),
    '  </div>',
    '</div>',
    '<!-- cta:end -->',
  ];
  return lines.map(l => indent + l).join('\n');
}

// ページの段を包む section（トップは .sec/.wrap、ほかは .section/.container）
const pageSection = (secCls, wrapCls) =>
  `<section class="${secCls}" aria-labelledby="ctaTitle">\n  <div class="${wrapCls}">\n${ctaHtml('page', '    ')}\n  </div>\n</section>`;

const PAGE_RULES = {
  'index.html': [
    { re: /<section class="sec" aria-labelledby="ctaTitle">[\s\S]*?<div class="cta-box">[\s\S]*?<\/section>/, to: () => pageSection('sec', 'wrap') },
  ],
  'service/index.html': [{ re: /<section class="cta-section">[\s\S]*?<\/section>/, to: () => pageSection('section', 'container') }],
  'company/index.html': [{ re: /<section class="cta-section">[\s\S]*?<\/section>/, to: () => pageSection('section', 'container') }],
  'blog/index.html': [{ re: /<section class="cta-section">[\s\S]*?<\/section>/, to: () => pageSection('section', 'container') }],
  'price/index.html': [
    // 料金表は2つの段を1つにまとめる：見積もりの段は消し、お問い合わせの段を CTA に
    { re: /[ \t]*<!-- 見積もりCTA -->\n[ \t]*<div class="estimate-cta-box">[\s\S]*?<a href="\/estimate\/" class="btn-estimate">[^<]*<\/a>\n[ \t]*<\/div>\n\n/, to: () => '' },
    { re: /[ \t]*<!-- お問い合わせCTA -->\n[ \t]*<div class="contact-cta-box">[\s\S]*?<a href="\/contact\/" class="btn btn-gold">[\s\S]*?<\/a>\n[ \t]*<\/div>/, to: () => ctaHtml('page', '    ') },
  ],
};
const BLOG_RULES = [
  // 記事の最後：<div class="cta-inner-links"> の中の灰色の箱
  { re: /<div class="cta-inner-links">\s*<div style="[^"]*background:#f0f4f8;[^"]*">\s*<p[^>]*>[^<]*<\/p>\s*<div[^>]*>(?:\s*<a [^>]*>[^<]*<\/a>)+\s*<\/div>\s*<\/div>\s*<\/div>/, to: () => ctaHtml('stack', '').replace(/\n/g, '\n        ').replace(/^/, '') },
  // 右の欄
  { re: /<div class="sidebar-cta">\s*<h3>[^<]*<\/h3>\s*<p>[^<]*<\/p>\s*<a [^>]*>[^<]*<\/a>\s*<\/div>/, to: () => ctaHtml('side', '').replace(/\n/g, '\n        ') },
];

const pages = Object.keys(PAGE_RULES).concat(
  fs.readdirSync(root).filter(d => /^blog\d+$/.test(d) && fs.existsSync(path.join(root, d, 'index.html'))).map(d => `${d}/index.html`)
);

const mask = s => s.replace(/<!-- cta:start -->[\s\S]*?<!-- cta:end -->/g, '<!--CTA-->');
const headOf = s => s.slice(0, s.indexOf('</head>'));

let failed = 0, changed = 0;
const lines = [];
for (const p of pages) {
  const raw = fs.readFileSync(path.join(root, p), 'utf8');
  const crlf = raw.includes('\r\n');
  const before = raw.replace(/\r\n/g, '\n');
  let s = before;
  try {
    const rules = PAGE_RULES[p] || BLOG_RULES;
    const kinds = PAGE_RULES[p] ? null : ['stack', 'side'];
    if (s.includes('<!-- cta:start -->')) {
      // 2回目以降：目印の間を入れ替える（形は今の class から判断）
      s = s.replace(/([ \t]*)<!-- cta:start -->\n[ \t]*<div class="(cta(?: cta--(stack|side))?)">[\s\S]*?<!-- cta:end -->/g,
        (all, ind, cls, kind) => {
          const html = ctaHtml(kind || 'page', ind);
          return html.replace(/^[ \t]*/, ind);
        });
    } else {
      for (const r of rules) {
        const m = s.match(r.re);
        if (!m) throw new Error(`pattern not found: ${String(r.re).slice(0, 60)}`);
        if ((s.match(new RegExp(r.re.source, 'g')) || []).length !== 1) throw new Error('pattern found more than once');
        s = s.replace(r.re, r.to);
      }
    }
    // 検査：CTA 以外の部分は変えない
    const keep = x => mask(x)
      .replace(/<section class="cta-section">[\s\S]*?<\/section>/, '<!--CTA-->')
      .replace(/<section class="sec" aria-labelledby="ctaTitle">[\s\S]*?<\/section>/, '<!--CTA-->')
      .replace(/<section class="section" aria-labelledby="ctaTitle">[\s\S]*?<\/section>/, '<!--CTA-->')
      .replace(/<div class="cta-inner-links">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '<!--CTA-->')
      .replace(/<div class="sidebar-cta">[\s\S]*?<\/div>/, '<!--CTA-->')
      .replace(/[ \t]*<!-- 見積もりCTA -->\n[\s\S]*?class="btn-estimate">[^<]*<\/a>\n[ \t]*<\/div>\n\n/, '')
      .replace(/[ \t]*<!-- お問い合わせCTA -->\n[ \t]*<div class="contact-cta-box">[\s\S]*?<a href="\/contact\/" class="btn btn-gold">[\s\S]*?<\/a>\n[ \t]*<\/div>/, '<!--CTA-->')
      .replace(/[ \t]*<!--CTA-->/g, '<!--CTA-->');
    if (headOf(before) !== headOf(s)) throw new Error('HEAD CHANGED');
    if (keep(before) !== keep(s)) throw new Error('CONTENT OUTSIDE CTA CHANGED');
    const n = (s.match(/<!-- cta:start -->/g) || []).length;
    const want = kinds ? 2 : 1;
    if (n !== want) throw new Error(`cta count ${n} (expected ${want})`);
    if (s !== before) changed++;
    if (WRITE && s !== before) fs.writeFileSync(path.join(root, p), crlf ? s.replace(/\n/g, '\r\n') : s);
    if (!/^blog\d+\//.test(p)) lines.push(`ok   ${p}`);
  } catch (e) {
    failed++;
    lines.push(`FAIL ${p}  ${e.message}`);
  }
}
console.log(lines.join('\n'));
console.log(`\n${pages.length} pages, ${changed} to change, ${failed} failed${WRITE ? ' (written)' : ' (dry run)'}`);
process.exit(failed ? 1 : 0);
