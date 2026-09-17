import fs from 'node:fs';
import path from 'node:path';
import { FACTS, isOpen, normalizeValue } from './facts.js';
import { scanProject } from './scan/index.js';
import { DEFAULT_GUARDRAILS } from './guardrails.js';
import { renderSection, parseSection, upsertSection, bridgeClaude } from './context.js';
import { isOwned } from './emit/source.js';
import { TARGETS, CODEX_DOC_LIMIT, detectTargets } from './emit/index.js';

/**
 * Sets a project up for the Harness loop.
 * io: { print(line), ask(question) → Promise<string> }; ask is only used when interactive.
 * targets: agent ids to emit for (see emit/index.js); detected from the project when omitted.
 * Returns { facts, guardrails, targets, results } where results lists every file and what happened to it.
 */
export async function init({ root, pkgRoot, version, interactive, targets, force = false, dryRun = false, io }) {
  const agentsText = readIfExists(path.join(root, 'AGENTS.md'));
  const previous = agentsText ? parseSection(agentsText) : null;
  const facts = mergeFacts(previous?.facts ?? {}, scanProject(root));
  let guardrails = previous?.guardrails ?? [];
  const detected = targets ? { targets, reason: 'chosen with --agent' } : detectTargets(root);

  io.print(`harness init — ${root}`);
  io.print(`Agents: ${detected.targets.map((id) => TARGETS[id].label).join(', ')} (${detected.reason})`);
  io.print('');
  io.print(previous ? 'Recorded earlier, or worked out from your project\'s own files:' : 'Worked out from your project\'s own files:');
  printFacts(io, facts);
  io.print('');
  io.print('Guardrails that always apply:');
  for (const g of DEFAULT_GUARDRAILS) io.print(`  - ${g}`);
  if (guardrails.length > 0) {
    io.print('Recorded for this project:');
    for (const g of guardrails) io.print(`  - ${g}`);
  }

  if (interactive) {
    guardrails = [...guardrails, ...(await askGuardrails(io))];
    await confirmFacts(io, facts);
  }

  const section = renderSection({ facts, guardrails, version });
  const agentsContent = upsertSection(agentsText, section);
  const planned = [{ dest: 'AGENTS.md', content: agentsContent, owned: true }];
  if (detected.targets.includes('claude')) {
    planned.push({ dest: 'CLAUDE.md', content: bridgeClaude(root, readIfExists(path.join(root, 'CLAUDE.md'))), owned: true });
  }
  for (const id of detected.targets) planned.push(...TARGETS[id].plan(pkgRoot, version));

  const results = planned.map((file) => writePlanned(root, file, { force, dryRun }));
  io.print('');
  io.print(dryRun ? 'Would write (dry run, nothing changed):' : 'Wrote:');
  for (const r of results) io.print(`  ${r.status.padEnd(9)} ${r.dest}`);
  const conflicts = results.filter((r) => r.status === 'conflict');
  if (conflicts.length > 0) {
    io.print('');
    io.print(`${conflicts.length} file(s) already exist and were not written by harness; left untouched. Rerun with --force to replace them.`);
  }
  const sectionEnd = Buffer.byteLength(agentsContent.slice(0, agentsContent.indexOf(section) + section.length));
  if (detected.targets.includes('codex') && sectionEnd > CODEX_DOC_LIMIT) {
    io.print('');
    io.print(`AGENTS.md is ${Buffer.byteLength(agentsContent)} bytes and the Harness section ends at byte ${sectionEnd}. Codex reads only the first ${CODEX_DOC_LIMIT} bytes by default, so it will miss part of the section: move the section up or raise project_doc_max_bytes.`);
  }
  if (!dryRun) {
    io.print('');
    io.print('Facts that read "unknown", "not yet established" or "none" are resolved by stage 2 when work first needs them.');
  }
  return { facts, guardrails, targets: detected.targets, results };
}

/** Recorded facts win over the scan; open ones are refilled. Differences are noted. */
export function mergeFacts(recorded, scanned) {
  const facts = {};
  for (const { key } of FACTS) {
    const rec = recorded[key];
    const scan = scanned[key];
    if (rec && !isOpen(rec.value)) {
      const differs = scan && !isOpen(scan.value) && scan.value !== rec.value;
      facts[key] = { ...rec, note: differs ? `scan now finds ${scan.value} (${scan.source})` : undefined };
    } else {
      facts[key] = { ...scan };
    }
  }
  return facts;
}

function printFacts(io, facts) {
  const width = Math.max(...FACTS.map((f) => f.label.length));
  FACTS.forEach(({ key, label }, i) => {
    const fact = facts[key];
    io.print(`  ${i + 1}  ${label.padEnd(width)}  ${fact.value}`);
    io.print(`     ${''.padEnd(width)}  ↳ ${fact.source}`);
    if (fact.note) io.print(`     ${''.padEnd(width)}  ! ${fact.note}`);
  });
}

async function askGuardrails(io) {
  io.print('');
  io.print('What else must an agent never run, commit or deploy in this project?');
  io.print('(the deploy command, the branch that ships, a script that costs money, an environment nobody touches)');
  io.print('One per line; an empty line finishes.');
  const added = [];
  for (;;) {
    const line = (await io.ask('> ')).trim();
    if (!line) break;
    const phrasedAsRule = /^(never|don't|do not|no|only|always|avoid)\b/i.test(line);
    added.push(phrasedAsRule ? capitalize(line) : `Never ${line.replace(/^./, (c) => c.toLowerCase())}`);
  }
  return added;
}

async function confirmFacts(io, facts) {
  for (;;) {
    io.print('');
    io.print('Correct a fact with "<number> <value>" (n/a, none and unknown work), or press Enter to write.');
    const line = (await io.ask('> ')).trim();
    if (!line) return;
    const m = line.match(/^(\d+)\s+(.+)$/);
    const fact = m && FACTS[Number(m[1]) - 1];
    if (!fact) {
      io.print(`  Expected a number from 1 to ${FACTS.length} followed by a value.`);
      continue;
    }
    facts[fact.key] = { value: normalizeValue(m[2]), source: 'confirmed at init' };
    printFacts(io, facts);
  }
}

function writePlanned(root, { dest, content, owned }, { force, dryRun }) {
  const file = path.join(root, dest);
  if (content == null) return { dest, status: 'unchanged' };
  const current = readIfExists(file);
  if (current === content) return { dest, status: 'unchanged' };
  if (current != null && !owned && !isOwned(current) && !force) return { dest, status: 'conflict' };
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { dest, status: current == null ? 'created' : 'updated' };
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
