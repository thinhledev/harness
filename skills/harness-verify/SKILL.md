---
name: harness-verify
description: Stage 5 of the Harness loop. Use after review, and per slice as slices land, to cross-read every seam from both sides and run the project's own checks, ending in a single verdict. Skipped and blocked checks count as failures; verification never edits anything to make a run pass.
---

# Stage 5 · Verify

Two pieces can each be correct and still disagree where they meet: a response shape the client does not expect, a state one side can produce and the other cannot render, a permission the code assumes and the configuration never granted. Unit checks cannot see this, because both sides pass their own. This stage exists for that defect.

## Rules

- **A seam is never verified from one side.** Open the producer and the consumer in the same pass and compare them field by field.
- **Skipped means failed.** A check that was skipped, filtered out or marked pending counts as a failure.
- **Blocked is never green.** A check that could not run — missing command, missing environment, missing access, a dependency that is down — is reported as `blocked` with the reason. It never counts as passing.
- **Read-only.** Do not edit source, checks, fixtures, snapshots or configuration to make a run pass. Anything that must change goes back to stage 3.
- **Per slice, as it lands.** Verify each slice when its as-built section appears, not only at the end. An early mismatch propagates into everything built on top of it.

## 1. Cross-read the seams

Start from "Seams to verify" in `tech-design.md` and the contracts in `as-built.md`. Map the generic pairs below onto what this project actually uses, and add any seam the change touched that the design missed.

| Producer | Consumer | Mismatch to look for |
| --- | --- | --- |
| Schema or interface definition | Generated or hand-written client | Field names, optionality, types, enum values, error shapes |
| State definition: statuses and transitions | Code that writes state; interface that renders it | A state one side can produce that the other cannot handle |
| Route or entry-point definitions | Links, redirects and navigation that target them | Targets that do not exist; parameters named differently |
| Declared permissions, roles and scopes | Calls actually made | A call never granted; a grant nothing uses |
| Stored data shape and its migrations | Every reader of that data | Existing records the new reader cannot parse |
| Declared configuration and environment keys | Keys the code reads | Names that differ; required keys with no default |
| Design tokens and screen specs | The rendered screen | Hard-coded values, missing states, wrong sizes |
| Event or message publishers | Subscribers | Payload shape, ordering assumptions, duplicate delivery |
| Command-line flags, help text, exit codes | Parsing code and callers | Documented flags that do not exist; undocumented exit codes |
| Public interface and its documentation | Callers and the version number | Breaking changes without a version change |

For each seam record the producer location, the consumer location, `match` or `mismatch`, and for a mismatch the exact difference.

## 2. Run the checks

Use the commands in the `unit checks` and `end-to-end checks` facts in `AGENTS.md`, unit first. If `AGENTS.md` has no Harness section, the project has not been set up: say so, and ask the human to run `harness init` before going further.

- **A command is recorded** → run it. Read the output, not only the exit status, and count passed, failed, skipped and pending.
- **`not yet established`** → `blocked`, unless stage 2 established it for this work.
- **`not applicable`** → state it and the reason. It does not count against the verdict.
- **A guardrail forbids what the check needs** → do not run it; the check is `blocked`.

## 3. Verdict

Record `verify.md` in the work record. A read-only verifier returns it as its final message and the caller saves it.

- **Round** — which verify round this is.
- **Verdict** — `green` or `not green`.
- **Must change** — for `not green`, the shortest list of what must change, each item tied to a slice.
- **Seams** — the results from step 1.
- **Checks** — per tier: the command run and the passed, failed, skipped and blocked counts.

`green` requires every seam to match, every check tier to pass or be `not applicable`, zero skipped and zero blocked. Nothing else is green.

## Loop back

`not green` → send each failing slice back to stage 3 with its exact failure. Only failing slices return.

The loop sends work back at most twice. If the verify round after the second return is still not green, stop: report what is still broken and why, and hand to the human. A stuck loop must surface instead of burning more rounds.
