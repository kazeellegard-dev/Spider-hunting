// Inlines CSS/JS into one self-contained HTML file (easy to share for device checks).
// Usage: node web/tools/bundle.mjs <out.html> [--fragment]
//   --fragment: emit only <title>/<style>/body/scripts (for hosts that add their own <html> skeleton)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(webDir, '..', 'dist', 'spider-hunting.html');
const fragment = process.argv.includes('--fragment');

const html = readFileSync(join(webDir, 'index.html'), 'utf8');
const css = readFileSync(join(webDir, 'style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(src => `<script>\n${readFileSync(join(webDir, src), 'utf8')}\n</script>`).join('\n');
const icon = 'data:image/svg+xml;base64,' + readFileSync(join(webDir, 'icons/icon.svg')).toString('base64');
const body = html.slice(html.indexOf('<!-- BODY:START -->'), html.indexOf('<!-- BODY:END -->'));
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800;900&display=swap">';
const head = `<title>クモのすハンティング</title>\n${fonts}\n<link rel="icon" href="${icon}">\n<style>\n${css}\n</style>`;
const noSw = '<script>window.SH_NO_SW = true;</script>';

const doc = fragment
  ? `${head}\n${body}\n${noSw}\n${js}\n`
  : `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${noSw}\n${js}\n</body>\n</html>\n`;
writeFileSync(out, doc);
console.log(`wrote ${out} (${(doc.length / 1024).toFixed(1)} KB)`);
