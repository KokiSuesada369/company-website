// ============================================================
// 全公開ページのヘッダー・フッター・スマホ下のボタン帯を index.html と同じにする
//
// 使い方（リポジトリ直下で）:
//   node tools/sync-layout.mjs            … 確認だけ（ファイルは変えない）
//   node tools/sync-layout.mjs --write    … 実際に書き換える
//
// しくみ:
//   - index.html の <!-- site-header:start/end --> と <!-- site-footer:start/end --> の間を
//     「正」として、各ページの同じ場所に入れる。ヘッダーを変えるときは index.html だけ直して、これを実行する
//   - 今いるページのメニュー項目に aria-current を付ける（ブログ記事は「警備の知恵袋」）
//   - ヘッダーとフッターの間の本文・title・description・OGP・構造化データ・GA が
//     1文字でも変わるときは、そのページを書き換えずに FAIL と表示する
//   - admin/ と contract/ は対象外
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const readRaw = p => fs.readFileSync(path.join(root, p), 'utf8');
const read = p => readRaw(p).replace(/\r\n/g, '\n');

const index = read('index.html');
const block = (name) => {
  const m = index.match(new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`));
  if (!m) throw new Error(`marker ${name} not found in index.html`);
  return m[0];
};
const HEADER = block('site-header');
const FOOTER = block('site-footer');

const pages = fs.readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory() && !['admin', 'contract', 'docs', 'js', 'images', 'tools', '.git'].includes(d.name)
    && fs.existsSync(path.join(root, d.name, 'index.html')))
  .map(d => `${d.name}/index.html`)
  .concat(['404.html']);

function currentFor(p) {
  const dir = p.split('/')[0];
  if (['service', 'price', 'order', 'company', 'recruit', 'blog'].includes(dir)) return [`/${dir}/`, 'page'];
  if (/^blog\d+$/.test(dir)) return ['/blog/', 'true'];
  return null;
}

function headerFor(p) {
  const cur = currentFor(p);
  if (!cur) return HEADER;
  const [href, val] = cur;
  // ヘッダーのメニューとスマホ用メニューの両方に印を付ける
  const out = HEADER.split(`<a href="${href}">`).join(`<a href="${href}" aria-current="${val}">`);
  const n = out.split(`aria-current="${val}"`).length - 1;
  if (n !== 2) throw new Error(`${p}: aria-current count ${n}`);
  return out;
}

const MENU_RE = /[ \t]*(?:\/\/[^\n]*(?:ハンバーガー|Hamburger|Nav)[^\n]*\n)?[ \t]*const ham\s*=[\s\S]*?this\.closest\('\.has-dropdown'\)\.classList\.toggle\('open'\);\s*\}\s*\}\);\s*\}\);[ \t]*\n/;
const PAD_RE = /[ \t]*(?:\/\/ Fixed header: set body padding-top dynamically\n)?[ \t]*document\.addEventListener\('DOMContentLoaded', function\(\) \{\s*var header = document\.getElementById\('header'\);\s*document\.body\.style\.paddingTop = header\.offsetHeight \+ 'px';\s*\}\);[ \t]*\n/;
const OLD_FONT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap';
const NEW_FONT = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&family=Noto+Sans+JP:wght@400;500;600;700;900&display=swap';

const between = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); return (i < 0 || j < 0) ? null : s.slice(i + a.length, j); };
const headInfo = s => ({
  title: (s.match(/<title>[\s\S]*?<\/title>/) || [''])[0],
  desc: (s.match(/<meta name="description"[^>]*>/) || [''])[0],
  canonical: (s.match(/<link rel="canonical"[^>]*>/) || [''])[0],
  ogp: (s.match(/<meta property="og:[^>]*>/g) || []).join('\n'),
  ld: (s.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join('\n'),
  ga: (s.match(/G-S0YKC08K5X/g) || []).length,
});

const report = [];
let changed = 0;
let failed = 0;
for (const p of pages) {
  const before = read(p);
  let s = before;
  const notes = [];
  try {
    // 1) ヘッダー
    const hdr = headerFor(p);
    if (s.includes('<!-- site-header:start -->')) {
      s = s.replace(/<!-- site-header:start -->[\s\S]*?<!-- site-header:end -->/, hdr);
    } else {
      const hm = s.match(/<header id="header">[\s\S]*?<\/header>/g);
      if (!hm || hm.length !== 1) throw new Error('old header not found exactly once');
      s = s.replace(/(?:<!-- Nav overlay -->[ \t]*\n)?<div class="nav-overlay" id="navOverlay"><\/div>[ \t]*\n?/, '');
      s = s.replace(hm[0], hdr);
    }
    // 2) フッター（＋スマホ下のボタン帯）
    if (s.includes('<!-- site-footer:start -->')) {
      s = s.replace(/<!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/, FOOTER);
    } else {
      const fm = s.match(/<footer id="footer">[\s\S]*?<\/footer>/g);
      if (!fm || fm.length !== 1) throw new Error('old footer not found exactly once');
      s = s.replace(fm[0], FOOTER);
    }
    // 3) 古いメニューの JavaScript を外す（同じ <script> 内のフォーム処理などは残す）
    s = s.replace(/<script>([\s\S]*?)<\/script>[ \t]*\n?/g, (all, body) => {
      if (!/const ham\s*=|getElementById\('header'\)/.test(body)) return all;
      let b = body.replace(MENU_RE, '').replace(PAD_RE, '');
      const rest = b.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
      if (rest === '') { notes.push('menu script block removed'); return ''; }
      notes.push('menu code removed from mixed script');
      return all.replace(body, b);
    });
    // 4) 共通スクリプト
    if (!s.includes('/js/site.js')) s = s.replace('</body>', '<script src="/js/site.js"></script>\n</body>');
    // 5) theme-color とフォント
    s = s.replace('<meta name="theme-color" content="#1a2f5e">', '<meta name="theme-color" content="#FFFFFF">');
    s = s.split(OLD_FONT).join(NEW_FONT);

    // ---- 検査 ----
    for (const bad of ['id="hamburger"', "getElementById('hamburger')", 'toggleMenu', "getElementById('header')", 'navOverlay', 'id="gnav"']) {
      if (s.includes(bad)) throw new Error(`leftover: ${bad}`);
    }
    for (const m of ['site-header:start', 'site-header:end', 'site-footer:start', 'site-footer:end']) {
      if ((s.match(new RegExp(m, 'g')) || []).length !== 1) throw new Error(`marker ${m} count`);
    }
    // 本文（ヘッダーとフッターの間）は1文字も変えない
    const bodyBefore = before.includes('<!-- site-header:end -->')
      ? between(before, '<!-- site-header:end -->', '<!-- site-footer:start -->')
      : between(before, '</header>', '<footer id="footer">');
    const bodyAfter = between(s, '<!-- site-header:end -->', '<!-- site-footer:start -->');
    if (bodyBefore === null || bodyAfter === null) throw new Error('body region not found');
    if (bodyBefore.trim() !== bodyAfter.trim()) throw new Error('BODY CHANGED');
    const hb = headInfo(before), ha = headInfo(s);
    for (const k of Object.keys(hb)) if (hb[k] !== ha[k]) throw new Error(`HEAD ${k} CHANGED`);
    if (!s.includes('id="main-content"')) throw new Error('main-content missing');

    const crlf = readRaw(p).includes('\r\n');
    if (s !== before) changed++;
    if (WRITE && s !== before) fs.writeFileSync(path.join(root, p), crlf ? s.replace(/\n/g, '\r\n') : s);
    report.push(`ok   ${p}  ${notes.join(', ')}`);
  } catch (e) {
    failed++;
    report.push(`FAIL ${p}  ${e.message}`);
  }
}
console.log(report.filter(r => r.startsWith('FAIL') || !/blog\d+\//.test(r)).join('\n'));
console.log(`\n${pages.length} pages, ${changed} to change, ${failed} failed${WRITE ? ' (written)' : ' (dry run)'}`);
process.exit(failed ? 1 : 0);
