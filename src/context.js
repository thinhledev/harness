// The project's own context file. AGENTS.md is the real file; the Harness
// section lives between markers so the rest of the file is never touched.
// CLAUDE.md is a one-line bridge that imports it.

import fs from 'node:fs';
import path from 'node:path';
import { FACTS, isOpen } from './facts.js';
import { DEFAULT_GUARDRAILS } from './guardrails.js';

export const BEGIN = '<!-- harness:begin -->';
export const END = '<!-- harness:end -->';
const BRIDGE = '@AGENTS.md';
const NO_PROJECT_GUARDRAILS = 'None recorded yet.';

export function renderSection({ facts, guardrails, version }) {
  const factRows = FACTS.map(({ key, label, command }) => {
    const fact = facts[key];
    const value = command && !isOpen(fact.value) && fact.value !== 'not applicable' && !fact.value.includes('`')
      ? `\`${fact.value}\``
      : fact.value;
    return `| ${label} | ${cell(value)} | ${cell(fact.source)} |`;
  });
  const projectGuardrails = guardrails.length > 0 ? guardrails : [NO_PROJECT_GUARDRAILS];

  return [
    BEGIN,
    '## Harness',
    '',
    `This project follows the Harness loop. Written by \`harness init\` (@thinhledev/harness ${version}). Edit the facts and the project guardrails freely; rerunning init keeps them.`,
    '',
    '### The loop',
    '',
    '| # | Stage | Skill | Agent |',
    '| --- | --- | --- | --- |',
    '| 1 | UI design — only when an interface changes | `harness-ui-design` | `designer` |',
    '| 2 | Technical design | `harness-tech-design` | `architect` |',
    '| 3 | Write — one builder per area, in parallel | `harness-write` | `builder` |',
    '| 4 | Review | `harness-review` | `reviewer` |',
    '| 5 | Verify — per slice as it lands, and at the end | `harness-verify` | `verifier` |',
    '',
    'Claude Code picks the skills and agents up by their descriptions. Codex does the same for skills (or mention one as `$harness-verify`); spawn an agent by naming it, for example "spawn the verifier".',
    '',
    '- **Gates stop work.** A stage does not start until the previous stage\'s gate is met.',
    '- **Size gate.** Work is small when it stays in one area, changes no contract (interface, data shape, stored state, flags, public surface), adds no dependency, and changes nothing visible beyond wording. Small work skips stages 1 and 2; review and verify always run.',
    '- **Skipped stages are stated**, with the reason, in the work record.',
    '- **Loop back.** Verify not green sends only the failing slices back to Write, at most twice. Still not green after that: stop and report what is broken.',
    '- **Work records.** Each piece of work gets its own folder under the work records directory, holding `ui-design.md`, `tech-design.md`, `as-built.md`, `review.md` and `verify.md`.',
    '- **Unknown facts** are resolved by stage 2 when work depends on them, then updated here with their source.',
    '',
    '### Project facts',
    '',
    '| Fact | Value | Source |',
    '| --- | --- | --- |',
    ...factRows,
    '',
    '### Guardrails',
    '',
    'Always:',
    '',
    ...DEFAULT_GUARDRAILS.map((g) => `- ${g}`),
    '',
    'For this project:',
    '',
    ...projectGuardrails.map((g) => `- ${g}`),
    END,
  ].join('\n');
}

/** Facts and project guardrails recorded by an earlier init, or null. */
export function parseSection(text) {
  const section = extractSection(text);
  if (!section) return null;
  const lines = section.split('\n');
  const byLabel = new Map(FACTS.map((f) => [f.label, f.key]));

  const facts = {};
  const factsStart = lines.findIndex((l) => /^###\s+Project facts/.test(l));
  if (factsStart !== -1) {
    for (const line of lines.slice(factsStart + 1)) {
      if (/^###\s/.test(line)) break;
      if (!line.startsWith('|')) continue;
      const cells = splitRow(line);
      const key = byLabel.get(cells[0]);
      if (key && cells.length >= 3) facts[key] = { value: stripTicks(cells[1]), source: cells[2] };
    }
  }

  const guardrails = [];
  const projectStart = lines.findIndex((l) => /^For this project:/.test(l));
  if (projectStart !== -1) {
    for (const line of lines.slice(projectStart + 1)) {
      if (/^#{1,6}\s/.test(line) || line.startsWith(END)) break;
      const item = line.match(/^\s*-\s+(.+)$/);
      if (item && item[1].trim() !== NO_PROJECT_GUARDRAILS) guardrails.push(item[1].trim());
    }
  }
  return { facts, guardrails };
}

export function extractSection(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END, start);
  if (start === -1 || end === -1) return null;
  return text.slice(start, end + END.length);
}

/** New AGENTS.md content with the section inserted or replaced in place. */
export function upsertSection(existing, section) {
  if (existing == null || existing.trim() === '') return `# AGENTS.md\n\n${section}\n`;
  const current = extractSection(existing);
  if (current) return existing.replace(current, () => section);
  return `${existing.replace(/\s*$/, '')}\n\n${section}\n`;
}

/** New CLAUDE.md content bridging to AGENTS.md, or null when nothing changes. */
export function bridgeClaude(root, existing) {
  const claudePath = path.join(root, 'CLAUDE.md');
  const agentsPath = path.join(root, 'AGENTS.md');
  try {
    if (fs.realpathSync(claudePath) === fs.realpathSync(agentsPath)) return null; // symlinked already
  } catch {
    // one of them does not exist yet
  }
  if (existing == null) return `${BRIDGE}\n`;
  if (existing.split('\n').some((l) => l.trim() === BRIDGE)) return null;
  return `${existing.replace(/\s*$/, '')}\n\n${BRIDGE}\n`;
}

function cell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function splitRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

function stripTicks(value) {
  const m = value.match(/^`([^`]*)`$/);
  return m ? m[1] : value;
}
