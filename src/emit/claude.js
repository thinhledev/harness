// Claude Code emitter: skills become .claude/skills/<name>/SKILL.md (auto-
// triggered by description), agents become .claude/agents/<name>.md.

import { readSkills, readAgents, stampMarkdown } from './source.js';

export function planClaudeFiles(pkgRoot, version) {
  return [
    ...readSkills(pkgRoot).map((skill) => ({
      dest: `.claude/skills/${skill.name}/SKILL.md`,
      content: stampMarkdown(skill.raw, skill.from, version),
    })),
    ...readAgents(pkgRoot).map((agent) => ({
      dest: `.claude/agents/${agent.name}.md`,
      content: stampMarkdown(agent.raw, agent.from, version),
    })),
  ];
}
