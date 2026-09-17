// The floor every project starts with. These are never wrong, so they are
// not asked; init only asks what to add for the specific project.

export const DEFAULT_GUARDRAILS = [
  'Never print, log or commit secrets, credentials, tokens or environment values.',
  'Never commit or push without being asked.',
  'Never run a destructive or irreversible command.',
  'Never modify generated or vendored files.',
  'Never weaken a test to make it pass.',
];
