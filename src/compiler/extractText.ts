'use client';

/**
 * Reading a PDF into text, in the browser.
 *
 * The uploaded document never leaves the machine it was opened on unless the
 * reader explicitly asks for the model pass. pdf.js is already a dependency for
 * the inspector, so the extraction costs nothing extra, and doing it client
 * side means there is no upload endpoint to secure, rate limit or apologise for.
 */

import { PDF_WORKER_SRC, standardFontDataUrl } from '@/lib/pdfjs';

export type ExtractedDocument = {
  text: string;
  /** Character offset at which each page begins, 0-based index is page 1. */
  pageStarts: number[];
  pages: number;
  characters: number;
};

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

/**
 * Puts a blank line after a heading.
 *
 * A PDF text layer has no idea what a heading is; it just breaks lines. Without
 * this, "5. Waiting periods" and the paragraph beneath it are one block, and
 * every quotation cut from that paragraph starts with the heading. The test is
 * deliberately conservative: a short line that does not end in a full stop and
 * is followed by something that looks like the start of a sentence.
 */
export function separateHeadings(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    out.push(line);

    const trimmed = line.trim();
    const next = (lines[index + 1] ?? '').trim();
    if (trimmed.length === 0 || next.length === 0) continue;

    const looksLikeHeading =
      trimmed.length <= 64 &&
      !/[.;,:]$/.test(trimmed) &&
      (/^(?:\d+[.)]?|[IVXLC]+[.)]|part|section|clause|chapter)\b/i.test(trimmed) ||
        trimmed.split(/\s+/).length <= 6);

    if (looksLikeHeading && /^[A-Z(]/.test(next)) out.push('');
  }

  return out.join('\n');
}


type TextItemLike = { str?: string; hasEOL?: boolean };

/**
 * Joins the text items of each page into paragraphs.
 *
 * pdf.js hands back one item per run of text, with `hasEOL` where the
 * typesetter broke a line. Runs are joined with a space, end-of-line becomes a
 * newline, and a page break becomes a blank line so the sentence splitter
 * treats it as a block boundary rather than running two pages together.
 */
export async function extractPdfText(file: File): Promise<ExtractedDocument> {
  let pdfjs: typeof import('pdfjs-dist');
  try {
    pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  } catch {
    throw new PdfExtractionError('The PDF reader could not start in this browser.');
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new PdfExtractionError('That file could not be read.');
  }

  let document_: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    document_ = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: standardFontDataUrl(),
    }).promise;
  } catch {
    throw new PdfExtractionError(
      'That file is not a PDF this reader can open. If it is a scan, it has no text layer to read.',
    );
  }

  const pageStarts: number[] = [];
  let text = '';

  for (let pageNumber = 1; pageNumber <= document_.numPages; pageNumber += 1) {
    const page = await document_.getPage(pageNumber);
    const content = await page.getTextContent();

    if (text.length > 0) text += '\n\n';
    pageStarts.push(text.length);

    let line = '';
    for (const rawItem of content.items) {
      const item = rawItem as TextItemLike;
      const piece = item.str ?? '';
      if (piece.length === 0 && !item.hasEOL) continue;
      line += piece;
      if (item.hasEOL) {
        text += `${line.replace(/\s+$/, '')}\n`;
        line = '';
      } else if (!piece.endsWith(' ')) {
        line += ' ';
      }
    }
    if (line.trim().length > 0) text += line.replace(/\s+$/, '');
  }

  const cleaned = separateHeadings(text.replace(/[ \t]+\n/g, '\n'))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.replace(/\s/g, '').length < 200) {
    throw new PdfExtractionError(
      'That PDF has almost no text layer. It is probably a scan, and this tool reads text rather than images.',
    );
  }

  return {
    text: cleaned,
    pageStarts,
    pages: document_.numPages,
    characters: cleaned.length,
  };
}
