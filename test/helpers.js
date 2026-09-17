import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Creates a throwaway project from a { 'relative/path': 'content' } map. Directories end with '/'. */
export function makeProject(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    if (rel.endsWith('/')) {
      fs.mkdirSync(file, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

export function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** An io double: records printed lines, answers questions from a script. */
export function scriptedIo(answers = []) {
  const queue = [...answers];
  const lines = [];
  return {
    lines,
    print: (line) => lines.push(line),
    ask: async () => (queue.length > 0 ? queue.shift() : ''),
  };
}

export const pkgRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
