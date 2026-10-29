// Apps Script용 단일 파일 gas/index.html 을 생성합니다: node scripts/build-gas.mjs
// HtmlService는 별도 JS/CSS 파일과 ES 모듈 import 를 서빙하지 못하므로 전부 인라인으로 합칩니다.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(ROOT, p), 'utf8');

// 의존 순서대로 (main.js가 나머지를 import)
const MODULES = ['js/format.js', 'js/charts.js', 'js/theme.js', 'js/main.js'];

// ES 모듈 → 일반 스크립트: import 줄 제거, export 키워드 제거
const stripModule = (src) => src
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+(?=(async\s+)?function|const|let|class)/gm, '');

const css = (await Promise.all(['css/base.css', 'css/app.css'].map(read))).join('\n');
const js = (await Promise.all(MODULES.map(async (p) => `// ---- ${p}\n${stripModule(await read(p))}`))).join('\n');

if (/^\s*(import|export)\s/m.test(js)) throw new Error('import/export 가 남아 있습니다. stripModule 을 확인하세요.');
if (js.includes('</script')) throw new Error('JS 안에 </script 가 있어 인라인할 수 없습니다.');

// 공통: index.html 의 FOUC 방지 스크립트와 본문 골격을 그대로 사용
const page = await read('index.html');
const themeScript = page.match(/<script>[\s\S]*?<\/script>/)[0];
const body = page.match(/<body>([\s\S]*?)<script type="module"/)[1];

const html = `<!doctype html>
<html lang="ko">
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${themeScript}
  <style>
${css}
  </style>
</head>
<body>${body}<script>
(function () {
${js}
})();
</script>
</body>
</html>
`;

await writeFile(resolve(ROOT, 'gas/index.html'), html);
console.log(`gas/index.html 생성: ${(html.length / 1024).toFixed(1)}KB (CSS+JS 인라인)`);
