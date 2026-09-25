// Builds a single self-contained HTML page for static hosting in a sandbox
// that allows no external API: JS, CSS and the logo are inlined, the API-only
// features fall back to the in-browser analyst, and tile basemaps are hidden.
//   npm run build:artifact  →  dist-artifact/gods-eye-view.html

import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const outDir = 'dist-artifact/bundle';
process.env.VITE_STATIC = '1';
await build({ base: './', logLevel: 'warn', build: { outDir, emptyOutDir: true, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } } });

const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(outDir, href.replace(/^\.\//, '')), 'utf8');
const js = [...html.matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)].map((m) => read(m[1]));
const css = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)].map((m) => read(m[1]));
const logo = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync('public/logo.svg')).toString('base64')}`;

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const title = '<title>Municipal Eye View</title>';
const fonts = [...head.matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/g)].map((m) => m[0]).join('\n');
const body = html
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script type="module"[^>]*><\/script>/g, '')
  .replace(/src="(\.\/)?logo\.svg"/g, `src="${logo}"`);

const page = `${title}
<link rel="icon" href="${logo}" />
${fonts}
<style>
${css.join('\n')}
</style>
${body.trim()}
<script type="module">
${js.join('\n').replace(/<\/script/gi, '<\\/script')}
</script>
`;
fs.writeFileSync('dist-artifact/gods-eye-view.html', page);
console.log(`dist-artifact/gods-eye-view.html ${(page.length / 1e6).toFixed(2)} MB`);
