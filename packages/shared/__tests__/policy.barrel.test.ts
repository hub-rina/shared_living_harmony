import {
  taskPolicy,
  ritualPolicy,
  householdPolicy,
  membershipPolicy,
  validateInactiveWindow,
} from '../src/policy';

describe('policy barrel', () => {
  test('re-exports every policy object', () => {
    expect(typeof taskPolicy.canCreate).toBe('function');
    expect(typeof ritualPolicy.canPropose).toBe('function');
    expect(typeof householdPolicy.canDelete).toBe('function');
    expect(typeof membershipPolicy.canEndOwnInactive).toBe('function');
    expect(typeof validateInactiveWindow).toBe('function');
  });
});
