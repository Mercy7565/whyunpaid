# WhyUnpaid?

**Every rupee your policy didn't pay, traced to the clause that took it.**

WhyUnpaid? compiles an Indian health insurance policy into an executable clause
tree, runs a hospitalisation through it, and emits a rupee-by-rupee waterfall
where every single deduction names the clause that caused it.

Second mode: paste the reason from a real claim-rejection letter and it runs the
actual claim against that policy's compiled tree. Where the verdict disagrees
with the letter, that contradiction is the appeal.

The engine is called **PolicyVM**.

```
₹4,00,000 hospital bill, Specimen Floater A, 42 months of cover

  3.9    Ineligible items            −₹5,000
  4.2    Room rent proportion        −₹97,333.33
  4.6(b) Sub-limit                   −₹32,666.67
  4.9    Co-pay                      −₹53,000
  ──────────────────────────────────────────────
         Payable                      ₹2,12,000
```

Tap any band and you get the clause reference, the twenty-five words of wording
that took the money, and the arithmetic for that specific deduction.

---

## Demo

> **[ GIF PLACEHOLDER — `docs/demo.gif` ]**
>
> Twelve seconds, recorded at 380px wide, in this order:
>
> 1. Land on `/`. Drag the bill slider and watch ₹4,00,000 become ₹2,12,000.
> 2. Tap the room rent band. Read the quoted wording and the sentence that
>    exempts pharmacy, consumables, implants and diagnostics.
> 3. Drag months below 24. The claim goes to ₹0 on the waiting period.
> 4. Cut to `/appeal`, tap the non-disclosure sample, and show the moratorium
>    contradiction and the generated letter.
>
> Drop the file in at `docs/demo.gif` and replace this block with
> `![WhyUnpaid? demo](docs/demo.gif)`.

**Live: <https://whyunpaid.vercel.app>**

No account, no upload, no environment variables. Open it on a phone, drag one
slider, and the waterfall above is what you get.

---

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. That is the whole setup. No database, no
auth, no API key, no seed step.

```bash
npm test          # 159 tests; also writes src/generated/vm-summary.json
npm run typecheck # tsc --noEmit, strict + noUncheckedIndexedAccess
npm run build     # production build
npm run policies:pdf   # recompile the four specimen policies and their PDFs
```

`ANTHROPIC_API_KEY` is optional and affects exactly one thing: the model pass on
`/compile`. Everything else — both demo paths, all four specimen policies, the
whole appeal pipeline — runs with no key, no server and no network call.

---

## The three screens

| Route | What it does |
|---|---|
| `/` | **Simulate.** Pick a specimen policy, set a procedure, a bill and a length of cover, and watch the waterfall. Deep-linkable; `Cmd+K` swaps between twelve scenarios. |
| `/appeal` | **Letter mode.** Paste a rejection reason. It classifies the stated ground, runs the same claim through the wording, lists the contradictions, and generates an appeal in English or Hindi. |
| `/vm` | **Inspector.** The compiled clause tree as data, the fixed evaluation order with the clauses the selected policy carries at each stage, the test run, and the specimen PDF with the selected clause highlighted word for word. |

Plus `/compile`, a bonus path: open a policy PDF, watch it read into draft
clauses in your browser, confirm each one, and run it.

---

## Architecture

Three layers that do not leak into each other.

### `src/vm/` — the evaluator. Pure, zero I/O.

No `fetch`, no `Date.now()`, no `Math.random()`, no file reads. `asOf` is always
a parameter.

```ts
evaluate(policy: CompiledPolicy, claim: Claim, asOf: ISODate): Verdict
```

Money is `bigint` paise everywhere — never a float, never a `number`. There is
exactly one rounding helper, `mulDivRound` in `money.ts`: **round half up, on
non-negative paise**. Nothing else in the codebase divides money.

### `src/compiler/` — wording to `CompiledPolicy`.

