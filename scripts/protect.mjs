// Wraps the single-file build in a password page. The app is gzipped and
// encrypted with AES-256-GCM under a key derived from the password
// (PBKDF2-SHA256), so the published file reveals nothing without it.
//
//   SITE_PASSWORD=... node scripts/protect.mjs [in.html] [out.html]
//
// The password is read from the environment and never written to disk.

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { gzipSync as gzip } from 'node:zlib';

const { subtle } = webcrypto;
const password = process.env.SITE_PASSWORD;
if (!password || password.length < 12) {
  console.error('Set SITE_PASSWORD (at least 12 characters).');
  process.exit(1);
}
const input = process.argv[2] ?? 'dist-artifact/gods-eye-view.html';
const output = process.argv[3] ?? 'dist-artifact/gods-eye-view-protected.html';
const ITERATIONS = 600000;

const html = readFileSync(input);
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, gzip(html, { level: 9 })));
const b64 = (u8) => Buffer.from(u8).toString('base64');

const page = readFileSync(new URL('./gate.html', import.meta.url), 'utf8')
  .replace('__SALT__', b64(salt))
  .replace('__IV__', b64(iv))
  .replace('__ITER__', String(ITERATIONS))
  .replace('__DATA__', b64(cipher));
writeFileSync(output, page);
console.log(`${output} ${(page.length / 1e6).toFixed(2)} MB (from ${(html.length / 1e6).toFixed(2)} MB)`);
