// index.html이 참조하는 js/*.js 게임 스크립트를 로드 순서대로 이어붙여 반환한다.
// (클래식 스크립트 분할 구조라 이어붙이면 원래의 단일 스크립트와 의미가 같다)
import { readFileSync } from 'node:fs';

export function loadGameCode() {
  const root = new URL('../../', import.meta.url);
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const srcs = [...html.matchAll(/<script\s+src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  if (!srcs.length) throw new Error('index.html에서 js/ 스크립트 태그를 찾지 못함');
  return srcs.map(src => readFileSync(new URL(src, root), 'utf8')).join('\n;\n');
}
