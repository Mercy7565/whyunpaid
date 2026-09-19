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
