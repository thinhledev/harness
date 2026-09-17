import { scanChecks } from './checks.js';
import { scanDesign } from './design.js';
import { scanAreas } from './areas.js';
import { DEFAULT_RECORDS } from '../facts.js';

/** Works out every fact from the project's own files. Read-only. */
export function scanProject(root) {
  const { unit, e2e } = scanChecks(root);
  return {
    unit,
    e2e,
    design: scanDesign(root),
    areas: scanAreas(root),
    records: { value: DEFAULT_RECORDS, source: 'default' },
  };
}
