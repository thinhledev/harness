# AGENTS.md

Harness is a process for coding agents, shipped as instructions. This repository holds that process, plus a small CLI that installs it into a project.

## Layout

- `skills/harness-*/SKILL.md`: the five stage skills. This is the single source for what each stage does.
- `agents/*.md`: the five role agents (designer, architect, builder, reviewer, verifier).
- `src/`: the `harness init` CLI. Zero runtime dependencies; Node 18.17+.
  - `scan/`: read-only inference of project facts from documents, manifests and pipeline files.
  - `context.js`: the Harness section of a project's `AGENTS.md`, and the `CLAUDE.md` bridge.
  - `emit/claude.js`: copies skills and agents into `.claude/`, stamped as generated.
- `.claude-plugin/`: Claude Code plugin and marketplace manifests.

## Rules

- **No project specifics in skills or agents.** Never name a framework, a service or a command in `skills/` or `agents/`. `npm test` enforces this through `scripts/check-specifics.js`. If a rule only makes sense for one kind of stack, generalise it or leave it out.
- **The scan never reads source.** Documents, manifests, pipeline files and directory names only. Anything it can't determine is recorded as unknown, never guessed, and every fact names the file it came from.
- **Never overwrite what harness did not write.** Files without the generated mark are conflicts unless `--force` is passed. In `AGENTS.md`, only the text between the harness markers changes.
- **No dependencies, no network, no telemetry.**
- Keep the loop description in `src/context.js` consistent with the skills when either changes.

## Checks

- Unit: `npm test` (node's built-in test runner, plus the specifics check).
- End-to-end: not applicable. The CLI tests in `test/cli.test.js` run the real binary against temporary projects.
