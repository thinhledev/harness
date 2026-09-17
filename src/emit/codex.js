// Codex emitter. Skills use the same SKILL.md format and trigger by
// description, so they are copied to .agents/skills/<name>/SKILL.md unchanged.
// Agents become .codex/agents/<name>.toml. Codex has no per-agent tool list,
// so Claude's `tools:` restriction has no direct equivalent there: the reviewer,
// which only reads, gets a read-only sandbox instead. The verifier keeps the
// session's sandbox, because the checks it runs write build output and caches;
// its read-only rule is carried by its instructions, as it is for Claude's shell.

import { readSkills, readAgents, stampMarkdown, markText } from './source.js';

export const READ_ONLY_AGENTS = new Set(['reviewer']);

export function planCodexFiles(pkgRoot, version) {
  return [
    ...readSkills(pkgRoot).map((skill) => ({
      dest: `.agents/skills/${skill.name}/SKILL.md`,
      content: stampMarkdown(skill.raw, skill.from, version),
    })),
    ...readAgents(pkgRoot).map((agent) => ({
      dest: `.codex/agents/${agent.name}.toml`,
      content: agentToml(agent, version),
    })),
  ];
}

export function agentToml(agent, version) {
  const lines = [
    `# ${markText(version, agent.from)}`,
    `name = ${basicString(agent.name)}`,
    `description = ${basicString(agent.fields.description ?? '')}`,
  ];
  if (READ_ONLY_AGENTS.has(agent.name)) lines.push('sandbox_mode = "read-only"');
  lines.push(`developer_instructions = ${multilineString(agent.body)}`);
  return `${lines.join('\n')}\n`;
}

/** A single-line TOML basic string. JSON escapes are a subset of TOML's. */
function basicString(text) {
  return JSON.stringify(text).replace(/[]/g, '\\u007f');
}

/** Multi-line literal string when possible (no escaping), basic otherwise. */
function multilineString(text) {
  const body = text.endsWith('\n') ? text : `${text}\n`;
  if (!body.includes("'''")) return `'''\n${body}'''`;
  const escaped = body.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"');
  return `"""\n${escaped}"""`;
}
