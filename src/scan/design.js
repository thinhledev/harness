// Infers the design system from the project's own documents and any token or
// style file they point at.

import path from 'node:path';
import { readDocument, isFile, isDir, listFiles, listDocuments } from './fsutil.js';
import { NONE } from '../facts.js';

const DESIGN_DOCS = [
  'DESIGN.md', 'design.md', 'DESIGN_SYSTEM.md', 'design-system.md',
  'docs/DESIGN.md', 'docs/design.md', 'docs/design-system.md', 'design/README.md',
];
const MENTION = /design[ -]system|design tokens|style ?guide|component library|brand guidelines/i;
const TOKEN_DIRS = ['.', 'design', 'tokens', 'styles', 'theme', 'src/styles', 'src/theme', 'src/design'];
const TOKEN_FILE = /(^|[-_.])(design[-_]?)?tokens?\.(json|ya?ml|css|scss|less|ts|js)$/i;

export function scanDesign(root) {
  const dedicated = DESIGN_DOCS.find((f) => isFile(root, f));
  if (dedicated) return { value: dedicated, source: `${dedicated} present` };

  let firstMention = null;
  for (const doc of listDocuments(root)) {
    const text = readDocument(root, doc);
    if (!text) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!MENTION.test(lines[i])) continue;
      const target = referencedPath(root, doc, lines[i]);
      if (target) return { value: target, source: `${doc}:${i + 1}` };
      firstMention ??= { value: excerpt(lines[i]), source: `${doc}:${i + 1}` };
    }
  }

  for (const dir of TOKEN_DIRS) {
    const token = listFiles(root, dir, TOKEN_FILE)[0];
    if (token) {
      const rel = path.posix.join(dir, token).replace(/^\.\//, '');
      return { value: rel, source: 'token file present' };
    }
  }

  for (const dir of ['design', 'docs/design']) {
    if (isDir(root, dir) && listFiles(root, dir, /./).length > 0) return { value: `${dir}/`, source: 'design directory present' };
  }

  return firstMention ?? { value: NONE, source: 'no design document, mention or token file found' };
}

/** A link or code-quoted path on the line that exists in the project. */
function referencedPath(root, doc, line) {
  const candidates = [
    ...[...line.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]),
    ...[...line.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]),
  ].filter((c) => !/^[a-z]+:/i.test(c));
  for (const candidate of candidates) {
    for (const base of [path.posix.dirname(doc), '.']) {
      const rel = path.posix.normalize(path.posix.join(base, candidate)).replace(/\/$/, '');
      if (!rel.startsWith('..') && (isFile(root, rel) || isDir(root, rel))) return rel;
    }
  }
  return null;
}

function excerpt(line) {
  const clean = line.replace(/^[\s#>*-]+/, '').replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? `mentioned: "${clean.slice(0, 77)}..."` : `mentioned: "${clean}"`;
}
