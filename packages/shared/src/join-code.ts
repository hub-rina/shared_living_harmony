export const JOIN_CODE_WORDS = [
  'SAGE', 'MAPLE', 'HEARTH', 'CEDAR', 'LAWN',
  'EMBER', 'CLAMP', 'HAVEN', 'NEST', 'FERN',
  'PLAZA', 'AMBER', 'PANTRY', 'GLEN', 'DUSK',
] as const;

const SUFFIX_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 3;

export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatJoinCode(code: string): string {
  if (code.length <= SUFFIX_LENGTH) return code;
  const head = code.slice(0, code.length - SUFFIX_LENGTH);
  const tail = code.slice(code.length - SUFFIX_LENGTH);
  return `${head}-${tail}`;
}

export function generateJoinCode(): string {
  const word = JOIN_CODE_WORDS[Math.floor(Math.random() * JOIN_CODE_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  }
  return `${word}${suffix}`;
}
