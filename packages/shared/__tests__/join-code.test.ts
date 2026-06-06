import { generateJoinCode, normalizeJoinCode, formatJoinCode } from '../src/join-code';

describe('normalizeJoinCode', () => {
  test('uppercases and strips spaces, dashes, punctuation', () => {
    expect(normalizeJoinCode(' sage-7k3 ')).toBe('SAGE7K3');
    expect(normalizeJoinCode('sage 7k3')).toBe('SAGE7K3');
    expect(normalizeJoinCode('SAGE7K3')).toBe('SAGE7K3');
  });

  test('drops everything that is not a letter or digit', () => {
    expect(normalizeJoinCode('s@ge_7k3!')).toBe('SGE7K3');
  });
});

describe('formatJoinCode', () => {
  test('inserts a dash before the last three characters for display', () => {
    expect(formatJoinCode('SAGE7K3')).toBe('SAGE-7K3');
  });

  test('returns short codes unchanged', () => {
    expect(formatJoinCode('AB')).toBe('AB');
  });
});

describe('generateJoinCode', () => {
  test('produces an alphanumeric code with no ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
      expect(code).not.toMatch(/[O0I1]/);
      expect(code.length).toBeGreaterThanOrEqual(6);
    }
  });

  test('normalizing a generated code is a no-op (already canonical)', () => {
    const code = generateJoinCode();
    expect(normalizeJoinCode(code)).toBe(code);
  });
});
