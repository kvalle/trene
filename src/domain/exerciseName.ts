import Graphemer from 'graphemer';

export const EXERCISE_NAME_REQUIRED = 'Skriv inn et navn';
export const EXERCISE_NAME_TOO_LONG = 'Navnet kan ikke være lengre enn 100 tegn';

const graphemer = new Graphemer();

export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ').normalize('NFC');
}

export function exerciseNameKey(name: string): string {
  return normalizeExerciseName(name).toLocaleLowerCase('nb-NO');
}

export function validateExerciseName(name: string):
  | { name: string; key: string }
  | { error: string } {
  const normalized = normalizeExerciseName(name);
  const graphemes = graphemer.countGraphemes(normalized);

  if (graphemes === 0) return { error: EXERCISE_NAME_REQUIRED };
  if (graphemes > 100) return { error: EXERCISE_NAME_TOO_LONG };
  return { name: normalized, key: exerciseNameKey(normalized) };
}
