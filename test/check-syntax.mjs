// 브라우저 없이 index.html 인라인 <script>의 문법만 검사한다.
// new Function(code)는 코드를 "컴파일"만 하고 실행하지 않으므로,
// Phaser/firebase 등 외부 전역 미정의와 무관하게 SyntaxError만 잡아낸다.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, failed = 0, checked = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/.test(attrs)) continue; // 외부 스크립트는 건너뜀
  const code = m[2];
  if (!code.trim()) continue;
  idx++;
  checked++;
  try {
    // 모듈/일반 모두 커버하도록 일반 함수 컴파일 시도
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    failed++;
    const line = (html.slice(0, m.index).match(/\n/g) || []).length + 1;
    console.error(`✗ inline script #${idx} (around line ${line}): ${e.name}: ${e.message}`);
  }
}
if (failed === 0) {
  console.log(`syntax ok — ${checked} inline script(s) checked`);
  process.exit(0);
} else {
  console.error(`syntax FAILED — ${failed}/${checked} inline script(s) have errors`);
  process.exit(1);
}
