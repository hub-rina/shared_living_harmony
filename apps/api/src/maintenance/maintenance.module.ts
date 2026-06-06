import { Module } from '@nestjs/common';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, HouseholdScopeGuard, RoleGuard],
})
export class MaintenanceModule {}
