import type { HouseholdRole, MembershipStatus, SystemRole } from './membership';

export type HouseholdScope = {
  householdId: string;
  userId: string;
  systemRole: SystemRole;
  membership?: {
    id: string;
    role: HouseholdRole;
    status: MembershipStatus;
  };
  landlord?: {
    propertyId: string;
  };
};