Every clause carries provenance: a source quote of at most 25 words, a page, a
character range and a confidence. A clause without provenance is a bug, and a
test asserts it for every clause of every shipped policy.

### `src/letter/` — rejection reason to ground to contradiction to appeal.

Keyword rules first, model second. The appeal is generated as sentence objects,
each carrying a rule id or a quotation. A test fails the build if any generated
sentence has neither.

---

## The evaluation order

Fixed, documented in [`src/vm/ORDER.md`](src/vm/ORDER.md), rendered on `/vm`,
and asserted against the code by `order.test.ts` — which parses the markdown
table and compares it to the implementation, so the three cannot drift.

| # | Stage | Clause kind | Operates on | Effect |
|---|---|---|---|---|
| 1 | `exclusion` | `PermanentExclusion` | the whole claim | procedure on the list → paid 0, one deduction, nothing downstream is reached |
| 2 | `waitingPeriod` | `WaitingPeriod` | the whole claim | any applicable wait unexpired at the test date → paid 0, short-circuits |
| 3 | `lineItemIneligible` | `LineItemIneligibility` | each line | non-payable heads removed |
| 4 | `roomRentProportionate` | `RoomRentCap` | associated lines only | associated heads reduced by `eligible / actual` |
| 5 | `subLimit` | `SubLimit` | the running total | per-procedure ceiling |
| 6 | `deductible` | `Deductible` | the running total | flat amount borne by the policyholder |
| 7 | `coPay` | `CoPay` | the running total | percentage share, applied last |
| 8 | `sumInsured` | `SumInsured` | the running total | annual ceiling |

**Stage 4 is the one that is usually wrong.** The proportionate deduction
applies to room, nursing, surgeon, anaesthetist and operation theatre. It does
**not** apply to pharmacy, consumables, implants or diagnostics, whose cost does
not change with the grade of room. Both lists are **data on the clause**, not
conditions in the evaluator, so a policy with a different exemption list
compiles to a different verdict without a code change.

---

## The moratorium, in four lines

1. The 60-month moratorium is **not a waiting period** and it does **not unlock
   cover**.
2. All it does is stop the insurer contesting a claim for **non-disclosure or
   misrepresentation** after 60 months of continuous cover, except where fraud
   is established.
3. It does **not** override a permanent exclusion, a sub-limit, a co-pay, a
   deductible, or an unexpired waiting period.
4. So it is modelled as a separate `contestability` result on the `Verdict`,
   never as a stage in the deduction pipeline — because a claim becoming payable
   at month 60 that was not payable at month 59, for reasons having nothing to do
   with disclosure, would simply be wrong.

Two tests hold that boundary, in `src/vm/__tests__/moratorium.test.ts`:

- crossing month 60 **changes contestability**;
- crossing month 60 **changes nothing in the waterfall** — same paid figure,
  same deductions, same trace, asserted by deep equality.

---

## Invariants

Checked with fast-check over generated policies and claims, at exact bigint
equality with no tolerance anywhere:

| | Invariant |
|---|---|
| I1 | `paid <= claimed` |
| I2 | `paid + sum(deductions) === claimed` |
| I3 | `paid <= sumInsured` |
| I4 | increasing `monthsSinceInception` never decreases `paid` |
| I5 | evaluation is idempotent |
| I6 | shuffling `policy.clauses` and `claim.lines` changes nothing |
| I7 | rebuilding both inputs with reversed key order changes nothing |
| I8 | every deduction names a clause that exists, is greater than zero, and quotes wording |

`assertBalances` also runs on **every verdict in production**, not only in
tests. A screen showing figures that do not add up is strictly worse than a
screen showing an error.

Alongside them:

- **18 golden scenarios**, snapshotted in full, one per clause kind and per
  deduction stage, plus the combinations where the order decides the answer.
- **The provenance test** — every clause of every shipped policy quotes its
  source, within 25 words, and the character range really does contain that
  quotation in the wording the PDF was typeset from.
