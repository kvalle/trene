import {
  EXERCISE_NAME_REQUIRED,
  EXERCISE_NAME_TOO_LONG,
  normalizeExerciseName,
  validateExerciseName,
} from '../exerciseName';

describe('exercise names', () => {
  test('trims, collapses whitespace, and normalizes to NFC', () => {
    expect(normalizeExerciseName('  Benk\t\npress  ')).toBe('Benk press');
    expect(normalizeExerciseName('Ta\u030ahev')).toBe('Tåhev');
  });

  test('validates boundaries by grapheme cluster rather than code point', () => {
    expect(validateExerciseName('')).toEqual({ error: EXERCISE_NAME_REQUIRED });
    expect(validateExerciseName('🏋️'.repeat(100))).toMatchObject({ name: '🏋️'.repeat(100) });
    expect(validateExerciseName('🏋️'.repeat(101))).toEqual({ error: EXERCISE_NAME_TOO_LONG });
  });
});
