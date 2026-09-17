---
name: harness-ui-design
description: Stage 1 of the Harness loop (conditional). Use before building or changing a user-facing interface — new screens, visual changes, or a project's first design system — to fix tokens, type scale, layout rules, states and named screens before any component exists. Skipped, out loud, for work with no interface.
---

# Stage 1 · UI design

Fix the visual system and the screens before any component exists. Builders implement against this document; they do not invent the design as they go.

## Decide whether this stage runs

Read the Harness section of the project's `AGENTS.md` first. It holds the size gate, the project facts and the guardrails. If `AGENTS.md` has no Harness section, the project has not been set up: say so, and ask the human to run `harness init` before going further.

- **No interface is touched** → skip. Write `UI design: skipped — <reason>` in the work record. A skipped stage is stated with its reason, so nobody later mistakes an absent design for an oversight.
- **The size gate classifies the work as small** → skip, stated the same way.
- **Text-only interface** (terminal output, messages people read) → run a reduced stage: output layout, wording, help text, error messages, color and no-color behaviour, progress and interruption states. Skip visual tokens.
- Otherwise → run the full stage.

## Follow or create

The `design system` fact in `AGENTS.md` decides the mode.

- **Recorded** → follow it. Read it, reuse its tokens and components, and propose additions only where this work needs something the system lacks. Mark every addition as a proposal.
- **`none`** → create it. The system you write becomes the project's; when it is settled, record its path in the `design system` fact.
- **The project already has a skill or document that owns design** → delegate to it, and link its output from the work record instead of producing a rival one.

## Produce `ui-design.md`

Write it in this work's folder under the `work records` directory.

1. **Tokens** — color (with dark or high-contrast counterparts if the product has them), type scale, spacing scale, radii, elevation, motion. Named values, not adjectives.
2. **Layout rules** — grid, breakpoints or window sizes, density, how content reflows.
3. **Components** — existing ones by name; new ones with their variants and every state they can be in.
4. **Screens** — every screen the work touches, named, with its purpose, its content, and how a person reaches it.
5. **States per screen** — loading, empty, error, partial data, and no-permission wherever they can occur. A state the system can produce and no screen renders is a defect, and this is the cheapest place to catch it.
6. **Accessibility** — contrast targets, focus order, keyboard paths, text alternatives, reduced motion.

## Check your own work

Render what you designed — a static mock, a prototype, or the running product — and look at it yourself at every size the product supports, in every theme it supports. Do not ask a person to look for you. Record what you checked, at which sizes, and what you changed as a result.

## Escalate now

Anything user-visible that is expensive to change later — brand, navigation structure, public addresses of screens — goes to the human as an explicit question before stage 2. Record the question and the answer.

## Gate

Do not hand off until:

- every token has a value,
- every screen the work touches is named, with its states, and
- the rendered check above has been done.

## Hand-off

Stage 2 (technical design) reads `ui-design.md`. Each screen becomes a consumer in its contracts, and the design tokens become a seam for stage 5.
