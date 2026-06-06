import { Module } from '@nestjs/common';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { SmartRotationService } from '../tasks/smart-rotation.service';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';

@Module({
  controllers: [SuppliesController],
  providers: [SuppliesService, SmartRotationService, HouseholdScopeGuard, RoleGuard],
})
export class SuppliesModule {}
