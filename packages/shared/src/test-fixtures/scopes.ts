import type { HouseholdScope } from '../scope';

const HOUSE = 'house-1';

export const adminScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-admin',
  systemRole: 'user',
  membership: { id: 'm-admin', role: 'admin', status: 'active' },
};

export const adminInactiveScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-admin',
  systemRole: 'user',
  membership: { id: 'm-admin', role: 'admin', status: 'inactive' },
};

export const memberAliceScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'active' },
};

export const memberBobScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'active' },
};

export const inactiveMemberScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'inactive' },
};

export const landlordScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-landlord',
  systemRole: 'user',
  landlord: { propertyId: 'lp-1' },
};

export const nonMemberScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-stranger',
  systemRole: 'user',
};

export const supportScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-support',
  systemRole: 'support',
};

export const SCOPE_USER_IDS = {
  admin: 'u-admin',
  alice: 'u-alice',
  bob: 'u-bob',
  landlord: 'u-landlord',
  stranger: 'u-stranger',
  support: 'u-support',
};
