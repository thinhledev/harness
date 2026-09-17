import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { init } from './init.js';
import { parseTargets } from './emit/index.js';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));

const USAGE = `Usage: harness init [options]

Installs the Harness loop into a project: five stage skills, five agents,
and the project's facts in AGENTS.md, for Claude Code and Codex.

Options:
  --dir <path>   project to set up (default: current directory)
  --agent <id>   claude, codex or all (default: whichever the project already
                 uses; both when it shows neither or both)
  -y, --yes      accept what was worked out and ask nothing
  --force        replace agent and skill files that harness did not write
  --dry-run      show what would be written; change nothing
  -h, --help     show this help
  -v, --version  show the version
`;

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    process.stderr.write(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  const root = path.resolve(args.dir ?? process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    process.stderr.write(`Not a directory: ${root}\n`);
    return 1;
  }

  // A closed pipe (`harness init | head`) must not stop the files being written.
  process.stdout.on('error', (error) => {
    if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') throw error;
  });

  const interactive = !args.yes && process.stdin.isTTY === true;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const io = {
    print: (line) => process.stdout.write(`${line}\n`),
    ask: (question) => new Promise((resolve) => rl.question(question, resolve)),
  };
  try {
    if (!args.yes && !interactive) io.print('(stdin is not a terminal: accepting what was worked out, as with --yes)\n');
    await init({ root, pkgRoot, version, interactive, targets: args.targets, force: args.force, dryRun: args.dryRun, io });
    return 0;
  } finally {
    rl?.close();
  }
}

export function parseArgs(argv) {
  const args = { yes: false, force: false, dryRun: false };
  const rest = [...argv];
  const agents = [];
  let command = null;
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '-v' || arg === '--version') args.version = true;
    else if (arg === '-y' || arg === '--yes') args.yes = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--dir') {
      args.dir = rest.shift();
      if (!args.dir) return { error: '--dir needs a path' };
    } else if (arg.startsWith('--dir=')) args.dir = arg.slice('--dir='.length);
    else if (arg === '--agent') {
      const value = rest.shift();
      if (!value) return { error: '--agent needs claude, codex or all' };
      agents.push(value);
    } else if (arg.startsWith('--agent=')) agents.push(arg.slice('--agent='.length));
    else if (arg.startsWith('-')) return { error: `Unknown option: ${arg}` };
    else if (command == null) command = arg;
    else return { error: `Unexpected argument: ${arg}` };
  }
  if (args.help || args.version) return args;
  if (command !== 'init') return { error: command ? `Unknown command: ${command}` : 'Missing command' };
  if (agents.length > 0) {
    const parsed = parseTargets(agents);
    if (parsed.error) return { error: parsed.error };
    args.targets = parsed.targets;
  }
  return args;
}
