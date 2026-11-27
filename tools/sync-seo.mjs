// ============================================================
// 構造化データ（JSON-LD）・llms.txt・sitemap.xml をそろえる（SEO / AIO）
//
// 使い方（リポジトリ直下で）:
//   node tools/sync-seo.mjs            … 確認だけ（ファイルは変えない）
//   node tools/sync-seo.mjs --write    … 実際に書き換える
//
// しくみ:
//   - 料金は js/rates.js から読む。料金を変えたら、このスクリプトも実行する
//   - 会社の情報（住所・電話・認定番号など）は下の COMPANY がもと。変わったらここを直す
//   - 各ページの JSON-LD は、@type / @id で見分けて入れ替える（無ければ </head> の前に足す）
//   - JSON-LD 以外の部分が変わるページは書き換えずに FAIL と表示する
//   - llms.txt は AI 向けの会社案内。記事一覧は blog/index.html の並び順で作る
//   - sitemap.xml の更新日は、そのファイルの最後のコミット日（作業中の変更があれば今日）
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const SITE = 'https://saizen.one';
const ORG_ID = `${SITE}/#organization`;
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

const readRaw = p => fs.readFileSync(path.join(root, p), 'utf8');
const read = p => readRaw(p).replace(/\r\n/g, '\n');
const pending = new Map(); // p -> text
const write = (p, s) => pending.set(p, s);

// ---- 料金（js/rates.js） ----
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(read('js/rates.js'), ctx);
const R = ctx.window.SAIZEN_RATES.RATES;
const fmt = n => n.toLocaleString('ja-JP');

// ---- 会社の情報（ページに書いてある事実だけ） ----
const COMPANY = {
  name: 'SAIZEN警備保障株式会社',
  alternateName: ['SAIZEN警備保障', 'SAIZEN SECURITY GUARD Co., Ltd.'],
  tel: '080-5624-1393',
  email: 'info@saizen.one',
  postalCode: '733-0011',
  region: '広島県',
  locality: '広島市西区',
  street: '横川町3丁目1-9 横川商店街ビルB棟305号',
  founded: '2024',
  representative: '末貞 皓己',
  license: '広島県公安委員会 第73000768号',
  area: '広島県内全域',
};

const OFFER_ROWS = [
  ['月〜土・日勤', R.base['平日']['日勤'], R.overtime['平日']['日勤']],
  ['月〜土・夜勤', R.base['平日']['夜勤'], R.overtime['平日']['夜勤']],
  ['日曜・祝日・日勤', R.base['日曜祝日']['日勤'], R.overtime['日曜祝日']['日勤']],
  ['日曜・祝日・夜勤', R.base['日曜祝日']['夜勤'], R.overtime['日曜祝日']['夜勤']],
];
const offers = () => OFFER_ROWS.map(([label, price]) => ({
  '@type': 'Offer',
  name: `交通誘導警備・雑踏警備（${label}）`,
  priceCurrency: 'JPY',
  price,
  priceSpecification: {
    '@type': 'UnitPriceSpecification',
    price, priceCurrency: 'JPY', valueAddedTaxIncluded: false,
    unitText: '警備員1名・1日（9時間拘束／実働8時間）',
  },
  url: `${SITE}/price/`,
}));

