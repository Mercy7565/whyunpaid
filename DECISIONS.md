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

## Phase 5 — the appeal

- **Ground detection is weighted keyword rules first, and a model only as a fallback the caller supplies** — a repudiation letter is a medical document; running one through a network call by default would be the wrong trade for a product whose whole pitch is that it needs no server. The rules run in the browser and place all six sample grounds correctly.
- **"waiting period" outweighs "pre-existing"** — both kinds of letter mention a pre-existing condition, and only one of them is about disclosure. Weighting rather than counting is what keeps the moratorium argument out of a letter where it does not belong, and both directions are tested.
- **The detected ground is overridable, and the matched phrases are shown marked up in the reader's own text** — a classifier that will not say what it keyed on is asking to be trusted rather than checked, and the person holding the letter knows more than the rules do.
- **Contradictions are willing to say the insurer is right** — where the wording supports the stated ground, the tool says so and names the factual question worth putting instead. A tool that only ever produces ammunition is not a tool anyone should rely on.
- **The appeal input carries what the insurer actually settled** — the strongest and most general contradiction is arithmetic: the wording reaches one figure, the settlement was another, and no clause accounts for the difference.
- **Hindi is written by hand, sentence by sentence, alongside the English** — a generated legal-register sentence put through a machine translator is not something anyone should sign and send to their insurer. Every contradiction and every appeal sentence carries both.
- **Deduction sentences take a structured Hindi form rather than a translated one** — the English `humanReason` is generated prose; the Hindi states the same fact as clause, stage and amount, which is faithful without pretending to translate.
- **The source lint runs over more than six hundred generated appeals** — every policy, every ground including none, four lengths of cover, settled and unsettled. It checks for a source on every sentence, a known rule id, both languages present, no template placeholder, no forbidden phrase, and no clause or quotation that is absent from the policy the letter was generated against.

## Phase 6 — the inspector

- **The specimen PDF is rendered as the document it is, on unpainted paper** — the palette rule already carves out paper as not being one of the five colours, and a policy document tinted to match a dark interface would be a strange thing for a tool whose entire argument is about reading documents faithfully. The sheet sits on a `--ground` margin so it reads as a page on a desk rather than as a white panel.
- **Highlighting uses the word boxes the compiler recorded, not pdf.js text-layer matching** — the same script lays the page out and records the boxes, so a character range maps to rectangles exactly. Text-layer matching would have to re-find the quote at render time and could drift.
- **The viewer degrades to the canonical plain text with the same range marked** — pdf.js is a large dependency running in someone else's browser. If it will not start, the reader still gets the wording and the highlight, which is the part that matters.
- **The evaluation order exists in three places and is asserted across all three** — `evaluate.ts` runs it, `ORDER.md` documents it, `orderTable.ts` renders it, and `order.test.ts` parses the markdown and compares all three. An order enforced in none of the places it is written down is not an order.
- **`/vm` imports the test summary at build time rather than fetching it** — the page claims the engineering is real, so the numbers must be true of the deployment and not only of a laptop. A custom Vitest reporter writes the file on every run and it is checked in.
- **The engine is called PolicyVM on `/vm` and in the README, and nowhere else** — a person checking why their claim was cut does not need to learn the name of the evaluator.
- **`build:check` writes to a separate directory** — running `next build` against `.next` while the dev server is watching it corrupts the dev server's chunk manifest. The default `build` still writes `.next`, which is what Vercel wants.

## Phases 7 and 8 — design, print and shared state

- **The two-column layout moves to the 768px breakpoint rather than 1024px** — at 768 a single column left the controls stretched across the full width with the waterfall pushed below the fold. A 298px control column and a sticky rail use the tablet width properly.
- **In print, `main .grid` is forced to `display: block`** — a hidden grid item still reserves its track, so the two-column screen layout was printing the appeal offset by the width of a column that was not there. This was a real bug, found only by reasoning about what `display: none` does to a grid child.
- **On paper a sentence is a sentence** — the dotted underline that makes each sentence hoverable, and the superscript clause markers, are screen furniture. Print strips both; the clause is already named in the prose.
- **The URL carries only what differs from the default scenario** — a link to the opening scenario is just `/`, and a link to a specific one is short enough to paste into a message.
- **`Cmd+K` is a hand-built dialog, not a library** — twelve scenarios, filter, arrow keys, Home and End, Enter to run, Escape to close, focus returned to whatever opened it, and Tab trapped because there is nothing else inside to reach.

## Phase 9 — Path B

- **Path B does not need an API key at all** — the brief allows it to, and it does not. A regular-expression clause reader runs in the browser and reads all four specimen wordings back correctly, so the interesting feature does not quietly become a network call the first time someone tries it. A model is an upgrade that proposes better candidates, never a dependency.
- **The PDF is read in the browser with pdf.js, which was already a dependency** — there is no upload endpoint, so there is nothing to secure, rate-limit or apologise for. The document leaves the machine only if the reader explicitly asks for the model pass.
- **Almost every heuristic draft is marked low confidence on purpose** — a regular expression reading an insurance contract should not be trusted. The confirmation table exists so that a person has to look, and `compileDraft` refuses a low-confidence row nobody has touched.
- **A clause whose quotation cannot be found in the document does not compile** — not "compiles with a warning". The product is the claim that every rupee traces to wording; that claim cannot survive a citation to wording that is not there.
- **Quotations are located whitespace-insensitively as a fallback** — a PDF text layer breaks lines wherever the typesetter did, and a person retyping a quotation will not. The interface says which of the two matched.
- **There is no "confirm all" button** — eleven clicks for eleven clauses is tedious, and that is the point. Bulk confirmation would turn the audit step into a formality.
- **The demo is re-reading one of our own specimen PDFs** — Path A wrote that wording and typeset it; Path B has to read it back out of the PDF knowing nothing about how it was made. It reproduces the same answer to the rupee: four lakh becomes two lakh fifty thousand on Specimen B by both routes.
- **`/compile` is not in the primary navigation** — the brief specifies three screens. It is linked from the simulator and the inspector so it is discoverable without competing with them.
- **`next build` honours `NEXT_DIST_DIR`** — building into `.next` while `next dev` is watching it corrupts the dev server's chunk manifest, which cost real time to diagnose once.

## Phase 10 — documentation

- **The GIF placeholder is a visible block, not a broken `<img>` tag** — a README that renders a broken image icon on GitHub looks worse than one that says plainly what the recording should contain and where to drop it.
- **The README states the limitations at length** — this is a tool about reading contracts carefully, and it would be poor form to be careful about the policy wording and careless about what the tool itself cannot do. The synthetic specimens, the day-level rounding on the initial wait, the fixed bill profile, medical necessity being outside the model, and the fact that Path B reads text rather than images are all named.
