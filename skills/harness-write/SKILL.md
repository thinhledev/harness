---
name: harness-write
description: Stage 3 of the Harness loop. Use when implementing slices from a settled technical design — builds against the recorded contracts, one builder per area in parallel, and records the as-built contract for every slice so review and verify compare against reality rather than intent.
---

# Stage 3 · Write

Implement against the settled contracts, and write down what was actually built.

## Before starting

- Read the Harness section of `AGENTS.md`. The guardrails apply to every command you run. If `AGENTS.md` has no Harness section, the project has not been set up: say so, and ask the human to run `harness init` before going further.
- Read `tech-design.md` for your slice. If there is no design and the size gate did not skip stage 2, stop and go back to stage 2: this stage does not start without settled contracts.
- Slices in different areas that do not depend on each other run in parallel, one builder per area, each against the same contracts.

## Build

- **Implement the contract as written.** When it turns out to be wrong or incomplete, make the smallest workable choice and record it as a deviation. If the deviation changes the other side of a seam, stop and raise it — the builder on that side is still working from the original.
- **Follow the area's conventions.** Read neighbouring code before writing new code: naming, structure, error handling, test layout. Reuse what exists before adding something similar.
- **Write the checks** named in the acceptance criteria, at the tier the design specified, alongside the code.
- **Never weaken a check to make it pass.** Do not skip, delete, loosen or re-snapshot an existing check to get green. If a check is wrong, say so in the as-built record and leave the decision to review.
- **Never edit generated or vendored files.** Change their source and regenerate.
- **Run the unit checks for your area** before reporting, using the command recorded in `AGENTS.md`.

## Record the as-built contract

Append one section per slice to `as-built.md` in the work record:

- **Slice** — name and area.
- **Contract as built** — the real shapes shipped: names, fields, types, error shapes, flags, status values. Copy them from the code, not from the design.
- **Deviations** — every difference from `tech-design.md`, and why.
- **Checks added** — where they live and what each proves.
- **Checks run** — the command and the result, with skipped counts. A check that could not run is reported as blocked with the reason, never as passed.
- **Open questions** — for review.

The as-built contract is rarely identical to the design, and that is expected. A difference nobody wrote down is not.

## Gate

A slice is done when its as-built section exists and its unit checks were run. Hand the change set to stage 4.

## When verify sends a slice back

Verify returns only failing slices, each with its exact failure. Fix that failure, update the slice's as-built section, and return it. Do not reopen slices that passed. The round limit in `AGENTS.md` applies: when it is reached, the loop stops and reports instead of trying again.
