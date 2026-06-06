import { describe, expect, it } from 'vitest';
import { harmonyHeading, harmonyCause } from '../copy';

describe('harmonyHeading', () => {
  it('names the orb as the household mood so it reads as a thing, not decoration', () => {
    expect(harmonyHeading('Demo House')).toBe("Demo House's mood");
  });
});

describe('harmonyCause', () => {
  it('credits a bloom when everyone has just shown up', () => {
    const cause = harmonyCause({
      mood: 'Harmonized',
      overdueCount: 0,
      hasHeavyOverdue: true,
      bloomActive: true,
    });
    expect(cause).toMatch(/glow/i);
  });

  it('points at the heavy overdue chore when one is dragging the house down', () => {
    const cause = harmonyCause({
      mood: 'Tense',
      overdueCount: 3,
      hasHeavyOverdue: true,
      bloomActive: false,
    });
    expect(cause).toMatch(/waiting a while/i);
  });

  it('uses singular phrasing for exactly one overdue chore', () => {
    const cause = harmonyCause({
      mood: 'Calm',
      overdueCount: 1,
      hasHeavyOverdue: false,
      bloomActive: false,
    });
    expect(cause).toContain('One chore');
    expect(cause).not.toMatch(/\d/);
  });

  it('counts the overdue chores when more than one need a hand', () => {
    const cause = harmonyCause({
      mood: 'Unstable',
      overdueCount: 4,
      hasHeavyOverdue: false,
      bloomActive: false,
    });
    expect(cause).toContain('4 chores');
  });

  it('reassures and points forward when a low house has nothing overdue', () => {
    const cause = harmonyCause({
      mood: 'Tense',
      overdueCount: 0,
      hasHeavyOverdue: false,
      bloomActive: false,
    });
    expect(cause).toMatch(/warm it up/i);
  });

  it('affirms a settled house with nothing waiting', () => {
    const cause = harmonyCause({
      mood: 'Stable',
      overdueCount: 0,
      hasHeavyOverdue: false,
      bloomActive: false,
    });
    expect(cause).toMatch(/keeping up/i);
  });

  it('never blames a person', () => {
    const cause = harmonyCause({
      mood: 'Tense',
      overdueCount: 5,
      hasHeavyOverdue: true,
      bloomActive: false,
    });
    expect(cause).not.toMatch(/fail|late|behind|neglect/i);
  });
});
