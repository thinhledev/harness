import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { makeProject, read, pkgRoot } from './helpers.js';
import { parseArgs } from '../src/cli.js';
import { findSpecifics } from '../scripts/check-specifics.js';

const bin = path.join(pkgRoot, 'bin', 'harness.js');
const harness = (args, options = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', ...options });

test('parseArgs', () => {
  assert.deepEqual(parseArgs(['init', '--dir', 'x', '-y']), { yes: true, force: false, dryRun: false, dir: 'x' });
  assert.equal(parseArgs(['init', '--dir=y']).dir, 'y');
  assert.equal(parseArgs(['--version']).version, true);
  assert.match(parseArgs([]).error, /Missing command/);
  assert.match(parseArgs(['deploy']).error, /Unknown command: deploy/);
  assert.match(parseArgs(['init', '--nope']).error, /Unknown option/);
  assert.match(parseArgs(['init', '--dir']).error, /needs a path/);
  assert.deepEqual(parseArgs(['init', '--agent', 'codex']).targets, ['codex']);
  assert.deepEqual(parseArgs(['init', '--agent=claude', '--agent', 'codex']).targets, ['claude', 'codex']);
  assert.equal(parseArgs(['init']).targets, undefined);
  assert.match(parseArgs(['init', '--agent', 'vim']).error, /Unknown agent: vim/);
});

test('exit codes: usage error 2, bad directory 1, success 0', () => {
  assert.equal(harness(['frobnicate']).status, 2);
  assert.equal(harness(['init', '--dir', '/definitely/not/here']).status, 1);
  assert.equal(harness(['--help']).status, 0);

  const root = makeProject({ 'Cargo.toml': '[package]' });
  const result = harness(['init', '--dir', root, '--yes']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /unit checks\s+cargo test/);
  assert.match(read(root, 'AGENTS.md'), /\| unit checks \| `cargo test` \| Cargo\.toml present \|/);
});

test('a closed output pipe does not stop init writing', () => {
  const root = makeProject({});
  const result = spawnSync('/bin/sh', ['-c', `"${process.execPath}" "${bin}" init --yes --dir "${root}" | head -1`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /EPIPE/);
  assert.match(read(root, 'AGENTS.md'), /harness:end/);
  assert.match(read(root, '.codex/agents/verifier.toml'), /name = "verifier"/);
});

test('without a terminal and without --yes, init accepts and says so', () => {
  const root = makeProject({});
  const result = harness(['init', '--dir', root], { input: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stdin is not a terminal/);
});

test('the specifics check catches framework, service and command names', () => {
  assert.deepEqual(findSpecifics('Run the checks with `make test`.').map((h) => h.term), ['make']);
  assert.deepEqual(findSpecifics('Deploy to Vercel after the React build.').map((h) => h.term).sort(), ['react', 'vercel']);
  assert.deepEqual(findSpecifics('Make sure a rust-free, swift review happens; express intent.'), []);
});