- **The source lint** — over 600 generated appeals, across every policy, every
  ground including none, four lengths of cover, settled and unsettled. Every
  sentence must carry a known rule id or a quotation, in both languages, with no
  template placeholder and no clause or quotation absent from the policy it was
  generated against.

`npm test` writes `src/generated/vm-summary.json`, which `/vm` imports at build
time. The numbers on the inspector come from a real run.

---

## Design

Five brand colours, shipped verbatim, in **two modes with a switcher**. Both
modes put a **saturated brand colour on the page** rather than a near-neutral:
dark sits on the indigo, light sits on the steel blue.

```css
--paprika: #E4572E;   /* refusal: a nil claim                         */
--indigo:  #29335C;   /* the dark-mode page; the light-mode bars      */
--amber:   #F3A712;   /* the block the payable figure sits on         */
--olive:   #A8C686;   /* partially-paid figures, secondary numerals   */
--steel:   #669BBC;   /* the light-mode page                          */
```

Contrast comes from three things working together, not from the text colour
alone:

1. **every boundary is a 2px rule at full strength**, never a tinted hairline;
2. **anything that matters is a solid block** of brand colour, not a tint;
3. **blocks carry a hard offset shadow** in the rule colour, with no blur.

That third one is what finally makes amber usable. Amber cannot be read as text
on either ground — 6.0:1 on indigo, 1.5:1 on steel — so the payable figure
**never is amber**. It sits *on* a solid amber block in near-black ink at
**9.4:1**, identically in both modes. A nil claim does the same on paprika at
**5.2:1**, and says "not admissible" in words as well.

| Token | Dark on `#29335C` | Light on `#669BBC` | Used for |
|---|---|---|---|
| `--ink` | `#F4F7EC` **11.2:1** | `#0B0F1F` **6.3:1** | body copy |
| `--line` | `#C7D0EE` **8.0:1** | `#0B0F1F` **6.3:1** | 2px rules, borders, shadows |
| `--paid-part` | `#A8C686` **6.4:1** | `#1B2C0B` **4.9:1** | secondary numerals |
| `--accent` | `#8FC0DC` **6.2:1** | `#16224A` **5.1:1** | interaction |
| `--band` | `#5A69AE` **2.4:1** | `#29335C` **4.1:1** | deduction bars, fills only |
| `--surface` | `#1A2140` **1.3:1** | `#F7FAF2` **2.9:1** | cards; the 2px rule separates them |
| `--on-block` | `#0B0F1F` | `#0B0F1F` | text on an amber, paprika or olive block |
| `--on-accent` | `#0B0F1F` **9.7:1** | `#F7FAF2` **14.6:1** | text on an `--accent` fill |

There are **two** inks for filled things, and keeping them apart matters:

- `--on-block` is text on a solid brand block — amber, paprika, olive. Those are
  light colours in both modes, so it is near-black in both: 9.4:1, 5.2:1, 10.1:1.
- `--on-accent` is text on an `--accent` fill, and `--accent` **inverts** — a
  light steel in dark mode, a dark navy in light mode — so its ink inverts with
  it.

Collapsing those two into one token is what made every selected control render
near-black text on a near-black fill in light mode.

A third pair, `--figure-good` and `--figure-alert`, exists for the three
numerals that are read against the ground rather than against a block: the test
count, the months since inception, and the payable figure in the mobile bar.
They are the brand amber and paprika in dark mode, where both are legible on
indigo, and deep versions of the same hues in light mode, where neither is.
They are the only brand colours used as text anywhere.

### Brand

Paprika and amber are mid-light colours: on the light steel ground they measure
1.2:1 and 1.5:1, so they can never *be* text there. They carry the brand as
**fields** instead, which works identically in both modes:

- a three-segment brand rule across the top of every page, where each segment
  is judged against its neighbour rather than against the page;
