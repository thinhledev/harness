import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject } from './helpers.js';
import { renderSection, parseSection, upsertSection, bridgeClaude, BEGIN, END } from '../src/context.js';
import fs from 'node:fs';
import path from 'node:path';

const facts = {
  unit: { value: 'npm test', source: 'package.json → scripts.test' },
  e2e: { value: 'not yet established', source: 'nothing found' },
  design: { value: 'none', source: 'nothing found' },
  areas: { value: 'apps/web, apps/api', source: 'package.json → workspaces' },
  records: { value: 'docs/harness/', source: 'default' },
};

test('section round-trips facts and project guardrails', () => {
  const tricky = { ...facts, unit: { value: 'npm test | tee out.log', source: 'Makefile:3' } };
  const section = renderSection({ facts: tricky, guardrails: ['Never run the deploy script'], version: '0.1.0' });
  assert.ok(section.startsWith(BEGIN) && section.endsWith(END));
  assert.match(section, /\| unit checks \| `npm test \\\| tee out\.log` \| Makefile:3 \|/);
  assert.match(section, /\| end-to-end checks \| not yet established \|/);

  const parsed = parseSection(`# Mine\n\nkeep me\n\n${section}\n`);
  assert.deepEqual(parsed.facts, tricky);
  assert.deepEqual(parsed.guardrails, ['Never run the deploy script']);
});

test('no project guardrails parses as an empty list', () => {
  const section = renderSection({ facts, guardrails: [], version: '0.1.0' });
  assert.deepEqual(parseSection(section).guardrails, []);
  assert.equal(parseSection('# no section here'), null);
});

test('upsert creates, appends, and replaces in place without touching the rest', () => {
  const v1 = renderSection({ facts, guardrails: [], version: '0.1.0' });
  const v2 = renderSection({ facts, guardrails: ['Never touch production'], version: '0.1.0' });

  assert.equal(upsertSection(null, v1), `# AGENTS.md\n\n${v1}\n`);

  const appended = upsertSection('# House rules\n\nUse tabs.\n', v1);
  assert.equal(appended, `# House rules\n\nUse tabs.\n\n${v1}\n`);

  const replaced = upsertSection(`${appended}\n## After\n\nstays\n`, v2);
  assert.ok(replaced.startsWith('# House rules\n\nUse tabs.\n\n'));
  assert.ok(replaced.includes('Never touch production'));
  assert.ok(replaced.endsWith('## After\n\nstays\n'));
  assert.equal(replaced.split(BEGIN).length, 2);
});

test('CLAUDE.md bridge: create, append once, respect a symlink', () => {
  const root = makeProject({});
  assert.equal(bridgeClaude(root, null), '@AGENTS.md\n');
  assert.equal(bridgeClaude(root, '# Claude notes\n'), '# Claude notes\n\n@AGENTS.md\n');
  assert.equal(bridgeClaude(root, '# Claude notes\n\n@AGENTS.md\n'), null);

  const linked = makeProject({ 'AGENTS.md': '# a' });
  fs.symlinkSync('AGENTS.md', path.join(linked, 'CLAUDE.md'));
  assert.equal(bridgeClaude(linked, '# a'), null);
});
