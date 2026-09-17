import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject } from './helpers.js';
import { scanChecks } from '../src/scan/checks.js';
import { scanDesign } from '../src/scan/design.js';
import { scanAreas } from '../src/scan/areas.js';

test('checks: package scripts with the lockfile\'s package manager', () => {
  const root = makeProject({
    'package.json': { scripts: { test: 'vitest run', 'test:e2e': 'playwright test' } },
    'pnpm-lock.yaml': '',
  });
  const { unit, e2e } = scanChecks(root);
  assert.deepEqual(unit, { value: 'pnpm test', source: 'package.json → scripts.test' });
  assert.deepEqual(e2e, { value: 'pnpm run test:e2e', source: 'package.json → scripts.test:e2e' });
});

test('checks: the default placeholder test script is not a check', () => {
  const root = makeProject({ 'package.json': { scripts: { test: 'echo "Error: no test specified" && exit 1' } } });
  assert.equal(scanChecks(root).unit.value, 'not yet established');
});

test('checks: bun runs scripts through run, not its own runner', () => {
  const root = makeProject({ 'package.json': { scripts: { test: 'x' } }, 'bun.lock': '' });
  assert.equal(scanChecks(root).unit.value, 'bun run test');
});

test('checks: make targets carry file and line', () => {
  const root = makeProject({ Makefile: 'VAR := 1\n\nbuild:\n\techo\n\ntest:\n\techo\n\ne2e: build\n\techo\n' });
  const { unit, e2e } = scanChecks(root);
  assert.deepEqual(unit, { value: 'make test', source: 'Makefile:6' });
  assert.deepEqual(e2e, { value: 'make e2e', source: 'Makefile:9' });
});

test('checks: an umbrella runner wins over one toolchain, prefixed e2e targets count', () => {
  const root = makeProject({
    Makefile: '.PHONY: test\ntest: ## all\n\techo\nweb-e2e:\n\techo\n',
    'package.json': { scripts: { test: 'vitest' } },
  });
  const { unit, e2e } = scanChecks(root);
  assert.deepEqual(unit, { value: 'make test', source: 'Makefile:2' });
  assert.deepEqual(e2e, { value: 'make web-e2e', source: 'Makefile:4' });
});

test('checks: pytest through the project\'s environment manager', () => {
  const root = makeProject({ 'pyproject.toml': '[tool.pytest.ini_options]\n', 'uv.lock': '' });
  assert.deepEqual(scanChecks(root).unit, { value: 'uv run pytest', source: 'pyproject.toml (pytest configured)' });
});

test('checks: single-command manifests', () => {
  assert.equal(scanChecks(makeProject({ 'go.mod': 'module x' })).unit.value, 'go test ./...');
  assert.equal(scanChecks(makeProject({ 'Cargo.toml': '[package]' })).unit.value, 'cargo test');
  assert.equal(scanChecks(makeProject({ 'pom.xml': '<project/>', mvnw: '' })).unit.value, './mvnw test');
});

test('checks: end-to-end tier found in a pipeline file, installs ignored', () => {
  const root = makeProject({
    'go.mod': 'module x',
    '.github/workflows/ci.yml': [
      'jobs:',
      '  e2e:',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - run: npx playwright install --with-deps',
      '      - name: End to end',
      '        run: ./scripts/e2e.sh --headless',
    ].join('\n'),
  });
  const { unit, e2e } = scanChecks(root);
  assert.equal(unit.value, 'go test ./...');
  assert.deepEqual(e2e, { value: './scripts/e2e.sh --headless', source: '.github/workflows/ci.yml:7' });
});

test('checks: nothing found is not yet established, never guessed', () => {
  const { unit, e2e } = scanChecks(makeProject({ 'README.md': '# hi' }));
  assert.equal(unit.value, 'not yet established');
  assert.equal(e2e.value, 'not yet established');
});

test('design: a dedicated design document wins', () => {
  const root = makeProject({ 'DESIGN.md': '# Design', 'README.md': 'See the design system in `ui/`' });
  assert.deepEqual(scanDesign(root), { value: 'DESIGN.md', source: 'DESIGN.md present' });
});

test('design: a path the documents point at', () => {
  const root = makeProject({
    'README.md': '# App\n\nIntro.\n\nOur design system lives in [the kit](packages/ui/README.md).\n',
    'packages/ui/README.md': '# UI',
  });
  assert.deepEqual(scanDesign(root), { value: 'packages/ui/README.md', source: 'README.md:5' });
});

test('design: a pointer that does not exist falls back to the mention', () => {
  const root = makeProject({ 'docs/notes.md': 'We follow the company design system (`missing/dir`).' });
  const design = scanDesign(root);
  assert.equal(design.source, 'docs/notes.md:1');
  assert.match(design.value, /^mentioned: "We follow the company design system/);
});

test('design: token file, then none', () => {
  assert.deepEqual(scanDesign(makeProject({ 'src/styles/tokens.css': ':root{}' })), {
    value: 'src/styles/tokens.css', source: 'token file present',
  });
  assert.deepEqual(scanDesign(makeProject({ 'design/Foundations.html': '<p>' })), { value: 'design/', source: 'design directory present' });
  assert.equal(scanDesign(makeProject({ 'README.md': '# CLI tool', 'design/': '' })).value, 'none');
});

test('areas: npm workspaces expand globs', () => {
  const root = makeProject({ 'package.json': { workspaces: ['apps/*', 'tools'] }, 'apps/web/': '', 'apps/api/': '', 'tools/': '' });
  assert.deepEqual(scanAreas(root), { value: 'apps/api, apps/web, tools', source: 'package.json → workspaces' });
});

test('areas: pnpm, cargo and go workspaces', () => {
  const pnpm = makeProject({ 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n", 'packages/core/': '' });
  assert.equal(scanAreas(pnpm).value, 'packages/core');
  const cargo = makeProject({ 'Cargo.toml': '[workspace]\nmembers = [\n  "crates/a",\n  "crates/b",\n]\n', 'crates/a/': '', 'crates/b/': '' });
  assert.equal(scanAreas(cargo).value, 'crates/a, crates/b');
  const go = makeProject({ 'go.work': 'go 1.22\n\nuse (\n\t./svc\n\t./lib // shared\n)\n', 'svc/': '', 'lib/': '' });
  assert.equal(scanAreas(go).value, 'svc, lib');
});

test('areas: declarations from every toolchain plus uncovered conventional folders', () => {
  const root = makeProject({
    'pnpm-workspace.yaml': 'packages:\n  - web\n  - infra\n',
    'web/': '', 'infra/': '', 'services/api/': '', 'services/billing/': '', 'services/__pycache__/': '',
  });
  assert.deepEqual(scanAreas(root), {
    value: 'web, infra, services/api, services/billing',
    source: 'pnpm-workspace.yaml → packages; top-level layout',
  });
});

test('areas: documented structure section', () => {
  const root = makeProject({
    'README.md': '# Thing\n\n## Project structure\n\n```\n├── engine/\n└── console/\n```\n\n## License\n\n`legal/`\n',
    'engine/': '', 'console/': '', 'legal/': '',
  });
  assert.deepEqual(scanAreas(root), { value: 'engine, console', source: 'README.md:3' });
});

test('areas: conventional layout, then a single area', () => {
  assert.equal(scanAreas(makeProject({ 'frontend/': '', 'backend/': '', 'node_modules/x/': '' })).value, 'backend, frontend');
  assert.equal(scanAreas(makeProject({ 'src/': '' })).value, 'whole repository');
});
