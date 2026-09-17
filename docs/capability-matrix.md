# Capability matrix

How much of Harness makes it into each agent, and what gets lost on the way. One source (`skills/`, `agents/`, and the Harness section of `AGENTS.md`) is emitted for both.

**Checked on 2026-09-17** against Claude Code 2.1.270 and codex-cli 0.142.5, using their published docs and local runs. Both CLIs shipped breaking config changes this year, so re-check this page at every release and update the date.

## At a glance

| Capability | Claude Code | Codex | Loss in Codex |
| --- | --- | --- | --- |
| Project context | `CLAUDE.md`, containing `@AGENTS.md` | `AGENTS.md`, read natively | None, unless the section ends past 32 KiB |
| Stage skills | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` | None. Same file, and both trigger on the description |
| Explicit skill call | By name | `$harness-verify`, or `/skills` | None |
| Role agents | `.claude/agents/<name>.md` | `.codex/agents/<name>.toml` | Tool lists (see below) |
| Choosing an agent | Automatic from the description, or by name | Spawned by naming it in the prompt | Not picked automatically |
| Read-only reviewer | No edit tools | `sandbox_mode = "read-only"` | None; the sandbox is stronger |
| Read-only verifier | No edit tools; shell limited by instructions | Session sandbox; limited by instructions | Same as Claude's shell: rule-enforced, not tool-enforced |
| Designer checks its own screens | Whatever browser tools the session has | Whatever browser tools the session has | Depends on configured tools |
| Plugin distribution | `.claude-plugin/` (this repo) | `.agents/plugins/marketplace.json` | Not packaged yet (M5) |

## Details

### Context: `AGENTS.md`

`harness init` always writes the Harness section to `AGENTS.md`. For Claude Code it adds a one-line `@AGENTS.md` import to `CLAUDE.md`. Codex reads `AGENTS.md` itself. By default it reads only the first 32 KiB (`project_doc_max_bytes`), so `init` warns if the section ends past that point.

*Verified:* `codex debug prompt-input` on a newly set-up project includes the section, facts and guardrails.

### Skills

The plan expected skills to degrade into prompts that Codex only runs when asked. That is no longer the case. Codex reads the same `SKILL.md` format (`name` and `description` required) from `.agents/skills/`, and picks a skill automatically when the task matches its description, as Claude Code does. The emitter copies the files unchanged.

Codex caps the skill list at about 2% of context (8,000 characters) and shortens descriptions to fit, so each description leads with its stage and trigger words.

*Verified:* `codex debug prompt-input` lists all five skills with their descriptions and paths.

### Agents

| Field | Claude Code (`.md` frontmatter) | Codex (`.toml`) |
| --- | --- | --- |
| Identifier | `name` | `name` (required; it is the name used to spawn) |
| When to use | `description` | `description` (required) |
| Instructions | Markdown body | `developer_instructions` (required) |
| Tool restriction | `tools:` list | None; closest is `sandbox_mode` |

What is lost:

- **Tool lists.** Codex has no per-agent tool list. The reviewer only reads, so it gets `sandbox_mode = "read-only"`. The verifier must run checks, and checks write build output and caches, so a read-only sandbox would block every run. It keeps the session's sandbox, and its instructions forbid edits. That matches how Claude's verifier is limited on the shell.
- **Automatic choice.** Codex spawns a custom agent when the prompt names it ("spawn the verifier"). The Harness section of `AGENTS.md` says so.
- **Reliability.** In March 2026, [community reports](https://codex.danielvaughan.com/2026/03/29/subagent-gotchas-known-issues/) said `spawn_agent` could not reliably target a named definition. The [current docs](https://learn.chatgpt.com/docs/agent-configuration/subagents) say agents spawn by `name`.

*Not yet verified:* that codex-cli 0.142.5 spawns these five agents by name. No read-only Codex command lists custom agents, and a broken agent file produced no error in `codex debug prompt-input`. Confirm with a real session:

```bash
codex exec "Without spawning anything, list the custom agent names you could spawn."
```

The generated TOML is checked in the tests: Python's `tomllib` parses it, and it round-trips to the source files.

### Distribution

The Codex marketplace reads `.agents/plugins/marketplace.json`. Each entry needs `policy.installation`, `policy.authentication` and `category`, and its `source.path` must point inside the marketplace root. Plugins bundle skills, MCP servers and hooks, but not custom agents. A Codex plugin could therefore ship only the skills, and `harness init` would still be needed for the agents. Packaging it is part of M5.

## Sources

- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex subagents and custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Codex subagent gotchas, March 2026](https://codex.danielvaughan.com/2026/03/29/subagent-gotchas-known-issues/)
