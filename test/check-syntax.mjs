// 브라우저 없이 index.html 인라인 <script>와 js/*.js 게임 스크립트의 문법만 검사한다.
// new Function(code)는 코드를 "컴파일"만 하고 실행하지 않으므로,
// Phaser/firebase 등 외부 전역 미정의와 무관하게 SyntaxError만 잡아낸다.
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
let failed = 0, checked = 0;

// 1) 인라인 스크립트
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/.test(attrs)) continue; // 외부 스크립트는 아래에서 별도 검사
  const code = m[2];
  if (!code.trim()) continue;
  idx++;
  checked++;
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    failed++;
    const line = (html.slice(0, m.index).match(/\n/g) || []).length + 1;
    console.error(`✗ inline script #${idx} (around line ${line}): ${e.name}: ${e.message}`);
  }
}

// 2) index.html이 참조하는 로컬 js/ 스크립트 (로드 순서대로)
const srcs = [...html.matchAll(/<script\s+src="(js\/[^"]+)"><\/script>/g)].map(x => x[1]);
if (!srcs.length) { console.error('✗ index.html에서 js/ 스크립트 태그를 찾지 못함'); failed++; }
for (const src of srcs) {
  checked++;
  try {
    // eslint-disable-next-line no-new-func
    new Function(readFileSync(new URL(src, root), 'utf8'));
  } catch (e) {
    failed++;
    console.error(`✗ ${src}: ${e.name}: ${e.message}`);
  }
}

if (failed === 0) {
  console.log(`syntax ok — ${checked} script(s) checked (inline + ${srcs.length} js files)`);
  process.exit(0);
} else {
  console.error(`syntax FAILED — ${failed}/${checked} script(s) have errors`);
  process.exit(1);
}
