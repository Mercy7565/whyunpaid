/**
 * The optional model pass.
 *
 * Path B works without this route. The heuristic extractor reads a policy in
 * the browser with no key, no network and no account, and the confirmation
 * table makes a person check every row before anything compiles. This endpoint
 * exists to do better on documents the regular expressions cannot place.
 *
 * Three things it is careful about:
 *
 *  - With no `ANTHROPIC_API_KEY` it returns a typed 503 rather than an error.
 *    The interface has a designed state for that and says plainly that nothing
 *    was sent anywhere.
 *  - It never invents provenance. The model is asked for a verbatim quotation;
 *    the client then has to locate that quotation in the document, and a clause
 *    whose quotation cannot be found does not compile.
 *  - The response is parsed with Zod before it is trusted. A model is an
 *    untrusted source like any other input at a boundary.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractionSchema } from '@/compiler/draft';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.WHYUNPAID_MODEL ?? 'claude-sonnet-5';
const MAX_DOCUMENT_CHARACTERS = 120_000;

const requestSchema = z.object({
  documentText: z.string().min(200).max(MAX_DOCUMENT_CHARACTERS),
});

export type CompileUnavailable = {
  available: false;
  reason: string;
  detail: string;
};

const UNAVAILABLE: CompileUnavailable = {
  available: false,
  reason: 'No model is configured for this deployment.',
  detail:
    'Nothing was sent anywhere. The clause reader on this page ran entirely in your browser, and the four specimen policies do not need a model at all.',
};

const SYSTEM = `You read Indian health insurance policy wordings and return the clauses as structured data.

Rules you must follow exactly:
- Every clause you return must carry a "quote" that is copied VERBATIM from the document, at most 25 words, and that appears exactly once in it. If you cannot find such a quotation, do not return that clause.
- Never paraphrase a quotation. Never join two separate passages into one quotation.
- Money is in whole rupees. Percentages are in basis points, so 20% is 2000 and 1% is 100.
- Waiting periods are in whole months. Thirty days is 1.
- Mark a clause "high" confidence only when the wording states the value unambiguously. Otherwise mark it "low".
- procedures must come from this list: cataract, kneeReplacement, angioplasty, cabg, herniaRepair, appendectomy, maternityDelivery, cosmeticSurgery, bariatricSurgery, dialysis.
- categories must come from this list: room, nursing, surgeon, anaesthetist, operationTheatre, pharmacy, consumables, implants, diagnostics, ambulance, nonMedical.
- The 60-month moratorium is a Moratorium clause. It is NOT a waiting period and must never be returned as one.
- Return nothing you are not reading off the page.`;

const TOOL = {
  name: 'emit_clauses',
  description: 'Return the clauses read from the policy wording.',
  input_schema: {
    type: 'object',
    properties: {
      clauses: {
        type: 'array',
        maxItems: 40,
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'SumInsured',
                'Moratorium',
                'PermanentExclusion',
                'WaitingPeriod',
                'LineItemIneligibility',
                'RoomRentCap',
                'SubLimit',
                'Deductible',
                'CoPay',
              ],
            },
            ref: { type: 'string', description: 'The clause reference as the document numbers it.' },
            title: { type: 'string' },
            quote: { type: 'string', description: 'Verbatim from the document, at most 25 words.' },
            confidence: { type: 'string', enum: ['high', 'low'] },
            amountRupees: { type: 'number' },
            perDayRupees: { type: 'number' },
            percentBps: { type: 'integer' },
            months: { type: 'integer' },
            procedures: { type: 'array', items: { type: 'string' } },
            categories: { type: 'array', items: { type: 'string' } },
            waitingKind: {
              type: 'string',
              enum: ['initial', 'specificDisease', 'preExistingDisease'],
            },
            scope: { type: 'string', enum: ['all', 'procedures', 'preExisting'] },
            limitBasis: { type: 'string', enum: ['perDayAmount', 'percentOfSumInsuredPerDay'] },
          },
          required: ['kind', 'ref', 'title', 'quote', 'confidence'],
        },
      },
    },
    required: ['clauses'],
  },
} as const;

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  return NextResponse.json(
    key ? { available: true, model: MODEL } : UNAVAILABLE,
    { status: key ? 200 : 503 },
  );
}

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json(UNAVAILABLE, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ available: true, error: 'The request was not JSON.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        available: true,
        error: `The document must be between 200 and ${MAX_DOCUMENT_CHARACTERS} characters of text.`,
      },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8_000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'emit_clauses' },
        messages: [
          {
            role: 'user',
            content: `Read the clauses out of this policy wording.\n\n<policy>\n${parsed.data.documentText}\n</policy>`,
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { available: true, error: 'The model could not be reached. The clause reader in your browser still works.' },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        available: true,
        error: `The model returned ${response.status}. The clause reader in your browser still works.`,
      },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as {
    content?: { type?: string; name?: string; input?: unknown }[];
  };

  const toolUse = payload.content?.find(
    (block) => block.type === 'tool_use' && block.name === 'emit_clauses',
  );

  const extracted = extractionSchema.safeParse(toolUse?.input);
  if (!extracted.success) {
    return NextResponse.json(
      { available: true, error: 'The model did not return clauses in the expected shape.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ available: true, model: MODEL, clauses: extracted.data.clauses });
}
