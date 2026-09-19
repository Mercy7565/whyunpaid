/**
 * The Path A compiler.
 *
 * Takes the authored specimen sources, typesets each one into a real PDF with a
 * real text layer, and resolves every clause quote to a character range and a
 * page. It emits, per policy:
 *
 *   public/policies/<slug>.pdf         the specimen document
 *   public/policies/<slug>.txt         the canonical plain text
 *   public/policies/<slug>.spans.json  a box for every word, keyed by char range
 *   src/policies/compiled/<slug>.json  the CompiledPolicy the app loads
 *
 * The spans file is what makes the inspector able to highlight the exact words
 * a clause came from: because this script both lays the page out and records
 * the boxes, a character offset maps to rectangles without any guessing at
 * render time.
 *
 * It fails loudly. A quote that cannot be found in the document, a quote longer
 * than 25 words, or a clause with no provenance stops the build, because every
 * one of those is the product quietly losing the only thing it promises.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SPECIMENS, buildPolicySource } from './policy-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public', 'policies');
const COMPILED_DIR = join(ROOT, 'src', 'policies', 'compiled');

/* A4 in points, and the one ink colour: --ground on unpainted paper. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 62;
const MARGIN_TOP = 68;
const MARGIN_BOTTOM = 62;
const INK = rgb(30 / 255, 39 / 255, 72 / 255);
const RULE = rgb(47 / 255, 98 / 255, 133 / 255);

const MAX_QUOTE_WORDS = 25;

/* -------------------------------------------------------------------------- */
/* Canonical text                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Builds the plain text of the document and the list of styled blocks that make
 * it up. The text is the concatenation of the blocks separated by a blank line,
 * so a block knows its own start offset and every word inside it can be located
 * without re-searching the document.
 */
function canonicalise(document) {
  let text = '';
  const blocks = [];

  const push = (style, content) => {
    if (text.length > 0) text += '\n\n';
    blocks.push({ style, content, start: text.length });
    text += content;
  };

  push('title', document.title);
  push('subtitle', document.subtitle);
  for (const section of document.sections) {
    push('heading', section.heading);
    for (const paragraph of section.paragraphs) push('body', paragraph);
  }

  return { text, blocks };
}

/* -------------------------------------------------------------------------- */
/* Typesetting                                                                */
/* -------------------------------------------------------------------------- */

function tokenise(content, offset) {
  const words = [];
  for (const match of content.matchAll(/\S+/g)) {
    words.push({ text: match[0], start: offset + (match.index ?? 0) });
  }
  return words;
}

