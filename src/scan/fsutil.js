// Read-only helpers for the init scan. Everything here reads documents,
// manifests and directory names — never walks into source trees.

import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 512 * 1024;

export const IGNORED_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'target', 'out', 'coverage',
  '__pycache__', 'venv', '.venv', 'bin', 'obj', 'tmp', 'log', 'logs',
]);

export function readText(root, rel) {
  try {
    const file = path.join(root, rel);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** A document's text without the Harness section init writes, so the scan never reads its own output. */
export function readDocument(root, rel) {
  const text = readText(root, rel);
  return text && text.replace(/<!-- harness:begin -->[\s\S]*?<!-- harness:end -->/g, '');
}

export function readJson(root, rel) {
  const text = readText(root, rel);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Tolerate comments and trailing commas (jsonc-style manifests).
    try {
      const stripped = text
        .replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str ?? '')
        .replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

export function isFile(root, rel) {
  try {
    return fs.statSync(path.join(root, rel)).isFile();
  } catch {
    return false;
  }
}

export function isDir(root, rel) {
  try {
    return fs.statSync(path.join(root, rel)).isDirectory();
  } catch {
    return false;
  }
}

/** Visible, non-ignored subdirectory names of `rel`, sorted. */
export function listDirs(root, rel = '.') {
  try {
    return fs.readdirSync(path.join(root, rel), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !IGNORED_DIRS.has(d.name))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/** File names directly inside `rel` matching `pattern`, sorted. */
export function listFiles(root, rel, pattern) {
  try {
    return fs.readdirSync(path.join(root, rel), { withFileTypes: true })
      .filter((d) => d.isFile() && pattern.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * The project's documents: readmes and notes at the root, plus markdown under
 * docs/ (bounded depth and count). Returns repo-relative paths.
 */
export function listDocuments(root, { maxDocs = 80, maxDepth = 3 } = {}) {
  const docs = listFiles(root, '.', /\.(md|mdx|markdown|rst|txt)$/i)
    .filter((name) => !/^(license|licence|changelog|code_of_conduct)/i.test(name));
  for (const dir of ['docs', 'doc', 'documentation', 'design', 'plans']) {
    if (isDir(root, dir)) walkDocs(root, dir, 1, maxDepth, docs);
  }
  return docs.slice(0, maxDocs);
}

// Stage records written by the loop itself are not project documents.
const SKIP_DOC_DIRS = new Set(['docs/harness']);

function walkDocs(root, rel, depth, maxDepth, out) {
  if (SKIP_DOC_DIRS.has(rel)) return;
  for (const name of listFiles(root, rel, /\.(md|mdx|markdown)$/i)) out.push(path.posix.join(rel, name));
  if (depth >= maxDepth) return;
  for (const dir of listDirs(root, rel)) walkDocs(root, path.posix.join(rel, dir), depth + 1, maxDepth, out);
}

export function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}
