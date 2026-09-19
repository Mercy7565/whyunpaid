/**
 * Copies the pdf.js runtime assets into public/ so the viewer can load them
 * from a same-origin URL. Runs on postinstall and before build; silently
 * no-ops if pdfjs-dist is absent.
 *
 * Two things are needed, not one:
 *
 *  - the worker, which does the parsing off the main thread;
 *  - `standard_fonts/`, because the specimen PDFs are typeset in the standard
 *    PDF fonts, which by definition are NOT embedded in the file. pdf.js has to
 *    fetch its own copies to draw them. Without these the render hangs on a
 *    404 and the viewer sits on a skeleton forever, which is exactly what
 *    happened on the first production deploy.
 */
import { copyFile, cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  const entry = require.resolve('pdfjs-dist/package.json');
  const root = dirname(entry);
  await mkdir('public', { recursive: true });

  const workerCandidates = [
    join(root, 'build', 'pdf.worker.min.mjs'),
    join(root, 'build', 'pdf.worker.mjs'),
    join(root, 'legacy', 'build', 'pdf.worker.min.mjs'),
  ];
  const worker = workerCandidates.find((path) => existsSync(path));
  if (worker) {
    await copyFile(worker, join('public', 'pdf.worker.min.mjs'));
    console.log('[copy-pdf-worker] worker copied from', worker);
  } else {
    console.warn('[copy-pdf-worker] no worker build found; viewer will fall back to text.');
  }

  const fonts = join(root, 'standard_fonts');
  if (existsSync(fonts)) {
    await cp(fonts, join('public', 'standard_fonts'), { recursive: true });
    console.log('[copy-pdf-worker] standard fonts copied from', fonts);
  } else {
    console.warn('[copy-pdf-worker] no standard_fonts directory; non-embedded fonts will not draw.');
  }
} catch {
  console.warn('[copy-pdf-worker] pdfjs-dist not installed yet; skipping.');
}
