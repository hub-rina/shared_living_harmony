import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LandlordController } from './landlord.controller';
import { LandlordService } from './landlord.service';

const user = { id: 'u-landlord', email: 'landlord@example.com', role: 'user' as const };

describe('LandlordController', () => {
  let controller: LandlordController;

  const landlordService = {
    listProperties: jest.fn(),
    getPropertyDetail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [LandlordController],
      providers: [{ provide: LandlordService, useValue: landlordService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(LandlordController);
  });

  describe('list', () => {
    it('delegates to landlord.listProperties with the caller id', async () => {
      landlordService.listProperties.mockResolvedValue([]);

      const result = await controller.list(user as never);

      expect(landlordService.listProperties).toHaveBeenCalledWith(user.id);
      expect(result).toEqual([]);
    });
  });

  describe('detail', () => {
    it('delegates to landlord.getPropertyDetail with the caller id and propertyId', async () => {
      const summary = { propertyId: 'prop-1', name: 'Flat 3B' };
      landlordService.getPropertyDetail.mockResolvedValue(summary);

      const result = await controller.detail(user as never, 'prop-1');

      expect(landlordService.getPropertyDetail).toHaveBeenCalledWith(user.id, 'prop-1');
      expect(result).toEqual(summary);
    });
  });
});
