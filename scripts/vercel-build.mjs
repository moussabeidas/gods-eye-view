// Vercel build. With SITE_PASSWORD set in the project's environment variables,
// the site is served only as the encrypted password page: dist/ holds nothing
// else, so no unencrypted script or data can be fetched directly. Without it,
// this is the normal Vite build with the /api functions.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.env.SITE_PASSWORD) {
  run('node scripts/build-artifact.mjs');
  run('node scripts/protect.mjs dist-artifact/gods-eye-view.html dist-artifact/protected.html');
  fs.rmSync('dist', { recursive: true, force: true });
  fs.mkdirSync('dist');
  fs.copyFileSync('dist-artifact/protected.html', 'dist/index.html');
  console.log('Password-protected build written to dist/index.html');
} else {
  run('npx vite build');
}