const address = () => ({
  '@type': 'PostalAddress', streetAddress: COMPANY.street, addressLocality: COMPANY.locality,
  addressRegion: COMPANY.region, postalCode: COMPANY.postalCode, addressCountry: 'JP',
});
const hours247 = () => ({
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  opens: '00:00', closes: '23:59',
});
const org = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': ORG_ID,
  name: COMPANY.name,
  alternateName: COMPANY.alternateName,
  description: '広島県内の交通誘導警備・雑踏警備（イベント警備）・駐車場警備を行う警備会社。料金表を公開し、Webで見積もり・依頼ができます。24時間365日対応。',
  url: `${SITE}/`,
  logo: `${SITE}/images/logo-08a.png`,
  image: `${SITE}/images/og-image.png`,
  telephone: COMPANY.tel,
  email: COMPANY.email,
  address: address(),
  geo: { '@type': 'GeoCoordinates', latitude: 34.4028, longitude: 132.4486 },
  hasMap: 'https://www.google.com/maps/search/?api=1&query=%E3%80%92733-0011%20%E5%BA%83%E5%B3%B6%E7%9C%8C%E5%BA%83%E5%B3%B6%E5%B8%82%E8%A5%BF%E5%8C%BA%E6%A8%AA%E5%B7%9D%E7%94%BA3%E4%B8%81%E7%9B%AE1-9',
  areaServed: { '@type': 'AdministrativeArea', name: '広島県' },
  openingHoursSpecification: hours247(),
  foundingDate: COMPANY.founded,
  priceRange: `¥${fmt(R.base['平日']['日勤'])}〜（警備員1名1日・税抜）`,
  identifier: { '@type': 'PropertyValue', name: '警備業の認定番号', value: COMPANY.license },
  knowsAbout: ['交通誘導警備', '雑踏警備', 'イベント警備', '駐車場警備', '警備業法'],
  contactPoint: {
    '@type': 'ContactPoint', telephone: COMPANY.tel, email: COMPANY.email,
    contactType: 'customer service', areaServed: 'JP', availableLanguage: 'ja', hoursAvailable: hours247(),
  },
  hasOfferCatalog: { '@type': 'OfferCatalog', name: '警備料金（税抜）', itemListElement: offers() },
});
const website = () => ({
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`,
  name: COMPANY.name, url: `${SITE}/`, inLanguage: 'ja', publisher: { '@id': ORG_ID },
});
const aboutPage = () => ({
  '@context': 'https://schema.org', '@type': 'AboutPage', '@id': `${SITE}/company/#page`,
  url: `${SITE}/company/`, name: '会社概要｜SAIZEN警備保障株式会社', inLanguage: 'ja',
  mainEntity: { ...org(), '@context': undefined },
});
const priceService = () => ({
  '@context': 'https://schema.org', '@type': 'Service', '@id': `${SITE}/price/#service`,
  name: '交通誘導警備・雑踏警備', serviceType: '2号警備（交通誘導警備・雑踏警備）',
  provider: { '@type': 'LocalBusiness', '@id': ORG_ID, name: COMPANY.name, url: `${SITE}/` },
  areaServed: { '@type': 'AdministrativeArea', name: '広島県' },
  url: `${SITE}/price/`,
  offers: offers(),
});
const job = (kind) => {
  const part = kind === 'part';
  return {
    '@context': 'https://schema.org', '@type': 'JobPosting', '@id': `${SITE}/recruit/#job-${kind}`,
    title: `警備員（交通誘導・雑踏警備）${part ? 'アルバイト' : '正社員'}`,
    description: [
      '<p>広島県内で交通誘導警備・雑踏警備のスタッフを募集しています。資格・経験は不問、未経験歓迎です。入社後、現場に出る前に20時間の新任教育があります。</p>',
      `<p>給与：${part ? '日給 10,000円〜' : '月給 210,000円〜・ボーナスあり'}／勤務地：広島県内の指定する場所／勤務時間：シフト制（現場による）／試用期間：なし／社会保険：${part ? '完備（アルバイト・正社員問わず）' : '完備'}</p>`,
      '<p>現場スタッフから営業所長を目指せます（営業所長になれば月収50万円〜）。交通誘導警備業務検定の取得もサポートします。</p>',
    ].join(''),
    datePosted: '2026-11-25',
    employmentType: part ? 'PART_TIME' : 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', '@id': ORG_ID, name: COMPANY.name, sameAs: `${SITE}/`, logo: `${SITE}/images/logo-08a.png` },
    jobLocation: { '@type': 'Place', address: { ...address() } },
    baseSalary: {
      '@type': 'MonetaryAmount', currency: 'JPY',
      value: { '@type': 'QuantitativeValue', minValue: part ? 10000 : 210000, unitText: part ? 'DAY' : 'MONTH' },
    },
    workHours: 'シフト制（現場による）',
    qualifications: '不問・未経験歓迎',
    experienceRequirements: 'no requirements',
    jobBenefits: `社会保険完備、新任教育20時間、資格取得支援${part ? '' : '、ボーナスあり'}`,
    industry: '警備業',
    directApply: true,
    url: `${SITE}/recruit/`,
  };
};
const contactPage = () => ({
  '@context': 'https://schema.org', '@type': 'ContactPage', '@id': `${SITE}/contact/#page`,
  url: `${SITE}/contact/`, name: 'お問い合わせ｜SAIZEN警備保障株式会社', inLanguage: 'ja',
  mainEntity: { '@type': 'LocalBusiness', '@id': ORG_ID, name: COMPANY.name, telephone: COMPANY.tel, email: COMPANY.email,
    contactPoint: org().contactPoint },
});