function wrap(words, font, size, maxWidth) {
  const lines = [];
  const spaceWidth = font.widthOfTextAtSize(' ', size);
  let current = [];
  let width = 0;

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(word.text, size);
    if (current.length > 0 && width + spaceWidth + wordWidth > maxWidth) {
      lines.push(current);
      current = [];
      width = 0;
    }
    if (current.length > 0) width += spaceWidth;
    current.push({ ...word, width: wordWidth });
    width += wordWidth;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

async function typeset(pdf, blocks) {
  const roman = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const STYLES = {
    title: { font: bold, size: 19, leading: 25, before: 0, after: 8 },
    subtitle: { font: italic, size: 10, leading: 14, before: 0, after: 20 },
    heading: { font: bold, size: 12.5, leading: 18, before: 16, after: 6 },
    body: { font: roman, size: 10.5, leading: 15.4, before: 0, after: 10 },
  };

  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
  const spans = [];
  const pages = [];

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN_TOP;
  };

  for (const block of blocks) {
    const style = STYLES[block.style] ?? STYLES.body;
    const words = tokenise(block.content, block.start);
    const lines = wrap(words, style.font, style.size, maxWidth);

    y -= style.before;

    for (const line of lines) {
      if (y - style.leading < MARGIN_BOTTOM) newPage();

      let x = MARGIN_X;
      const spaceWidth = style.font.widthOfTextAtSize(' ', style.size);

      for (const word of line) {
        page.drawText(word.text, { x, y, size: style.size, font: style.font, color: INK });
        /*
         * The box is recorded in PDF user space: origin bottom-left, y is the
         * bottom edge of the box. The viewer converts to screen space with the
         * page height and the render scale, so nothing here depends on a zoom
         * level chosen later.
         */
        spans.push([
          word.start,
          word.start + word.text.length,
          pages.length,
          round(x),
          round(y - style.size * 0.22),
          round(word.width),
          round(style.size * 1.16),
        ]);
        x += word.width + spaceWidth;
      }
      y -= style.leading;
    }

    y -= style.after;

    if (block.style === 'subtitle') {
      if (y - 12 < MARGIN_BOTTOM) newPage();
      page.drawLine({
        start: { x: MARGIN_X, y: y + 6 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: y + 6 },
        thickness: 0.6,
        color: RULE,
      });
      y -= 12;
    }
  }

  /* Folio, drawn last so it is never pushed around by the flow above. */
  pages.forEach((p, index) => {
    const label = `Specimen wording - page ${index + 1} of ${pages.length}`;
    const width = roman.widthOfTextAtSize(label, 8.5);
    p.drawText(label, {
      x: (PAGE_WIDTH - width) / 2,
      y: MARGIN_BOTTOM - 28,
      size: 8.5,
      font: roman,
      color: RULE,
    });
  });

  return { spans, pageCount: pages.length };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function locate(quote, text, spans, label) {
  if (wordCount(quote) > MAX_QUOTE_WORDS) {
    throw new Error(
      `${label}: source quote is ${wordCount(quote)} words, the limit is ${MAX_QUOTE_WORDS}\n  "${quote}"`,
    );
  }

  const charStart = text.indexOf(quote);
  if (charStart < 0) {
    throw new Error(`${label}: source quote does not appear in the wording\n  "${quote}"`);
  }
  if (text.indexOf(quote, charStart + 1) >= 0) {
    throw new Error(
      `${label}: source quote appears more than once, so it cannot identify a location\n  "${quote}"`,
    );
  }

  const charEnd = charStart + quote.length;
  const span = spans.find(([start, end]) => end > charStart && start < charEnd);
  if (!span) throw new Error(`${label}: no typeset word covers the quote`);

  return { sourceQuote: quote, page: span[2], charStart, charEnd, confidence: 'high' };
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */
/* -------------------------------------------------------------------------- */

function toCompiledClause(clause, provenance, exemptionProvenance) {
  const { quote, exemptionQuote, confidence, ...rest } = clause;
  void quote;
  void exemptionQuote;
  void confidence;
  const compiled = { ...rest, provenance };
  if (exemptionProvenance) compiled.exemptionProvenance = exemptionProvenance;
  return compiled;
}

async function buildOne(spec) {
  const source = buildPolicySource(spec);
  const { text, blocks } = canonicalise(source.document);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${source.name} - synthetic specimen wording`);
  pdf.setSubject('Synthetic specimen health insurance wording generated for WhyUnpaid?');
  pdf.setProducer('WhyUnpaid? policy compiler');
  pdf.setCreator('WhyUnpaid? policy compiler');
  /* A fixed date keeps the generated bytes stable between runs. */
  pdf.setCreationDate(new Date(Date.UTC(2024, 0, 1)));
  pdf.setModificationDate(new Date(Date.UTC(2024, 0, 1)));

  const { spans, pageCount } = await typeset(pdf, blocks);

  const clauses = source.clauses.map((clause) => {
    const label = `${source.name} ${clause.ref}`;
    const provenance = locate(clause.quote, text, spans, label);
    const exemption = clause.exemptionQuote
      ? locate(clause.exemptionQuote, text, spans, `${label} (exemption)`)
      : undefined;
    return toCompiledClause(clause, provenance, exemption);
  });

  const compiled = {
    id: source.id,
    name: source.name,
    synthetic: true,
    slug: source.slug,
    summary: source.summary,
    shape: source.shape,
    clauses,
  };

  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(COMPILED_DIR, { recursive: true });

  await writeFile(join(PUBLIC_DIR, `${source.slug}.pdf`), await pdf.save());
  await writeFile(join(PUBLIC_DIR, `${source.slug}.txt`), text, 'utf8');
  await writeFile(
    join(PUBLIC_DIR, `${source.slug}.spans.json`),
    JSON.stringify({
      slug: source.slug,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      pages: pageCount,
      spans,
    }),
    'utf8',
  );
  await writeFile(
    join(COMPILED_DIR, `${source.slug}.json`),
    `${JSON.stringify(compiled, null, 2)}\n`,
    'utf8',
  );

  return {
    slug: source.slug,
    clauses: clauses.length,
    pages: pageCount,
    words: spans.length,
    characters: text.length,
  };
}

const results = [];
for (const spec of SPECIMENS) {
  results.push(await buildOne(spec));
}

console.log('[policies] compiled');
for (const result of results) {
  console.log(
    `  ${result.slug.padEnd(20)} ${String(result.clauses).padStart(2)} clauses  ${result.pages} pages  ${result.words} words  ${result.characters} chars`,
  );
}
