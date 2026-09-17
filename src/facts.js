// The four inputs init works out, plus where stage records go.

export const UNKNOWN = 'unknown';
export const NOT_ESTABLISHED = 'not yet established';
export const NOT_APPLICABLE = 'not applicable';
export const NONE = 'none';
export const WHOLE_REPO = 'whole repository';

export const FACTS = [
  { key: 'unit', label: 'unit checks', command: true },
  { key: 'e2e', label: 'end-to-end checks', command: true },
  { key: 'design', label: 'design system' },
  { key: 'areas', label: 'areas' },
  { key: 'records', label: 'work records' },
];

export const DEFAULT_RECORDS = 'docs/harness/';

/** Values that mean "nothing settled yet" — a later scan may fill them in. */
export function isOpen(value) {
  return [UNKNOWN, NOT_ESTABLISHED, NONE, WHOLE_REPO, ''].includes(String(value ?? '').trim());
}

/** Shorthands accepted when a person corrects a fact. */
export function normalizeValue(value) {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (['n/a', 'na', 'not applicable'].includes(lower)) return NOT_APPLICABLE;
  if (['?', 'unknown'].includes(lower)) return UNKNOWN;
  if (lower === 'not yet established') return NOT_ESTABLISHED;
  if (lower === 'none') return NONE;
  return v;
}