// ---- 知恵袋の記事一覧（blog/index.html の並び順） ----
const blogList = read('blog/index.html');
const articles = [...blogList.matchAll(/<a data-index="\d+" href="\/(blog\d+)\/" class="blog-list-item">/g)].map(m => m[1]);
const articleInfo = a => {
  const s = read(`${a}/index.html`);
  const title = ((s.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/｜警備の知恵袋$/, '');
  const desc = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  return { a, title, desc };
};
const collection = () => ({
  '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE}/blog/#page`,
  url: `${SITE}/blog/`, name: '警備の知恵袋｜SAIZEN警備保障株式会社', inLanguage: 'ja',
  description: '広島の警備会社SAIZEN警備保障による、警備の料金・依頼方法・交通誘導の知識・警備員の仕事についての解説記事。',
  publisher: { '@id': ORG_ID },
  mainEntity: {
    '@type': 'ItemList', numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/${a}/`, name: articleInfo(a).title })),
  },
});
const blogBreadcrumb = () => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: '警備の知恵袋' },
  ],
});

// ---- トップの「よくあるご質問」（画面の文と FAQPage の JSON-LD を同じ中身で作る） ----
const FAQ = () => {
  const b = R.base, p = n => fmt(n) + '円';
  return [
    { q: '警備の料金はいくらですか？',
      a: `警備員1名1日（9時間拘束・実働8時間）あたり、月〜土の日勤は${p(b['平日']['日勤'])}、夜勤は${p(b['平日']['夜勤'])}、日曜・祝日は日勤${p(b['日曜祝日']['日勤'])}・夜勤${p(b['日曜祝日']['夜勤'])}です（すべて税抜）。土曜日も平日と同じ料金です。夜間は夜勤料金として最初から決まっており、深夜割増を後から加算することはありません。`,
      link: ['料金表を見る', '/price/'] },
    { q: '見積もりは無料ですか？',
      a: 'はい、無料です。Webの無料見積もりでは、人数・日数・曜日などを選ぶだけで、その場で概算料金が分かります。',
      link: ['無料見積もりへ', '/estimate/'] },
    { q: 'どこまで来てもらえますか？',
      a: '広島県内全域に対応しています。広島市・東広島市・呉市・福山市・廿日市市など、市町ごとの依頼のポイントも記事で紹介しています。',
      link: ['広島県の市町別 警備依頼ガイド', '/blog68/'] },
    { q: '急な依頼や直前の依頼にも対応できますか？',
      a: `前日・当日などのご依頼でも割増はなく、同じ料金です。ただし警備員の空き状況によっては対応できない場合があるため、お早めにお電話（${COMPANY.tel}、24時間365日受付）でご相談ください。`,
      link: null },
    { q: '資格を持った警備員（検定2級）を配置できますか？',
      a: 'はい。交通誘導警備業務検定2級の資格者は、1名1日あたり3,000円（税抜）の追加で配置できます。',
      link: ['料金表を見る', '/price/'] },
    { q: '依頼から当日までの流れを教えてください。',
      a: '料金チェック・無料見積もりのあと、依頼フォームで日時と現場を入力します。契約書をオンラインで確認・同意いただき、当日は警備員が現場にうかがいます。お電話でのご依頼も受け付けています。',
      link: ['警備を依頼する', '/order/'] },
  ];
};
const faqHtml = () => [
  '<!-- faq:start （tools/sync-seo.mjs が作る。直接は直さない） -->',
  '<section class="sec faq-sec" aria-labelledby="faqTitle">',
  '  <div class="wrap">',
  '    <div class="sec-head">',
  '      <span class="eyebrow">FAQ</span>',
  '      <h2 class="sec-title" id="faqTitle">よくあるご質問</h2>',
  '    </div>',
  '    <div class="faq-list">',
  ...FAQ().map((f, i) => [
    `      <details class="faq-item"${i === 0 ? ' open' : ''}>`,
    `        <summary><span class="faq-q" aria-hidden="true">Q</span><span class="faq-qt">${f.q}</span></summary>`,
    `        <div class="faq-a"><p>${f.a.split(COMPANY.tel).join(`<a href="tel:${COMPANY.tel}">${COMPANY.tel}</a>`)}</p>${f.link ? `<a href="${f.link[1]}" class="text-link">${f.link[0]}<svg class="i i-sm" aria-hidden="true"><use href="/images/icons.svg#i-arrow"/></svg></a>` : ''}</div>`,
    '      </details>',
  ].join('\n')),
  '    </div>',
  '  </div>',
  '</section>',
  '<!-- faq:end -->',
].join('\n');
const faqLd = () => ({
  '@context': 'https://schema.org', '@type': 'FAQPage', '@id': `${SITE}/#faq`,
  mainEntity: FAQ().map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
function setFaq(s) {
  if (s.includes('<!-- faq:start')) return s.replace(/<!-- faq:start[\s\S]*?<!-- faq:end -->/, faqHtml());
  const anchor = '<!-- ============================================================\n     お問い合わせ';
  if (!s.includes(anchor)) throw new Error('index.html: FAQ を入れる場所が見つからない');
  return s.replace(anchor, faqHtml() + '\n\n' + anchor);
}

// ---- JSON-LD の入れ替え ----
const LD_RE = /([ \t]*)<script type="application\/ld\+json">\n?([\s\S]*?)\n?[ \t]*<\/script>/g;
const block = (obj, ind = '  ') => `${ind}<script type="application/ld+json">\n${JSON.stringify(obj, (k, v) => v === undefined ? undefined : v, 2).split('\n').map(l => ind + l).join('\n')}\n${ind}</script>`;
function setLd(s, match, obj) {
  let done = false;
  s = s.replace(LD_RE, (all, ind, body) => {
    let j; try { j = JSON.parse(body); } catch { return all; }
    if (!done && match(j)) { done = true; return block(obj, ind || '  '); }
    return all;
  });
  if (!done) s = s.replace('</head>', block(obj) + '\n</head>');
  return s;
}
function editLd(s, match, fn) {
  return s.replace(LD_RE, (all, ind, body) => {
    let j; try { j = JSON.parse(body); } catch { return all; }
    if (!match(j)) return all;
    return block(fn(j), ind || '  ');
  });
}
const UPDATED_RE = /[ \t]*<time class="article-updated"[^>]*>[^<]*<\/time>\r?\n?/;
const stripLd = s => s.replace(LD_RE, '').replace(/<!-- faq:start[\s\S]*?<!-- faq:end -->/, '').replace(UPDATED_RE, '').split('\n').filter(l => l.trim() !== '').join('\n');

const type = t => j => j['@type'] === t;
const id = i => j => j['@id'] === i;
const PLAN = {
  'index.html': s => setLd(setLd(setLd(setFaq(s), type('LocalBusiness'), org()), type('WebSite'), website()), type('FAQPage'), faqLd()),
  'company/index.html': s => setLd(s, type('AboutPage'), aboutPage()),
  'price/index.html': s => setLd(s, id(`${SITE}/price/#service`), priceService()),
  'recruit/index.html': s => setLd(setLd(s, id(`${SITE}/recruit/#job-part`), job('part')), id(`${SITE}/recruit/#job-full`), job('full')),
  'contact/index.html': s => setLd(s, type('ContactPage'), contactPage()),
  'blog/index.html': s => setLd(setLd(s, type('CollectionPage'), collection()), type('BreadcrumbList'), blogBreadcrumb()),
};
for (const a of fs.readdirSync(root).filter(d => /^blog\d+$/.test(d))) {
  PLAN[`${a}/index.html`] = s => setUpdated(editLd(s, type('Article'), j => ({
    ...j,
    image: j.image || `${SITE}/images/og-image.png`,
    author: { ...j.author, '@id': ORG_ID },
    publisher: { '@type': 'Organization', '@id': ORG_ID, name: COMPANY.name, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/images/logo-08a.png` } },
  })));
}
// 記事の公開日の横に、構造化データの dateModified と同じ「更新日」を出す（公開日と同じなら出さない）
function setUpdated(s) {
  let pub, mod;
  for (const m of s.matchAll(LD_RE)) { try { const j = JSON.parse(m[2]); if (j['@type'] === 'Article') { pub = j.datePublished; mod = j.dateModified; } } catch {} }
  s = s.replace(UPDATED_RE, '');
  if (!pub || !mod || mod.slice(0, 10) <= pub.slice(0, 10)) return s;
  const d = mod.slice(0, 10), [y, mo, da] = d.split('-');
  const tag = `<time class="article-updated" datetime="${d}">更新 ${y}年${mo}月${da}日</time>`;
  const re = /(<div class="article-meta">\n([ \t]*)<span class="article-cat">[^<]*<\/span>\n[ \t]*<span>[^<]*<\/span>\n)/;
  if (!re.test(s)) throw new Error('記事の日付の場所が見つからない');
  return s.replace(re, (all, head, ind) => `${head}${ind}${tag}\n`);
}

const report = []; let failed = 0;
for (const [p, fn] of Object.entries(PLAN)) {
  const before = read(p);
  const after = fn(before);
  if (stripLd(before) !== stripLd(after)) { failed++; report.push(`FAIL ${p}  JSON-LD 以外が変わる`); continue; }
  for (const m of after.matchAll(LD_RE)) { try { JSON.parse(m[2]); } catch { failed++; report.push(`FAIL ${p}  JSON-LD が壊れる`); } }
  if (after !== before) write(p, after);
}

// ---- llms.txt ----
const pagesList = [
  ['トップ', '/', '会社の紹介、かんたん料金チェック、依頼の流れ'],
  ['料金表', '/price/', '日勤・夜勤・日祝の単価、残業単価、追加料金、よくある質問'],
  ['無料見積もり', '/estimate/', '人数・日数・曜日・残業・無線機から概算料金を自動計算'],
  ['警備のご依頼', '/order/', '日程と現場を入力して依頼するフォーム'],
  ['業務案内', '/service/', '交通誘導警備・イベント警備・駐車場警備の内容'],
  ['会社概要', '/company/', '会社情報、私たちの想い、警備業者標識'],
  ['採用情報', '/recruit/', '警備員（アルバイト・正社員）の募集要項と応募フォーム'],
  ['お問い合わせ', '/contact/', '見積もり・相談・採用の問い合わせフォーム'],
  ['警備の知恵袋', '/blog/', '警備の料金・依頼方法・現場の知識の解説記事'],
];
const llms = [
  `# ${COMPANY.name}`,
  '',
  `> 広島県の交通誘導警備・雑踏警備（イベント警備）・駐車場警備の会社です。料金表を公開しており、Webで料金の確認から見積もり・依頼までできます。電話・Webとも24時間365日受け付けています。`,
  '',
  '## 会社情報',
  `- 会社名：${COMPANY.name}（${COMPANY.alternateName[1]}）`,
  `- 所在地：〒${COMPANY.postalCode} ${COMPANY.region}${COMPANY.locality}${COMPANY.street}`,
  `- 電話：${COMPANY.tel}（24時間365日対応）`,
  `- メール：${COMPANY.email}`,
  `- 代表取締役：${COMPANY.representative}`,
  `- 設立：${COMPANY.founded}年`,
  `- 警備業の認定：${COMPANY.license}`,
  `- 対応エリア：${COMPANY.area}`,
  '- 業務：2号警備（交通誘導警備・雑踏警備）、イベント警備、駐車場警備',
  '',
  '## 料金（税抜・警備員1名1日、9時間拘束／実働8時間）',
  '| 区分 | 日勤 | 夜勤 |',
  '|---|---|---|',
  `| 月〜土 | ${fmt(R.base['平日']['日勤'])}円 | ${fmt(R.base['平日']['夜勤'])}円 |`,
  `| 日曜・祝日 | ${fmt(R.base['日曜祝日']['日勤'])}円 | ${fmt(R.base['日曜祝日']['夜勤'])}円 |`,
  '',
  `- 残業単価（1時間）：月〜土 日勤 ${fmt(R.overtime['平日']['日勤'])}円・夜勤 ${fmt(R.overtime['平日']['夜勤'])}円／日曜・祝日 日勤 ${fmt(R.overtime['日曜祝日']['日勤'])}円・夜勤 ${fmt(R.overtime['日曜祝日']['夜勤'])}円`,
  '- 土曜日は平日と同じ料金。夜勤は深夜割増を後から加算せず、上記の夜勤料金で請求',
  '- 急ぎ・直前の依頼も割増なし。半日請求はなく1日単位',
  '- 無線機：500円／台・日。検定2級の資格者：3,000円／名・日。高速道路・駐車場料金は実費。カラーコーン等の資機材は別途見積もり',
  '- 消費税は別途（10%）',
  `- 詳細：${SITE}/price/`,
  '',
  '## 依頼の流れ',
  `1. 料金チェック・無料見積もり（${SITE}/estimate/）`,
  `2. 依頼フォームで日時と現場を入力（${SITE}/order/）`,
  '3. 契約書をオンラインで確認',
  '4. 当日、警備員が現場で警備',
  '',
  '## 主なページ',
  ...pagesList.map(([n, u, d]) => `- [${n}](${SITE}${u})：${d}`),
  '',
  '## 警備の知恵袋（記事）',
  ...articles.map(a => { const i = articleInfo(a); return `- [${i.title}](${SITE}/${a}/)${i.desc ? '：' + i.desc : ''}`; }),
  '',
].join('\n');
if (!fs.existsSync(path.join(root, 'llms.txt')) || read('llms.txt') !== llms) write('llms.txt', llms);

// ---- sitemap.xml ----
let sm = read('sitemap.xml');
if (!sm.includes(`<loc>${SITE}/privacy/</loc>`)) {
  sm = sm.replace('</urlset>', `  <url>\n    <loc>${SITE}/privacy/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>\n</urlset>`);
}
const fileOf = u => { const p = u.replace(SITE, ''); return p === '/' ? 'index.html' : p.replace(/^\//, '') + 'index.html'; };
const dirty = new Set(execSync('git status --porcelain', { cwd: root }).toString().split('\n').filter(Boolean).map(l => l.slice(3).trim()));
sm = sm.replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>[^<]*<\/lastmod>/g, (all, loc) => {
  const f = fileOf(loc);
  let d = execSync(`git log -1 --format=%cs -- "${f}"`, { cwd: root }).toString().trim() || today;
  if (dirty.has(f) || pending.has(f)) d = today;
  return all.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${d}</lastmod>`);
});
if (sm !== read('sitemap.xml')) write('sitemap.xml', sm);

// ---- 書き込み ----
for (const [p, s] of pending) {
  const crlf = fs.existsSync(path.join(root, p)) && readRaw(p).includes('\r\n');
  if (WRITE) fs.writeFileSync(path.join(root, p), crlf ? s.replace(/\n/g, '\r\n') : s);
}
console.log(report.join('\n'));
console.log(`${pending.size} files to change, ${failed} failed${WRITE ? ' (written)' : ' (dry run)'}`);
process.exit(failed ? 1 : 0);
