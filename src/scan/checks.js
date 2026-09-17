// Finds the commands that run the unit and end-to-end check tiers, from
// manifests and pipeline files. First match per tier wins.

import path from 'node:path';
import { readText, readJson, isFile, listFiles, lineNumberAt } from './fsutil.js';
import { NOT_ESTABLISHED } from '../facts.js';

const E2E_WORDS = /\b(e2e|end-to-end|playwright|cypress|integration|acceptance|smoke)\b/i;

export function scanChecks(root) {
  let unit = null;
  let e2e = null;
  // Umbrella runners first: in a mixed project they are what people actually run.
  for (const detect of [makefile, justfile, packageScripts, denoTasks, composerScripts, python, singleCommandManifests, pipelines]) {
    const found = detect(root);
    unit ??= found.unit ?? null;
    e2e ??= found.e2e ?? null;
    if (unit && e2e) break;
  }
  return {
    unit: unit ?? { value: NOT_ESTABLISHED, source: 'no test command found in manifests or pipeline files' },
    e2e: e2e ?? { value: NOT_ESTABLISHED, source: 'no end-to-end command found in manifests or pipeline files' },
  };
}

function packageScripts(root) {
  const pkg = readJson(root, 'package.json');
  const scripts = pkg?.scripts;
  if (!scripts || typeof scripts !== 'object') return {};
  const pm = packageManager(root, pkg);
  const run = (name) => (name === 'test' && pm !== 'bun' ? `${pm} test` : `${pm} run ${name}`);
  const usable = (name) => typeof scripts[name] === 'string' && !/no test specified/.test(scripts[name]);
  const found = (name) => ({ value: run(name), source: `package.json → scripts.${name}` });

  const unitName = ['test:unit', 'unit', 'test'].find(usable);
  const e2eName = ['test:e2e', 'e2e', 'test:integration', 'integration'].find(usable)
    ?? Object.keys(scripts).find((k) => usable(k) && /(^|:)(e2e|integration|acceptance)(:|$)/.test(k));
  return {
    unit: unitName && !E2E_WORDS.test(scripts[unitName] ?? '') ? found(unitName) : undefined,
    e2e: e2eName ? found(e2eName) : undefined,
  };
}

