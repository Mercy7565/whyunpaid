# Decisions

Every non-obvious call made while building WhyUnpaid?, with the reason. Appended in order.

## Phase 1 — scaffold

- **Next.js scaffolded by hand rather than `create-next-app`** — the generator is interactive and pulls in ESLint config, a default favicon and template markup I would immediately delete; hand-writing four config files is faster and leaves nothing to strip out.
- **TypeScript pinned to 5.9 rather than the 7.x that `npm i typescript` now resolves to** — Next 15.5 type-checks with the installed compiler and 7.x is the freshly ported native compiler; a build-time type-checker surprise is not a risk worth taking in a one-sitting build.
- **Money is `bigint` paise and JSON stores it as a decimal string** — JSON has no bigint literal, so the Zod boundary schema is the single place a string becomes a `bigint`. This makes it impossible for a float to enter the evaluator by accident.
- **The palette ships as `:root` custom properties and Tailwind consumes them with `@theme inline`** — `@theme` alone would have Tailwind redeclare its own `--color-*` values, which would mean two sources of truth for a colour. `inline` makes the generated utilities emit `var(--ground)` directly, so the `:root` block stays the only place a hex appears.
- **Tailwind's `--spacing` is set to 8px** — the brief asks for an 8px scale honoured everywhere; rather than police it in review, the engine now makes `p-1` mean 8px and `p-3` mean 24px, so every spacing utility in the codebase is a multiple of 8 by construction.
- **One typeface family in two cuts: Archivo at normal width for UI, Archivo at 112% width for figures and the wordmark** — the brief allows two typefaces and asks for "a display cut for the numerals". A width axis of the same grotesk gives genuine display contrast while guaranteeing the figures and the labels beside them share metrics and tabular-figure behaviour.
- **Noto Sans Devanagari is loaded as a third font file** — it is a script fallback for the Hindi appeal body, not a third design voice. Without it the Hindi text falls to whatever the OS supplies and the letter looks unfinished on half the devices that will open it.
- **Translucency is expressed with `color-mix(..., transparent)` over palette colours, never with new hex values** — alpha compositing a palette colour over `--ground` keeps the five-colour rule literally true; introducing a mixed hex would not.
- **Small labels use `--paid-full` at reduced opacity, not `--line`** — `--line` measures roughly 3.2:1 on `--ground`, which fails AA below 18px. The `.label-line` utility hard-codes 18px so the rule cannot be broken by using the class.

## Phase 2 — the evaluator

- **Waiting periods are tested at the earlier of `asOf` and the admission date** — the brief says "unexpired at `asOf`", and admission is the legally relevant moment; taking the earlier of the two satisfies both and, as a bonus, is what makes `paid` provably monotone in months of cover.
- **A zero-rupee deduction is never emitted, but a `block` is** — a band worth nothing is noise in the waterfall, yet a claim refused outright still has to say why. The verdict therefore carries a separate `block` field, so a nil claim explains itself even when there was no money to take.
- **Stages 5 to 8 operate on a single running total rather than on per-line state** — a ceiling, a flat deductible and a percentage share apply to the whole, so allocating them back across lines would add a rounding step that buys nothing and can only introduce drift.
- **Where a head appears in both the associated and the exempt list, the exemption wins** — the exemption is the promise made to the policyholder; the association list is only the mechanism for delivering the proportion. Tested as golden scenario 18.
- **`assertBalances` runs on every verdict in production, not only in tests** — a screen showing figures that do not add up is strictly worse than a screen showing an error, and this is the one identity the whole product rests on.
- **`ORDER.md` is parsed by a test** — documentation that can drift silently from the implementation is worse than none, so the order table is read back and compared to `STAGES`.
- **The test reporter writes `src/generated/vm-summary.json`, which `/vm` imports at build time** — the inspector claims the engineering is real, so its numbers come from an actual run rather than a hand-kept constant, and it needs no fetch to show them.

## Phase 3 — the specimen policies

- **Wording and clause quotes are generated from the same template strings** — a quote hand-copied out of a document is a quote that can rot. Generating both from one source makes the quote a substring of the wording by construction, and the compiler still verifies it, refuses duplicates, and refuses anything over 25 words.
- **The specimen PDFs are typeset by the same script that records the provenance** — because the script both lays out the page and records a box for every word, a character range maps to highlight rectangles exactly, with no text-layer guessing at render time.
- **The wordings say "Rs." rather than the rupee sign** — the specimens are typeset in the standard PDF fonts, which have no glyph for U+20B9. Printed policy schedules say "Rs." anyway, so the constraint and the register agree.
- **The specimen PDFs print `--ground` ink on unpainted paper** — the same exception the A4 appeal stylesheet takes. Paper is not one of the five colours.
- **A 30-day initial waiting period is modelled as one month** — the evaluator counts whole months, and modelling days as well would add a second unit to every comparison for one clause. The wording still says "thirty days"; the difference can move the boundary by a day and is not material to what this tool demonstrates.
- **Specimen D ships with no room rent cap and no sub-limit at all** — three policies that differ only in their numbers would not prove that a missing clause kind is handled. D exercises the "no clause of this kind" path through stages 4 and 5.
- **The bill split per procedure is a fixed profile, not a random draw** — a reader has to be able to check the arithmetic on a clause card against the bill line by line, and a shared link has to show the recipient exactly what the sender saw.
- **The URL is written with `history.replaceState` rather than the router** — a slider drag would otherwise push a navigation per frame. The address bar stays shareable and nothing re-renders that did not have to.
- **On a phone, the payable figure is pinned to the bottom of the screen** — the controls sit above the waterfall on a narrow screen, so without the bar someone dragging a slider would be watching a number that is off the screen.
