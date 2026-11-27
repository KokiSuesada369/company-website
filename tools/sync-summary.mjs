// 知恵袋の記事のタイトルの下に「この記事の要点」を入れる。
// 中身は tools/article-summaries.json（記事ごとに3行）。文を直すときは JSON を直して、このスクリプトを実行する。
//   node tools/sync-summary.mjs          … 確認だけ（ファイルは変えない）
//   node tools/sync-summary.mjs --write  … 書き込む
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const S = JSON.parse(fs.readFileSync(path.join(root, 'tools/article-summaries.json'), 'utf8'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BLOCK_RE = /\n[ \t]*<!-- summary:start[\s\S]*?<!-- summary:end -->\n?/;
const block = (ind, items) => [
  `${ind}<!-- summary:start （tools/sync-summary.mjs が作る。文は tools/article-summaries.json で直す） -->`,
  `${ind}<div class="article-summary">`,
  `${ind}  <p class="article-summary-title">この記事の要点</p>`,
  `${ind}  <ul>`,
  ...items.map(t => `${ind}    <li>${esc(t)}</li>`),
  `${ind}  </ul>`,
  `${ind}</div>`,
  `${ind}<!-- summary:end -->`,
].join('\n') + '\n';

let changed = 0, failed = 0;
const articles = fs.readdirSync(root).filter(d => /^blog\d+$/.test(d));
for (const a of articles) {
  const f = path.join(root, a, 'index.html');
  const raw = fs.readFileSync(f, 'utf8'); const crlf = raw.includes('\r\n');
  const before = raw.replace(/\r\n/g, '\n');
  let s = before.replace(BLOCK_RE, '');
  const items = S[a];
  if (!items) { console.log(`なし ${a}（要点が未登録）`); }
  else {
    if (items.length < 2 || items.length > 4) { failed++; console.log(`FAIL ${a} 要点は2〜4行にする`); continue; }
    const m = s.match(/\n([ \t]*)<h1 class="article-title">[^\n]*<\/h1>\n/);
    if (!m) { failed++; console.log(`FAIL ${a} タイトルが見つからない`); continue; }
    const at = m.index + m[0].length;
    s = s.slice(0, at) + '\n' + block(m[1], items) + s.slice(at);
  }
  // 要点以外が変わっていないこと
  if (s.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n') !== before.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n')) { failed++; console.log(`FAIL ${a} 要点以外が変わる`); continue; }
  if (s !== before) { changed++; if (WRITE) fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s); }
}
for (const k of Object.keys(S)) if (!articles.includes(k)) console.log(`注意 ${k} の記事がない`);
console.log(`${articles.length} 記事, ${changed} to change, ${failed} failed${WRITE ? ' (written)' : ' (dry run)'}`);
