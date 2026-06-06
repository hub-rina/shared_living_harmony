import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HarmonyService } from './harmony.service';

describe('HarmonyService.applyRitualCompletion', () => {
  let service: HarmonyService;
  const prisma = {
    household: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.household.findUniqueOrThrow.mockResolvedValue({ harmonyScore: 60 });
    prisma.household.update.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        HarmonyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HarmonyService);
  });

  it('sets lastBloomedAt when participation hits the bloom threshold', async () => {
    await service.applyRitualCompletion('h1', 3, 4);

    const bloomCall = prisma.household.update.mock.calls.find(
      ([args]) => args.data?.lastBloomedAt instanceof Date,
    );
    expect(bloomCall).toBeDefined();
    const ms = (bloomCall![0].data.lastBloomedAt as Date).getTime();
    expect(Math.abs(ms - Date.now())).toBeLessThan(2000);
  });

  it('does not set lastBloomedAt when participation is below the bloom threshold', async () => {
    await service.applyRitualCompletion('h1', 1, 4);

    const bloomCall = prisma.household.update.mock.calls.find(
      ([args]) => args.data?.lastBloomedAt instanceof Date,
    );
    expect(bloomCall).toBeUndefined();
  });

  it('does not set lastBloomedAt when the household has no members (avoids divide-by-zero blooms)', async () => {
    await service.applyRitualCompletion('h1', 0, 0);

    const bloomCall = prisma.household.update.mock.calls.find(
      ([args]) => args.data?.lastBloomedAt instanceof Date,
    );
    expect(bloomCall).toBeUndefined();
  });

  it('returns the computed harmony bonus and applies it when positive', async () => {
    const bonus = await service.applyRitualCompletion('h1', 4, 4);
    expect(bonus).toBeGreaterThan(0);
    const scoreCall = prisma.household.update.mock.calls.find(
      ([args]) => typeof args.data?.harmonyScore === 'number',
    );
    expect(scoreCall).toBeDefined();
  });
});
