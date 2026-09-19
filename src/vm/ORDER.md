# Evaluation order

The order below is the contract between the compiler, the evaluator and the
interface. It is implemented in `evaluate.ts`, asserted in
`__tests__/order.test.ts`, and rendered on `/vm`. Changing one without the other
two is a bug.

A claim enters as a list of bill lines and leaves as a single payable figure.
Every rupee that disappears between those two points is attributed to exactly
one clause, and the attributions sum, exactly, to the gap:

```
paid + sum(deductions) === claimed      // bigint equality, no tolerance
```

## The eight stages

| # | Stage | Clause kind | Operates on | Effect |
|---|---|---|---|---|
| 1 | `exclusion` | `PermanentExclusion` | the whole claim | procedure on the list to paid 0, one deduction for the entire claim, nothing downstream is reached |
| 2 | `waitingPeriod` | `WaitingPeriod` | the whole claim | any applicable wait unexpired at the test date to paid 0, one deduction, nothing downstream is reached |
| 3 | `lineItemIneligible` | `LineItemIneligibility` | each line | lines in a non-payable head are removed |
| 4 | `roomRentProportionate` | `RoomRentCap` | associated lines only | associated heads reduced by `eligible / actual`; exempt heads untouched |
| 5 | `subLimit` | `SubLimit` | the running total | per-procedure ceiling |
| 6 | `deductible` | `Deductible` | the running total | flat amount borne by the policyholder |
| 7 | `coPay` | `CoPay` | the running total | percentage share, applied last on the admissible amount |
| 8 | `sumInsured` | `SumInsured` | the running total | annual ceiling |

Stages 1 and 2 short-circuit. Stages 3 and 4 operate per line. Stages 5 to 8
operate on a single running total, because a ceiling or a share applies to the
whole and allocating it back across lines would introduce a rounding step that
buys nothing.

## Why stage 4 is where it is

The room rent proportion must run **after** ineligible items are stripped and
**before** any ceiling, share or deductible. Running it after a sub-limit would
apply the proportion to an already-capped figure and understate the reduction;
running it before line-item ineligibility would proportion money that was never
payable in the first place.

### What stage 4 may touch

Proportionate reduction applies to the room and to the charges that move with
the grade of room. It does **not** apply to items whose price does not change
with the room:

- **Reduced in proportion:** room, nursing, surgeon, anaesthetist, operation theatre.
- **Never reduced:** pharmacy, consumables, implants, diagnostics.

Both lists are **data on the clause**, not conditions in the evaluator, so a
policy with a different exemption list compiles to a different verdict without a
code change. Where a head appears on both lists, the exemption wins: the
exemption is the promise made to the policyholder and the association list is
only the mechanism.

## The test date

Waiting periods are tested at the **earlier of `asOf` and the admission date**.

Admission is the legally relevant moment: a hospitalisation that fell inside a
waiting period is not cured by assessing the file later. `asOf` remains a real
parameter so a caller can ask what the policy said at an earlier point in time,
and taking the earlier of the two keeps `paid` monotone in months of cover,
which is one of the tested invariants.

## Rounding

One rule, one function, `mulDivRound` in `money.ts`: **round half up, on
non-negative paise**. Nothing else in the codebase divides money. Stage 4 takes
the reduction line by line using the exact `eligible / actual` ratio rather than
the displayed percentage, so the figure shown on the clause card and the figure
taken from the bill can never drift apart through double rounding.

## What is NOT in this pipeline: the 60-month moratorium

The moratorium is the single most commonly mismodelled clause in Indian health
cover, so it is worth being blunt about it.

**The moratorium is not a waiting period. It does not unlock cover.**

After 60 months of continuous cover, the insurer may no longer contest a claim
on grounds of **non-disclosure or misrepresentation**, except where fraud is
established. That is all it does. It does not override:

- a permanent exclusion,
- a sub-limit,
- a co-pay or deductible,
- an unexpired waiting period.

Modelling it as a stage would mean a claim becoming payable at month 60 that was
not payable at month 59 for reasons that have nothing to do with disclosure,
which is simply wrong. It is therefore reported on the verdict as
`contestability`, a separate result computed from `asOf`, and it never produces a
`Deduction`.

Two tests hold this boundary:

- `moratorium.test.ts` asserts that crossing month 60 **changes contestability**.
- The same file asserts that crossing month 60 **changes nothing in the
  waterfall**: same paid figure, same deductions, byte for byte.

## Order independence

The evaluator selects clauses by kind and sorts them by clause id, and it sorts
bill lines by line id before doing anything. Shuffling `policy.clauses` or
`claim.lines` therefore produces a byte-identical verdict. A property test
asserts it, because an evaluator whose answer depends on JSON key order is an
evaluator nobody can audit.
