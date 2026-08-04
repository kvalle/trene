import { parseLoad, parseRepetitions, validateWorkoutSet } from '../workoutSet';

describe('workout set input', () => {
  test.each([
    ['0', 0], ['0,1', 0.1], ['12.5', 12.5], ['999,9', 999.9],
  ])('accepts load %s', (input, expected) => {
    expect(parseLoad(input)).toEqual({ value: expected });
  });

  test.each(['', '-1', '1,23', '1000', '1e2', ' 12 '])('rejects load %s', (input) => {
    expect(parseLoad(input)).toHaveProperty('error');
  });

  test.each([['1', 1], ['999', 999]])('accepts repetitions %s', (input, expected) => {
    expect(parseRepetitions(input)).toEqual({ value: expected });
  });

  test.each(['', '0', '1.5', '1000', '+2', ' 2 '])('rejects repetitions %s', (input) => {
    expect(parseRepetitions(input)).toHaveProperty('error');
  });

  test('returns both field errors without discarding either input', () => {
    expect(validateWorkoutSet('1000', '0')).toEqual({
      loadError: 'Skriv inn en belastning fra 0 til 999,9 med maks én desimal',
      repetitionsError: 'Skriv inn et helt antall repetisjoner fra 1 til 999',
    });
  });
});
