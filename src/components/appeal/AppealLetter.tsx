'use client';

import { useCallback, useMemo, useState } from 'react';
import { Segmented } from '@/components/controls/Segmented';
import {
  APPEAL_SECTIONS,
  SECTION_LABELS,
  type Appeal,
  type AppealSection,
  type AppealSentence,
  appealToText,
} from '@/letter/appeal';
import { RULE_DESCRIPTIONS, isKnownRuleId } from '@/vm/rules';

type Language = 'en' | 'hi';

/**
 * The generated appeal.
 *
 * Every sentence is an object with a source, so the letter is rendered
 * sentence by sentence rather than as a blob of text. Hovering or focusing one
 * puts what backs it in the rail underneath, which keeps the letter itself
 * clean and means nothing on the page moves when you read it.
 *
 * The printed version drops the rail, the controls and the page chrome, and
 * comes out as an A4 sheet you could put in an envelope.
 */
export function AppealLetter({ appeal }: { appeal: Appeal }) {
  const [language, setLanguage] = useState<Language>('en');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<AppealSection, AppealSentence[]>();
    for (const sentence of appeal.sentences) {
      const list = map.get(sentence.section) ?? [];
      list.push(sentence);
      map.set(sentence.section, list);
    }
    return APPEAL_SECTIONS.map((section) => ({ section, sentences: map.get(section) ?? [] })).filter(
      (group) => group.sentences.length > 0,
    );
  }, [appeal]);

  const active = useMemo(
    () => appeal.sentences.find((sentence) => sentence.id === activeId) ?? null,
    [activeId, appeal.sentences],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(appealToText(appeal, language));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }, [appeal, language]);

  return (
    <section aria-labelledby="appeal-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2" data-print="hide">
        <div>
          <h2 id="appeal-title" className="text-[15px] font-medium ink-strong">
            The appeal
          </h2>
          <p className="text-[12px] ink-muted">
            {appeal.sentences.length} sentences, each with a clause or a rule behind it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="w-[160px]">
            <Segmented<Language>
              legend="Language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'हिन्दी', description: 'Hindi' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={copy}
            className="hair px-1 py-[6px] text-[13px] font-medium ink-body"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hair px-1 py-[6px] text-[13px] font-medium ink-body"
          >
            Print
          </button>
        </div>
      </div>

      {/* The sheet. */}
      <article
        className={`panel px-2 py-3 sm:px-3 ${language === 'hi' ? 'deva' : ''}`}
        lang={language}
        data-print="sheet"
      >
        <p className="eyebrow mb-2" data-print="hide">
          Draft &middot; check the dates and the claim number before sending
        </p>

        {grouped.map((group) => (
          <section key={group.section} className="mb-2 last:mb-0">
            <h3 className="sr-only">{SECTION_LABELS[group.section]}</h3>
            <p className="text-[15px] leading-[1.75] ink-body" style={{ maxWidth: '66ch' }}>
              {group.sentences.map((sentence, index) => (
                <span key={sentence.id}>
                  {index > 0 ? ' ' : null}
                  <span
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeId === sentence.id}
                    aria-label={`${language === 'en' ? sentence.en : sentence.hi} Show what this sentence is based on.`}
                    onMouseEnter={() => setActiveId(sentence.id)}
                    onFocus={() => setActiveId(sentence.id)}
                    onClick={() => setActiveId(sentence.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setActiveId(sentence.id);
                      }
                    }}
                    className="cursor-help"
                    style={{
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: '4px',
                      textDecorationColor:
                        activeId === sentence.id
                          ? 'var(--accent)'
                          : 'color-mix(in srgb, var(--line) 80%, transparent)',
                      color:
                        activeId === sentence.id
                          ? 'color-mix(in srgb, var(--sand) 100%, transparent)'
                          : 'inherit',
                    }}
                  >
                    {language === 'en' ? sentence.en : sentence.hi}
                  </span>
                  {sentence.clauseRef ? (
                    <sup
                      className="ml-[2px] text-[10px] ink-muted"
                      aria-hidden="true"
                    >
                      {sentence.clauseRef}
                    </sup>
                  ) : null}
                </span>
              ))}
            </p>
          </section>
        ))}
      </article>

      {/* What backs the sentence under the cursor. */}
      <div
        className="hair px-2 py-1"
        aria-live="polite"
        data-print="hide"
        style={{ minHeight: '92px' }}
      >
        <p className="eyebrow mb-1">Behind this sentence</p>
        {active ? (
          <div className="flex flex-col gap-1">
            {active.sourceQuote ? (
              <p className="text-[13px] leading-[1.6] ink-body italic measure">
                &ldquo;{active.sourceQuote}&rdquo;
                {active.clauseRef ? (
                  <span className="not-italic ink-muted"> &mdash; clause {active.clauseRef}</span>
                ) : null}
              </p>
            ) : null}
            {active.ruleId ? (
              <p className="text-[12px] leading-[1.6] ink-muted measure">
                <code>{active.ruleId}</code>
                {isKnownRuleId(active.ruleId) ? ` · ${RULE_DESCRIPTIONS[active.ruleId]}` : null}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] leading-[1.6] ink-muted measure">
            Point at any sentence, or tab through them, to see the clause or the rule it came from.
            Not one sentence in this letter is without a source.
          </p>
        )}
      </div>
    </section>
  );
}
