import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LandlordService } from './landlord.service';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class LandlordController {
  constructor(private readonly landlord: LandlordService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.landlord.listProperties(user.id);
  }

  @Get(':propertyId')
  detail(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.landlord.getPropertyDetail(user.id, propertyId);
  }

  @Get(':propertyId/insights')
  insights(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.landlord.getPropertyInsights(user.id, propertyId);
  }

  @Get(':propertyId/maintenance')
  maintenance(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.landlord.getPropertyMaintenance(user.id, propertyId);
  }
}
