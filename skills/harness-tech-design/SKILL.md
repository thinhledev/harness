---
name: harness-tech-design
description: Stage 2 of the Harness loop. Use before implementing any change that adds or alters an interface, a data shape, stored state, a dependency, or behaviour across more than one area — produces architecture, exact contracts, failure modes, and acceptance criteria written as checks. Also owns establishing project facts that are still unknown.
---

# Stage 2 · Technical design

Settle the contracts before anyone writes code. This stage writes the specification; it never implements it.

## Start from the project's facts

Read the Harness section of `AGENTS.md`: size gate, project facts, guardrails. If `AGENTS.md` has no Harness section, the project has not been set up: say so, and ask the human to run `harness init` before going further.

- **Size gate first.** If the work is small, write `Technical design: skipped — <reason>` in the work record, plus one paragraph stating the change and the check that will prove it, and hand straight to stage 3.
- **Unknown facts are this stage's job.** A fact this work depends on that reads `unknown` or `not yet established` gets resolved here. Find the answer in the project, ask the human, or — for a missing check tier — make establishing it the first slice. Once it is real, update the fact in `AGENTS.md` with its value and where it came from.
- **Areas.** If `areas` names a single area and the design reveals clearly separate surfaces, name them and update the fact. Stage 3 runs one builder per area.
- **Delegate to an existing owner.** If the project already has a skill, template or decision-record format for design documents, write in that format and link it from the work record.

## Produce `tech-design.md`

Write it in this work's folder under the `work records` directory.

1. **Problem and scope** — what changes, and what explicitly does not.
2. **Architecture** — the pieces involved, the area each lives in, and how data moves between them. Draw a diagram when there are more than three pieces.
3. **Data model** — every new or changed stored shape: fields, types, optionality, defaults, and how existing data migrates, including the way back.
4. **Contracts** — for every seam between pieces: producer, consumer, the exact shape (request and response, event payload, file format, function signature, command-line flags and exit codes), error shapes, and versioning. Precise enough that two builders on opposite sides, working in parallel, produce parts that fit.
5. **Failure modes** — for each contract: timeout, invalid input, partial failure, retry and duplicate delivery, concurrent writes, missing permission. Name the behaviour; "handle errors" is not a behaviour.
6. **Acceptance criteria as checks** — each one passes or fails: `Given <state>, when <action>, then <observable result>`. Name the tier that proves it (unit or end-to-end) and where the check will live. "Should be fast" is not a criterion; "answers in under 300 ms at 50 requests per second" is.
7. **Slices** — the work cut into pieces a builder can finish and verify on its own, in dependency order, each tagged with its area and the contracts it implements.
8. **Seams to verify** — the producer and consumer pairs from section 4, listed for stage 5.

If `ui-design.md` exists, every screen in it appears as a consumer in section 4 and every screen state maps to a producer state.

## Escalate now, not later

Before hand-off, stop and ask the human about anything that is:

- **irreversible** — destructive migrations, public identifiers, published interfaces;
- **costly** — new paid services, significant compute, new infrastructure; or
- **user-visible** in a way the request did not already decide.

Record each question and its answer in the document. Discovering these during stage 3 costs a rebuild.

## Gate

Hand off only when:

- every contract has an exact shape,
- every acceptance criterion names the check that proves it, and
- every escalation has an answer.

## Hand-off

Stage 3 receives the slices. Each builder gets the contracts for its slice and nothing it has to guess.