function packageManager(root, pkg) {
  const declared = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(declared)) return declared;
  if (isFile(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (isFile(root, 'yarn.lock')) return 'yarn';
  if (isFile(root, 'bun.lockb') || isFile(root, 'bun.lock')) return 'bun';
  return 'npm';
}

function targetsIn(text, pattern) {
  const targets = new Map();
  for (const m of text.matchAll(pattern)) {
    if (!targets.has(m[1])) targets.set(m[1], lineNumberAt(text, m.index));
  }
  return targets;
}

function fromTargets(file, runner, targets) {
  const pick = (names) => names.find((n) => targets.has(n));
  const unit = pick(['test-unit', 'unit-test', 'unit', 'test']);
  const e2e = pick(['test-e2e', 'e2e', 'e2e-test', 'test-integration', 'integration', 'acceptance'])
    ?? [...targets.keys()].find((n) => /(^|[-_:])(e2e|integration|acceptance)([-_:]|$)/.test(n));
  const found = (n) => ({ value: `${runner} ${n}`, source: `${file}:${targets.get(n)}` });
  return { unit: unit && found(unit), e2e: e2e && found(e2e) };
}

function makefile(root) {
  for (const file of ['Makefile', 'makefile', 'GNUmakefile']) {
    const text = readText(root, file);
    if (text) return fromTargets(file, 'make', targetsIn(text, /^([A-Za-z0-9_.-]+)\s*:(?![=:])/gm));
  }
  return {};
}

function justfile(root) {
  for (const file of ['justfile', 'Justfile', '.justfile']) {
    const text = readText(root, file);
    if (text) return fromTargets(file, 'just', targetsIn(text, /^@?([A-Za-z0-9_-]+)[^:=\n]*:(?!=)/gm));
  }
  return {};
}

function denoTasks(root) {
  for (const file of ['deno.json', 'deno.jsonc']) {
    const config = readJson(root, file);
    if (!config) continue;
    const tasks = config.tasks ?? {};
    const e2eName = Object.keys(tasks).find((k) => /(^|:)(e2e|integration)(:|$)/.test(k));
    return {
      unit: tasks.test
        ? { value: 'deno task test', source: `${file} → tasks.test` }
        : { value: 'deno test', source: `${file} present` },
      e2e: e2eName && { value: `deno task ${e2eName}`, source: `${file} → tasks.${e2eName}` },
    };
  }
  return {};
}

function composerScripts(root) {
  const scripts = readJson(root, 'composer.json')?.scripts;
  if (!scripts) return {};
  return {
    unit: scripts.test && { value: 'composer test', source: 'composer.json → scripts.test' },
  };
}

function python(root) {
  const pyproject = readText(root, 'pyproject.toml') ?? '';
  const signals = [
    ['pytest.ini', () => isFile(root, 'pytest.ini')],
    ['pyproject.toml', () => /\[tool\.pytest|\bpytest\b/.test(pyproject)],
    ['setup.cfg', () => /\[tool:pytest\]/.test(readText(root, 'setup.cfg') ?? '')],
    ['tox.ini', () => /\[pytest\]/.test(readText(root, 'tox.ini') ?? '')],
    ['requirements-dev.txt', () => /^pytest\b/m.test(readText(root, 'requirements-dev.txt') ?? '')],
  ];
  const hit = signals.find(([, test]) => test());
  if (!hit) return {};
  let runner = 'pytest';
  if (isFile(root, 'uv.lock')) runner = 'uv run pytest';
  else if (isFile(root, 'poetry.lock')) runner = 'poetry run pytest';
  else if (isFile(root, 'pdm.lock')) runner = 'pdm run pytest';
  return { unit: { value: runner, source: `${hit[0]} (pytest configured)` } };
}

function singleCommandManifests(root) {
  const rubyTests = /\brspec\b/.test(readText(root, 'Gemfile') ?? '');
  const pubspec = readText(root, 'pubspec.yaml');
  const candidates = [
    ['Cargo.toml', 'cargo test'],
    ['go.mod', 'go test ./...'],
    ['mix.exs', 'mix test'],
    ['Package.swift', 'swift test'],
    ['build.gradle.kts', isFile(root, 'gradlew') ? './gradlew test' : 'gradle test'],
    ['build.gradle', isFile(root, 'gradlew') ? './gradlew test' : 'gradle test'],
    ['pom.xml', isFile(root, 'mvnw') ? './mvnw test' : 'mvn test'],
    ['Gemfile', rubyTests ? 'bundle exec rspec' : null],
    ['pubspec.yaml', pubspec == null ? null : /\bflutter\s*:/.test(pubspec) ? 'flutter test' : 'dart test'],
  ];
  for (const [file, command] of candidates) {
    if (command && isFile(root, file)) return { unit: { value: command, source: `${file} present` } };
  }
  const dotnet = listFiles(root, '.', /\.(sln|csproj|fsproj)$/i)[0];
  if (dotnet) return { unit: { value: 'dotnet test', source: `${dotnet} present` } };
  return {};
}

const PIPELINE_FILES = [
  '.gitlab-ci.yml', '.circleci/config.yml', 'bitbucket-pipelines.yml',
  'azure-pipelines.yml', '.buildkite/pipeline.yml',
];

function pipelines(root) {
  const files = [
    ...listFiles(root, '.github/workflows', /\.ya?ml$/i).map((f) => path.posix.join('.github/workflows', f)),
    ...PIPELINE_FILES.filter((f) => isFile(root, f)),
  ];
  let unit;
  let e2e;
  for (const file of files) {
    const text = readText(root, file);
    if (!text) continue;
    text.split('\n').forEach((line, i) => {
      const command = pipelineCommand(line);
      if (!command || /\binstall\b/i.test(command)) return;
      const found = { value: command, source: `${file}:${i + 1}` };
      if (E2E_WORDS.test(command)) e2e ??= found;
      else if (/\btest\b/i.test(command)) unit ??= found;
    });
  }
  return { unit, e2e };
}

function pipelineCommand(line) {
  const m = line.match(/^\s*(?:-\s+)?(?:run|script|command):\s*(.+)$/) ?? line.match(/^\s*-\s+(.+)$/);
  if (!m) return null;
  let command = m[1].trim();
  if (/^[|>][-+]?$/.test(command)) return null;
  if (/^[\w.-]+:(\s|$)/.test(command)) return null; // a mapping key, not a command
  command = command.replace(/^(["'])(.*)\1$/, '$2').trim();
  return command || null;
}
