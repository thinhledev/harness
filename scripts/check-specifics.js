#!/usr/bin/env node
// Release check: no skill or agent may name a framework, a service or a
// command. Anything that specific belongs in the project's own AGENTS.md.
// Exits 1 and lists every hit.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Case-insensitive, whole-word. Ambiguous English words ("express", "make",
// "rest", "next") are matched only in forms that cannot be ordinary prose.
export const DENYLIST = [
  // interface frameworks and tooling
  'react', 'react native', 'vue', 'nuxt', 'angular', 'svelte', 'sveltekit', 'next\\.js', 'nextjs', 'remix', 'astro',
  'solidjs', 'qwik', 'tailwind', 'bootstrap', 'material ui', 'mui', 'chakra', 'shadcn', 'storybook', 'figma',
  'flutter', 'swiftui', 'jetpack compose', 'expo', 'electron', 'tauri', 'vite', 'webpack', 'esbuild', 'rollup',
  // server frameworks and runtimes
  'express\\.js', 'expressjs', 'fastify', 'nestjs', 'koa', 'hono', 'django', 'flask', 'fastapi', 'rails',
  'laravel', 'symfony', 'spring boot', 'phoenix', 'gin', 'actix', 'axum', 'asp\\.net', 'node\\.js', 'nodejs',
  'deno', 'bun',
  // data and messaging
  'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'dynamodb', 'firestore', 'kafka', 'rabbitmq',
  'prisma', 'drizzle', 'sequelize', 'typeorm', 'sqlalchemy', 'graphql', 'grpc', 'trpc', 'openapi', 'swagger',
  // services and platforms
  'aws', 'gcp', 'azure', 'vercel', 'netlify', 'heroku', 'cloudflare', 'supabase', 'firebase', 'stripe',
  'github', 'gitlab', 'bitbucket', 'circleci', 'jenkins', 'docker', 'kubernetes', 'k8s', 'terraform', 'pulumi',
  'sentry', 'datadog', 'slack', 'jira', 'linear',
  // languages' toolchains and test runners
  'npm', 'npx', 'pnpm', 'yarn', 'pip', 'poetry', 'cargo', 'gradle', 'maven', 'mvn', 'dotnet', 'composer',
  'jest', 'vitest', 'mocha', 'pytest', 'rspec', 'junit', 'playwright', 'cypress', 'selenium', 'puppeteer',
  'eslint', 'prettier', 'ruff', 'tsc', 'typescript', 'python', 'golang', 'rust', 'java', 'kotlin', 'swift',
  // commands
  'git', 'make', 'curl', 'rm -rf', 'sudo', 'chmod',
];

// "make" and "swift" are ordinary words; only flag them as commands.
const COMMAND_ONLY = new Set(['make', 'swift', 'rust', 'linear', 'slack', 'expo', 'remix', 'gin', 'koa', 'phoenix', 'bootstrap', 'composer', 'poetry', 'pip']);

export function findSpecifics(text) {
  const hits = [];
  const lines = text.split('\n');
  for (const term of DENYLIST) {
    const pattern = COMMAND_ONLY.has(term)
      ? new RegExp(`\`${term}(\\s[^\`]*)?\``, 'i')
      : new RegExp(`(^|[^\\w-])${term}([^\\w-]|$)`, 'i');
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push({ term: term.replace(/\\/g, ''), line: i + 1, text: line.trim() });
    });
  }
  return hits.sort((a, b) => a.line - b.line);
}

function processFiles() {
  const files = [];
  for (const dir of ['skills', 'agents']) {
    const walk = (rel) => {
      for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        const child = path.posix.join(rel, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (entry.name.endsWith('.md')) files.push(child);
      }
    };
    walk(dir);
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let total = 0;
  for (const file of processFiles()) {
    for (const hit of findSpecifics(fs.readFileSync(path.join(root, file), 'utf8'))) {
      total++;
      process.stdout.write(`${file}:${hit.line}  "${hit.term}"  ${hit.text}\n`);
    }
  }
  if (total > 0) {
    process.stdout.write(`\n${total} project-specific term(s) in skills or agents. Generalise them or move them to the project's AGENTS.md.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('check-specifics: skills and agents name no framework, service or command.\n');
  }
}
