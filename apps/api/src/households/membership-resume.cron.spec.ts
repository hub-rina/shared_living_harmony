import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipResumeCron } from './membership-resume.cron';

describe('MembershipResumeCron.sweep', () => {
  const prisma = {
    householdMember: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    membershipStatusLog: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
  };
  let cron: MembershipResumeCron;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MembershipResumeCron, { provide: PrismaService, useValue: prisma }],
    }).compile();
    cron = moduleRef.get(MembershipResumeCron);
  });

  it('no expired rows → resumed: 0, no transaction', async () => {
    prisma.householdMember.findMany.mockResolvedValue([]);
    const result = await cron.sweep(new Date('2026-05-15T00:05:00Z'));
    expect(result).toEqual({ resumed: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('flips expired rows and writes log entries', async () => {
    const now = new Date('2026-05-15T00:05:00Z');
    prisma.householdMember.findMany.mockResolvedValue([
      {
        id: 'm1',
        userId: 'u1',
        inactiveFrom: new Date('2026-05-01T00:00:00Z'),
        inactiveUntil: new Date('2026-05-14T00:00:00Z'),
      },
    ]);
    prisma.householdMember.update.mockResolvedValue({});
    prisma.membershipStatusLog.create.mockResolvedValue({});

    const result = await cron.sweep(now);

    expect(result).toEqual({ resumed: 1 });
    expect(prisma.householdMember.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        status: 'active',
        inactiveFrom: null,
        inactiveUntil: null,
        inactiveReason: null,
      },
    });
    expect(prisma.membershipStatusLog.create).toHaveBeenCalledWith({
      data: {
        membershipId: 'm1',
        changedById: 'u1',
        fromStatus: 'inactive',
        toStatus: 'active',
        from: new Date('2026-05-01T00:00:00Z'),
        until: new Date('2026-05-14T00:00:00Z'),
        reason: 'cron-auto-resume',
      },
    });
  });
});
