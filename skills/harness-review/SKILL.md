---
name: harness-review
description: Stage 4 of the Harness loop. Use after implementation and before verification to read the change set for correctness, contract fidelity, duplication and convention drift — reports findings and triages every one; never silently rewrites code.
---

# Stage 4 · Review

Read the diff and report what is wrong. Applying a fix is a separate, visible step.

## Inputs

- The change set: this work's diff against its base.
- `tech-design.md` and `as-built.md` from the work record.
- The guardrails and project facts in the Harness section of `AGENTS.md`. If `AGENTS.md` has no Harness section, the project has not been set up: say so, and ask the human to run `harness init` before going further.

If the project already has its own review skill or checklist, run it as part of this stage and merge its findings into the same triage rather than producing two reports.

## Read for

1. **Correctness** — logic errors, boundary cases, failure modes the design named but the code does not handle, concurrency, resource leaks, wrong error shapes.
2. **Contract fidelity** — the code matches `as-built.md`, and every difference from `tech-design.md` appears there as a deviation.
3. **Duplication** — new code that re-implements something the project already has. Name the existing thing and where it lives.
4. **Convention drift** — naming, structure, error handling or test layout that departs from the surrounding area without a stated reason.
5. **Guardrails** — secrets or environment values in code, logs or fixtures; generated or vendored files edited by hand; checks weakened, skipped or deleted.
6. **Checks** — every acceptance criterion has a check that would fail if the behaviour broke.

Read the code around the change, not only the changed lines. Many defects are in what the diff forgot to change.

## Report

Record `review.md` in the work record, one entry per finding:

- **Where** — file and line.
- **What** — the defect, in one sentence.
- **Failure** — a concrete input or state that produces the wrong result. A finding without one is a suggestion and is labelled as such.
- **Severity** — `blocking`, `should-fix`, or `suggestion`.

Do not edit code during review. A read-only reviewer returns the report as its final message and the caller saves it.

## Triage

Every finding ends in exactly one state, written next to it:

- **applied** — fixed as a separate, visible change, with a pointer to it;
- **rejected** — with the reason; or
- **filed** — deferred, with where it was recorded.

No finding is left without a state, and no change is made that is not tied to a finding.

## Gate

Hand to stage 5 when every `blocking` finding is applied or rejected with a reason.
