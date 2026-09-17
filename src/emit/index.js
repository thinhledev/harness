import fs from 'node:fs';
import path from 'node:path';
import { planClaudeFiles } from './claude.js';
import { planCodexFiles } from './codex.js';

export const TARGETS = {
  claude: { label: 'Claude Code', plan: planClaudeFiles, signals: ['.claude/', 'CLAUDE.md', 'CLAUDE.local.md'] },
  codex: { label: 'Codex', plan: planCodexFiles, signals: ['.codex/', '.agents/'] },
};

/** Codex reads AGENTS.md up to project_doc_max_bytes, 32 KiB by default. */
export const CODEX_DOC_LIMIT = 32 * 1024;

/**
 * Which agents to emit for. A project that already shows signs of exactly one
 * gets that one; no signs, or both, gets both.
 */
export function detectTargets(root) {
  const found = {};
  for (const [id, { signals }] of Object.entries(TARGETS)) {
    found[id] = signals.filter((s) => {
      try {
        const stat = fs.statSync(path.join(root, s));
        return s.endsWith('/') ? stat.isDirectory() : stat.isFile();
      } catch {
        return false;
      }
    });
  }
  const present = Object.keys(TARGETS).filter((id) => found[id].length > 0);
  if (present.length === 1) {
    return { targets: present, reason: `found ${found[present[0]].join(', ')}` };
  }
  const all = Object.keys(TARGETS);
  return {
    targets: all,
    reason: present.length === 0 ? 'no agent configuration found, so both' : `found ${all.flatMap((id) => found[id]).join(', ')}`,
  };
}

/** Parses --agent values: claude, codex, all; comma-separated or repeated. */
export function parseTargets(values) {
  const ids = new Set();
  for (const value of values) {
    for (const part of value.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean)) {
      if (part === 'all') Object.keys(TARGETS).forEach((id) => ids.add(id));
      else if (TARGETS[part]) ids.add(part);
      else return { error: `Unknown agent: ${part} (expected ${Object.keys(TARGETS).join(', ')} or all)` };
    }
  }
  return { targets: Object.keys(TARGETS).filter((id) => ids.has(id)) };
}
