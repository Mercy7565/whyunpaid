// Copies the pdf.js worker into public/ so the viewer can load it from a same-origin
// URL. Runs on postinstall and before build; silently no-ops if pdfjs-dist is absent.
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  const entry = require.resolve('pdfjs-dist/package.json');
  const root = dirname(entry);
  const candidates = [
    join(root, 'build', 'pdf.worker.min.mjs'),
    join(root, 'build', 'pdf.worker.mjs'),
    join(root, 'legacy', 'build', 'pdf.worker.min.mjs'),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) {
    console.warn('[copy-pdf-worker] no worker build found; viewer will fall back to text.');
    process.exit(0);
  }
  await mkdir('public', { recursive: true });
  await copyFile(src, join('public', 'pdf.worker.min.mjs'));
  console.log('[copy-pdf-worker] copied', src);
} catch {
  console.warn('[copy-pdf-worker] pdfjs-dist not installed yet; skipping.');
}
