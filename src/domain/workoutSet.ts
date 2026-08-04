export const LOAD_ERROR = 'Skriv inn en belastning fra 0 til 999,9 med maks én desimal';
export const REPETITIONS_ERROR = 'Skriv inn et helt antall repetisjoner fra 1 til 999';

type ParseResult = { value: number } | { error: string };

export function parseLoad(input: string): ParseResult {
  if (!/^(?:\d{1,3})(?:[,.]\d)?$/.test(input)) return { error: LOAD_ERROR };
  const value = Number(input.replace(',', '.'));
  return value <= 999.9 ? { value } : { error: LOAD_ERROR };
}

export function parseRepetitions(input: string): ParseResult {
  if (!/^\d{1,3}$/.test(input)) return { error: REPETITIONS_ERROR };
  const value = Number(input);
  return value >= 1 ? { value } : { error: REPETITIONS_ERROR };
}

export function validateWorkoutSet(loadInput: string, repetitionsInput: string):
  | { loadKg: number; repetitions: number }
  | { loadError?: string; repetitionsError?: string } {
  const load = parseLoad(loadInput);
  const repetitions = parseRepetitions(repetitionsInput);
  if ('value' in load && 'value' in repetitions) {
    return { loadKg: load.value, repetitions: repetitions.value };
  }
  return {
    ...('error' in load && { loadError: load.error }),
    ...('error' in repetitions && { repetitionsError: repetitions.error }),
  };
}