- the question mark in the wordmark, as a paprika block;
- a paprika tick before every section label;
- the numbered steps and the primary action, as amber blocks;
- contradiction rank markers — paprika for a direct point, olive for a
  supporting one.

The switcher has **two states, light and dark**. The system preference still
decides what a first-time visitor sees, because the stylesheet handles that in
a media query, but the button only flips between the two and always writes an
explicit choice that survives a reload. An inline script applies a stored
choice before first paint, so choosing light never means seeing a dark page
flash first.

Deductions recede into the band fill, with a minus sign and a clause reference
on every one, so nothing depends on telling two colours apart. Controls press
into their own shadow when activated. Severity is otherwise expressed through
weight, scale and desaturation, never through hue.

One typeface family in two cuts: Archivo at normal width for the interface,
Archivo at 112% width for figures, with `tabular-nums` on every number so
digits do not jitter during animation. Tailwind's `--spacing` is set to `8px`,
so every spacing utility in the codebase is a multiple of eight by
construction.

Framer Motion animates the waterfall and the number transitions, and nothing
else. `prefers-reduced-motion` makes every animation instant; it never disables
functionality.

Print never follows the theme, and drops every shadow: in light mode
`--ground` is a saturated steel, and printing it as ink would be unreadable, so
both modes print dark indigo on unpainted paper at 1px.

Four files carry literal hex values, all of them places a CSS custom property
cannot reach: `global-error.tsx` (renders when the stylesheet may not have
loaded), `layout.tsx` and `manifest.ts` (browser chrome metadata), and
`opengraph-image.tsx` (rendered by Satori, which has no cascade).

## Limitations

Worth being explicit about, because this tool is about reading contracts
carefully and it would be poor form not to.

- **The specimen policies are synthetic.** They are modelled on structures
  common to Indian indemnity health cover. They are not the wording of any
  insurer, and no insurer is named anywhere in this product.
- **It is an estimate from the wording, not advice.** Not medical, not legal, not
  financial. Every verdict surface says so.
- **A 30-day initial waiting period is modelled as one month.** The evaluator
  counts whole months; this can move the boundary by a day.
- **The bill split is a fixed profile per procedure.** Real bills are not this
  tidy. The split is fixed so the arithmetic on each clause card can be checked
  line by line and a shared link shows the recipient exactly what the sender saw.
- **Medical necessity is outside the model.** It is a clinical question, not a
  clause. Where a letter relies on it, the tool can only say what the wording
  itself makes admissible.
- **Path B reads text, not images.** A scanned policy with no text layer cannot
  be compiled, and the interface says so rather than producing nonsense.
- **Path B's heuristics are regular expressions over prose.** They recover all
  four specimen wordings correctly, and they will miss things on a document
  written differently. That is why almost every draft comes back low confidence
  and why nothing compiles until a person has confirmed it.
- **Contradictions are possible grounds for review, not predictions.** The tool
  does not know the clinical facts, the claim file, or what was written on a
  proposal form seven years ago. It is willing to say the insurer is right.

---

## Repository

```
src/
  vm/          the evaluator. pure, bigint paise, zero I/O
    ORDER.md   the evaluation order, parsed by a test
  compiler/    wording → CompiledPolicy, the Zod boundary, Path B drafts
  letter/      reason → ground → contradiction → appeal
  policies/    four pre-compiled specimen policies
  claims/      slider positions → a hospital bill
  components/  every component hand-built; no component library
scripts/
  generate-pdfs.mjs   typesets the specimens and records a box for every word
tests/
  summary-reporter.ts writes the summary /vm renders
public/policies/      the specimen PDFs, their text and their word maps
```

## Stack

Next.js 15 (App Router), TypeScript in `strict` with `noUncheckedIndexedAccess`,
Tailwind CSS v4, Zod at every boundary, Vitest with fast-check, pdf.js, pdf-lib,
Framer Motion. No component library — every control in this product is
hand-built on a native element.
