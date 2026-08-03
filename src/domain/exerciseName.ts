export function exerciseNameKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFC')
    .toLocaleLowerCase('nb-NO');
}
