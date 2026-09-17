// Infers the project's main areas — how many parallel builders stage 3 gets —
// from workspace declarations, documented structure, then top-level layout.

import path from 'node:path';
import { readText, readDocument, readJson, isDir, listDirs, listDocuments, IGNORED_DIRS } from './fsutil.js';
import { WHOLE_REPO } from '../facts.js';

const MAX_AREAS = 12;
const CONVENTIONAL = [
  'apps', 'packages', 'services', 'libs', 'modules',
  'frontend', 'backend', 'web', 'api', 'server', 'client', 'mobile', 'ios', 'android',
  'cli', 'worker', 'workers', 'infra', 'infrastructure', 'pipelines',
];
const CONTAINERS = new Set(['apps', 'packages', 'services', 'libs', 'modules']);

export function scanAreas(root) {
  // A mixed-language repository declares workspaces per toolchain, so every
  // declaration counts, plus conventional folders none of them cover.
  const declared = [npmWorkspaces, pnpmWorkspaces, cargoWorkspace, goWork]
    .map((detect) => detect(root))
    .filter((found) => found && found.paths.length > 0);
  if (declared.length > 0) {
    const paths = declared.flatMap((found) => found.paths);
    const extra = conventionalLayout(root).paths.filter((p) => !paths.some((q) => q === p || q.startsWith(`${p}/`) || p.startsWith(`${q}/`)));
    const sources = declared.map((found) => found.source);
    if (extra.length > 0) sources.push('top-level layout');
    return { value: formatAreas([...paths, ...extra]), source: sources.join('; ') };
  }
  for (const detect of [documentedStructure, conventionalLayout]) {
    const found = detect(root);
    if (found && found.paths.length > 0) return { value: formatAreas(found.paths), source: found.source };
  }
  return { value: WHOLE_REPO, source: 'no workspaces, documented structure or conventional layout found' };
}

function formatAreas(paths) {
  const unique = [...new Set(paths)];
  const shown = unique.slice(0, MAX_AREAS).join(', ');
  return unique.length > MAX_AREAS ? `${shown}, +${unique.length - MAX_AREAS} more` : shown;
}

function expand(root, patterns) {
  const out = [];
  for (const raw of patterns) {
    if (typeof raw !== 'string' || raw.startsWith('!')) continue;
    const pattern = raw.replace(/^\.\//, '').replace(/\/+$/, '');
    const star = pattern.match(/^(.*?)\/\*\*?$/);
    if (star) {
      for (const dir of listDirs(root, star[1])) out.push(path.posix.join(star[1], dir));
    } else if (!pattern.includes('*') && isDir(root, pattern)) {
      out.push(pattern);
    }
  }
  return out;
}

function npmWorkspaces(root) {
  const ws = readJson(root, 'package.json')?.workspaces;
  const patterns = Array.isArray(ws) ? ws : ws?.packages;
  if (!Array.isArray(patterns)) return null;
  return { paths: expand(root, patterns), source: 'package.json → workspaces' };
}

function pnpmWorkspaces(root) {
  const text = readText(root, 'pnpm-workspace.yaml');
  if (!text) return null;
  const block = text.match(/^packages:\s*\n((?:\s+-.*\n?)+)/m);
  if (!block) return null;
  const patterns = [...block[1].matchAll(/-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((m) => m[1]);
  return { paths: expand(root, patterns), source: 'pnpm-workspace.yaml → packages' };
}

function cargoWorkspace(root) {
  const text = readText(root, 'Cargo.toml');
  const members = text?.match(/\[workspace\][\s\S]*?members\s*=\s*\[([\s\S]*?)\]/);
  if (!members) return null;
  const patterns = [...members[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  return { paths: expand(root, patterns), source: 'Cargo.toml → workspace.members' };
}

function goWork(root) {
  const text = readText(root, 'go.work');
  if (!text) return null;
  const block = text.match(/use\s*\(([\s\S]*?)\)/);
  const entries = block
    ? block[1].split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)
    : [...text.matchAll(/^use\s+(\S+)/gm)].map((m) => m[1]);
  const paths = expand(root, entries).filter((p) => p !== '.');
  return { paths, source: 'go.work → use' };
}

const STRUCTURE_HEADING = /^(#{1,6})\s+.*\b(structure|layout|architecture|directories|repository|repo|monorepo|organi[sz]ation|codebase)\b/i;

function documentedStructure(root) {
  for (const doc of listDocuments(root)) {
    const text = readDocument(root, doc);
    if (!text) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const heading = lines[i].match(STRUCTURE_HEADING);
      if (!heading) continue;
      const level = heading[1].length;
      const paths = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].match(/^(#{1,6})\s/);
        if (next && next[1].length <= level) break;
        paths.push(...directoriesOnLine(root, lines[j]));
      }
      const areas = [...new Set(paths)].filter((p) => !CONTAINERS.has(p) || !paths.some((q) => q.startsWith(`${p}/`)));
      if (areas.length > 0) return { paths: areas, source: `${doc}:${i + 1}` };
    }
  }
  return null;
}

function directoriesOnLine(root, line) {
  const tokens = [
    ...[...line.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]),
    ...[...line.matchAll(/(?:[├└|`]\s*[─-]{2}\s*|^\s*[-*]\s+\**)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)\/?/g)].map((m) => m[1]),
  ];
  return tokens
    .map((t) => t.replace(/^\.\//, '').replace(/\/+$/, ''))
    .filter((t) => t && !t.startsWith('.') && t.split('/').length <= 2)
    .filter((t) => !IGNORED_DIRS.has(t.split('/')[0]) && isDir(root, t));
}

function conventionalLayout(root) {
  const present = listDirs(root).filter((d) => CONVENTIONAL.includes(d));
  const paths = [];
  for (const dir of present) {
    const children = CONTAINERS.has(dir) ? listDirs(root, dir) : [];
    if (children.length > 0) paths.push(...children.map((c) => `${dir}/${c}`));
    else paths.push(dir);
  }
  return { paths, source: 'top-level layout' };
}
