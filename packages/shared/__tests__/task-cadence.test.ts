import { nextRecurrenceDueAt } from '../src/task';

const iso = (s: string) => new Date(s);

describe('nextRecurrenceDueAt', () => {
  describe('weekly', () => {
    it('advances one week when completed on time', () => {
      const next = nextRecurrenceDueAt(
        iso('2026-05-31T09:00:00.000Z'),
        'weekly',
        iso('2026-05-31T10:00:00.000Z'),
      );
      expect(next.toISOString()).toBe('2026-06-07T09:00:00.000Z');
    });

    it('keeps the weekly grid when completed early (does not pull the rhythm forward)', () => {
      // Current occurrence is due Jun 7; completed 5 days early on May 31.
      const next = nextRecurrenceDueAt(
        iso('2026-06-07T09:00:00.000Z'),
        'weekly',
        iso('2026-05-31T10:00:00.000Z'),
      );
      expect(next.toISOString()).toBe('2026-06-14T09:00:00.000Z');
    });

    it('skips past now when completed very late, never returning an already-overdue date', () => {
      // Due May 1, completed a month late on May 31.
      const next = nextRecurrenceDueAt(
        iso('2026-05-01T09:00:00.000Z'),
        'weekly',
        iso('2026-05-31T10:00:00.000Z'),
      );
      expect(next.toISOString()).toBe('2026-06-05T09:00:00.000Z');
      expect(next.getTime()).toBeGreaterThan(iso('2026-05-31T10:00:00.000Z').getTime());
    });
  });

  describe('monthly', () => {
    it('advances one calendar month', () => {
      const next = nextRecurrenceDueAt(
        iso('2026-03-15T09:00:00.000Z'),
        'monthly',
        iso('2026-03-20T10:00:00.000Z'),
      );
      expect(next.toISOString()).toBe('2026-04-15T09:00:00.000Z');
    });

    it('clamps to the last day of a shorter month', () => {
      // Jan 31 + 1 month has no Feb 31; clamp to Feb 28 (2026 is not a leap year).
      const next = nextRecurrenceDueAt(
        iso('2026-01-31T09:00:00.000Z'),
        'monthly',
        iso('2026-02-01T10:00:00.000Z'),
      );
      expect(next.toISOString()).toBe('2026-02-28T09:00:00.000Z');
    });
  });
});
