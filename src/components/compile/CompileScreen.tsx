'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ConfirmationTable } from '@/components/compile/ConfirmationTable';
import { ContestabilityPanel } from '@/components/ContestabilityPanel';
import { Select } from '@/components/controls/Select';
import { Slider } from '@/components/controls/Slider';
import { Switch } from '@/components/controls/Switch';
import { SkeletonBar } from '@/components/Skeleton';
import { Waterfall } from '@/components/waterfall/Waterfall';
import { buildClaim } from '@/claims/buildClaim';
import {
  DEFAULT_ASSOCIATED,
  DEFAULT_EXEMPT,
  blockingIssues,
  compileDraft,
  policyToJson,
  type DraftClause,
  type DraftPolicy,
} from '@/compiler/draft';
import { PdfExtractionError, extractPdfText } from '@/compiler/extractText';
import { extractDrafts } from '@/compiler/heuristics';
import { DISCLAIMER_ESTIMATE, DISCLAIMER_SPECIMEN } from '@/lib/copy';
import { BILL_MAX, BILL_MIN, BILL_STEP, MONTHS_MAX, MONTHS_MIN, clampBill, clampMonths } from '@/lib/scenario';
import { evaluate } from '@/vm/evaluate';
import { formatPaise } from '@/vm/format';
import { PROCEDURE_LABELS } from '@/vm/labels';
import { PROCEDURE_CODES, type CompiledPolicy, type ProcedureCode } from '@/vm/types';

type Stage = 'upload' | 'reviewing' | 'compiled';
type ModelState = 'idle' | 'running' | 'unavailable' | 'error' | 'done';

const PROCEDURE_OPTIONS = PROCEDURE_CODES.map((code) => ({
  value: code,
  label: PROCEDURE_LABELS[code],
}));

/**
 * Path B, end to end: a PDF becomes a clause tree becomes a waterfall.
 *
 * The order of operations here is the argument. A document is read in the
 * browser, clauses are proposed, a person confirms every one of them, and only
 * then does anything compile. A model can be pointed at the same document to
 * propose better candidates, but it is never between the reader and the
 * confirmation step, and the whole path works without one.
 */
