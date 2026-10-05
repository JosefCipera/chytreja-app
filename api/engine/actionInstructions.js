// Reviewed catalog wording, applied before engine selection. No exercise dose or metadata changes.
import { readFileSync } from 'node:fs';
const instructions = JSON.parse(readFileSync(new URL('../../data/engine/action-instructions.json', import.meta.url), 'utf8'));

export function applyActionInstructions(rows) {
  return rows.map(row => {
    const copy = instructions[row.id];
    // Fail closed if the DB action's dose, protocol or original instruction has changed.
    if (!copy || row.protocol_type !== copy.protocol_type || row.reps !== copy.reps
        || row.label !== copy.source_label) return row;
    return { ...row, label: copy.label };
  });
}
