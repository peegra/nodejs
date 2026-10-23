import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 公開用に 1 ファイルの HTML にまとめる（dist/artifact.html）。
// 公開先は <html>/<head>/<body> を自動で付けるので、それらのタグは外し、モジュールは中身を直接埋め込む。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

const strip = (src) => src.replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const script = ['src/objects.js', 'src/physics.js', 'src/game.js'].map((f) => `// ---- ${f} ----\n${strip(read(f))}`).join('\n');

let html = read('index.html')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/g, '')
  .replace(/<\/?head>\s*/g, '')
  .replace(/<\/?body>\s*/g, '')
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace('<script type="module" src="src/game.js"></script>', () => `<script>\n(() => {\n${script}\n})();\n</script>`);

mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
writeFileSync(path.join(ROOT, 'dist/artifact.html'), html);
console.log(`dist/artifact.html を書き出しました（${Math.round(html.length / 1024)}KB）`);