export function CompileScreen() {
  const [stage, setStage] = useState<Stage>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPolicy | null>(null);
  const [policy, setPolicy] = useState<CompiledPolicy | null>(null);
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [modelNote, setModelNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [procedure, setProcedure] = useState<ProcedureCode>('kneeReplacement');
  const [billRupees, setBillRupees] = useState(400_000);
  const [months, setMonths] = useState(42);
  const [preExisting, setPreExisting] = useState(false);

  const readDocument = useCallback(async (file: File, label: string) => {
    setBusy(true);
    setError(null);
    setModelState('idle');
    setModelNote(null);
    try {
      const document_ = await extractPdfText(file);
      const clauses = extractDrafts(document_.text);
      setDraft({
        name: label,
        slug: 'uploaded-policy',
        summary: 'Compiled in this browser from a document you supplied.',
        shape: 'Compiled from an uploaded document. Every clause below was confirmed by hand.',
        documentText: document_.text,
        pageStarts: document_.pageStarts,
        clauses,
      });
      setPolicy(null);
      setStage('reviewing');
    } catch (caught) {
      setError(
        caught instanceof PdfExtractionError
          ? caught.message
          : 'That document could not be read in this browser.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      void readDocument(file, file.name.replace(/\.pdf$/i, '').slice(0, 60) || 'Uploaded policy');
    },
    [readDocument],
  );

  const useSpecimen = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch('/policies/specimen-floater-b.pdf');
      const blob = await response.blob();
      const file = new File([blob], 'specimen-floater-b.pdf', { type: 'application/pdf' });
      await readDocument(file, 'Specimen Floater B, re-read');
    } catch {
      setError('The specimen document could not be fetched.');
      setBusy(false);
    }
  }, [readDocument]);

  const askTheModel = useCallback(async () => {
    if (!draft) return;
    setModelState('running');
    setModelNote(null);
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentText: draft.documentText.slice(0, 120_000) }),
      });
      const payload = (await response.json()) as {
        available?: boolean;
        detail?: string;
        error?: string;
        clauses?: DraftClause[];
      };

      if (response.status === 503 || payload.available === false) {
        setModelState('unavailable');
        setModelNote(payload.detail ?? null);
        return;
      }
      if (!response.ok || !payload.clauses) {
        setModelState('error');
        setModelNote(payload.error ?? 'The model pass did not complete.');
        return;
      }

      const proposed: DraftClause[] = payload.clauses.map((clause, index) => ({
        ...clause,
        id: `model.${index}`,
        source: 'model',
        touched: false,
        confidence: clause.confidence === 'high' ? 'high' : 'low',
        ...(clause.kind === 'RoomRentCap'
          ? {
              associatedCategories: clause.associatedCategories ?? DEFAULT_ASSOCIATED,
              exemptCategories: clause.exemptCategories ?? DEFAULT_EXEMPT,
            }
          : {}),
      }));

      setDraft({ ...draft, clauses: proposed });
      setModelState('done');
      setModelNote(`${proposed.length} clauses proposed. Every one still needs confirming.`);
    } catch {
      setModelState('error');
      setModelNote('The model pass could not be reached. The reader in your browser still works.');
    }
  }, [draft]);

  const addByHand = useCallback(
    (kind: DraftClause['kind']) => {
      if (!draft) return;
      const clause: DraftClause = {
        id: `hand.${Date.now()}`,
        kind,
        ref: kind === 'Moratorium' ? '7.4' : '0.0',
        title: kind === 'Moratorium' ? 'Moratorium period' : 'Added by hand',
        quote: '',
        confidence: 'low',
        source: 'hand',
        touched: false,
        months: kind === 'Moratorium' ? 60 : 0,
        ...(kind === 'RoomRentCap'
          ? {
              limitBasis: 'perDayAmount' as const,
              associatedCategories: DEFAULT_ASSOCIATED,
              exemptCategories: DEFAULT_EXEMPT,
            }
          : {}),
      };
      setDraft({ ...draft, clauses: [...draft.clauses, clause] });
    },
    [draft],
  );

  const issues = useMemo(() => (draft ? blockingIssues(draft) : []), [draft]);
  const blocking = issues.filter((issue) => issue.severity === 'blocking');

  const compile = useCallback(() => {
    if (!draft) return;
    const result = compileDraft(draft);
    if (result.ok) {
      setPolicy(result.policy);
      setStage('compiled');
      setError(null);
    } else {
      setError(result.issues.map((issue) => issue.message).join(' '));
    }
  }, [draft]);

  const verdict = useMemo(() => {
    if (!policy) return null;
    const { claim } = buildClaim({
      procedure,
      billPaise: BigInt(billRupees) * 100n,
      monthsSinceInception: months,
      preExisting,
    });
    return { verdict: evaluate(policy, claim, claim.admissionDate), claim };
  }, [policy, procedure, billRupees, months, preExisting]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4">
      <header className="mb-4 flex flex-col gap-1">
        <p className="eyebrow">Compile &middot; bonus path</p>
        <h1 className="display text-[clamp(26px,5.6vw,44px)] leading-[1.02] ink-strong">
          Compile a policy
          <br />
          you actually hold.
        </h1>
        <p className="mt-1 text-[15px] leading-[1.6] ink-body measure">
          Open a policy PDF. It is read in this browser, clauses are proposed, and you confirm every
          one of them before anything compiles. Nothing is uploaded unless you ask for the model
          pass, and the four specimen policies never need it at all.
        </p>
      </header>

      {/* ---- Upload ---- */}
      {stage === 'upload' ? (
        <section className="hair px-2 py-3" aria-labelledby="upload-title">
          <h2 id="upload-title" className="text-[15px] font-medium ink-strong">
            Open a document
          </h2>
          <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
            A policy wording with a real text layer. A scan will not do: this reads text, not images.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <input
              ref={fileRef}
              id="policy-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
            <label
              htmlFor="policy-file"
              className="cta pressable cursor-pointer px-2 py-1 text-[14px]"
            >
              Choose a PDF
            </label>
            <button
              type="button"
              onClick={useSpecimen}
              className="hair pressable px-2 py-1 text-[14px] font-medium ink-body"
            >
              Or re-read Specimen Floater B
            </button>
          </div>

          <p className="mt-2 text-[12px] leading-[1.6] ink-muted measure">
            Re-reading a specimen is the honest test of this path: Path A wrote that wording and
            typeset it; Path B has to read it back out of the PDF with no knowledge of how it was
            made.
          </p>

          {busy ? (
            <div className="mt-2 flex flex-col gap-1" aria-busy="true">
              <SkeletonBar height={12} width="60%" />
              <SkeletonBar height={12} />
              <SkeletonBar height={12} width="80%" />
            </div>
          ) : null}

          {error ? (
            <p className="mt-2 text-[14px] leading-[1.6] ink-strong measure">
              {error}{' '}
              <Link href="/" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
                The four specimen policies are on the simulator.
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ---- Review ---- */}
      {stage !== 'upload' && draft ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:gap-4 lg:gap-6">
          <section aria-labelledby="review-title">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h2 id="review-title" className="text-[15px] font-medium ink-strong">
                {draft.clauses.length} clauses proposed
              </h2>
              <span className="eyebrow">
                {draft.documentText.length.toLocaleString('en-IN')} characters read
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-[1.65] ink-body measure">
              Each row has to be checked against the document. A row read at low confidence cannot
              compile until you have confirmed it, and a row whose quotation is not in the document
              cannot compile at all.
            </p>

            <ConfirmationTable
              draft={draft}
              onChange={(clauses) => {
                setDraft({ ...draft, clauses });
                setPolicy(null);
                setStage('reviewing');
              }}
            />

            <div className="mt-2 flex flex-wrap gap-1">
              {(['Moratorium', 'SumInsured', 'CoPay', 'Deductible', 'RoomRentCap'] as const).map(
                (kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addByHand(kind)}
                    className="hair pressable px-1 py-[5px] text-[12px] ink-body"
                  >
                    Add {kind} by hand
                  </button>
                ),
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-2 md:sticky md:top-[64px] md:self-start">
            <div className="panel px-2 py-2">
              <p className="eyebrow">Before it will compile</p>
              {blocking.length === 0 ? (
                <p className="mt-1 text-[14px] leading-[1.6] ink-strong">
                  Every row is confirmed and every quotation is in the document.
                </p>
              ) : (
                <ul className="m-0 mt-1 list-none p-0">
                  {blocking.slice(0, 6).map((issue, index) => (
                    <li key={index} className="py-[3px] text-[13px] leading-[1.5] ink-body">
                      {issue.message}
                    </li>
                  ))}
                  {blocking.length > 6 ? (
                    <li className="py-[3px] text-[12px] ink-muted">
                      and {blocking.length - 6} more.
                    </li>
                  ) : null}
                </ul>
              )}

              <button
                type="button"
                onClick={compile}
                disabled={blocking.length > 0}
                className={`pressable mt-2 w-full px-1 py-1 text-[14px] disabled:cursor-not-allowed ${
                  blocking.length > 0 ? 'hair' : 'cta'
                }`}
                style={
                  blocking.length > 0
                    ? { color: 'color-mix(in srgb, var(--ink) 65%, transparent)' }
                    : undefined
                }
              >
                {blocking.length > 0 ? `${blocking.length} to resolve` : 'Compile and run'}
              </button>
            </div>

            <div className="panel px-2 py-2">
              <p className="eyebrow">The model pass</p>
              <p className="mt-1 text-[13px] leading-[1.6] ink-body">
                Optional. It sends the extracted text to a model, which proposes clauses that still
                have to be confirmed here. Everything above was read without it.
              </p>
              <button
                type="button"
                onClick={askTheModel}
                disabled={modelState === 'running'}
                className="mt-1 hair w-full px-1 py-[6px] text-[13px] font-medium ink-body"
              >
                {modelState === 'running' ? 'Reading…' : 'Ask the model to read it'}
              </button>
              {modelState === 'unavailable' ? (
                <p className="mt-1 text-[12px] leading-[1.55] ink-muted">
                  {modelNote ??
                    'No model is configured for this deployment. Nothing was sent anywhere.'}
                </p>
              ) : null}
              {modelState === 'error' || modelState === 'done' ? (
                <p className="mt-1 text-[12px] leading-[1.55] ink-muted">{modelNote}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                setStage('upload');
                setDraft(null);
                setPolicy(null);
                setError(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="self-start text-[13px] underline underline-offset-4 ink-muted"
            >
              Start again with another document
            </button>
          </aside>
        </div>
      ) : null}

      {/* ---- Run ---- */}
      {stage === 'compiled' && policy && verdict ? (
        <section className="mt-6 hair-t pt-3" aria-labelledby="run-title">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <h2 id="run-title" className="text-[15px] font-medium ink-strong">
              {policy.name}, compiled and running
            </h2>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([policyToJson(policy)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${policy.slug}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
              className="hair pressable px-1 py-[6px] text-[13px] font-medium ink-body"
            >
              Download the compiled JSON
            </button>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-[298px_minmax(0,1fr)] md:gap-4 lg:gap-6">
            <div className="flex flex-col gap-2">
              <Select
                label="Procedure"
                value={procedure}
                options={PROCEDURE_OPTIONS}
                onChange={setProcedure}
              />
              <Slider
                label="Hospital bill"
                value={billRupees}
                display={formatPaise(BigInt(billRupees) * 100n)}
                min={BILL_MIN}
                max={BILL_MAX}
                step={BILL_STEP}
                onChange={(value) => setBillRupees(clampBill(value))}
              />
              <Slider
                label="Months since inception"
                value={months}
                display={`${months} mo`}
                min={MONTHS_MIN}
                max={MONTHS_MAX}
                step={1}
                onChange={(value) => setMonths(clampMonths(value))}
              />
              <Switch
                label="Arises from a pre-existing condition"
                checked={preExisting}
                onChange={setPreExisting}
              />
              <p className="text-[12px] leading-[1.6] ink-muted measure">
                {DISCLAIMER_SPECIMEN}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Waterfall
                verdict={verdict.verdict}
                policy={policy}
                maxBillPaise={BigInt(BILL_MAX) * 100n}
              />
              <ContestabilityPanel contestability={verdict.verdict.contestability} />
              <p className="text-[12px] leading-[1.6] ink-muted measure">{DISCLAIMER_ESTIMATE}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
