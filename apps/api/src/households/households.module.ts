import { Module } from '@nestjs/common';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { SmartRotationService } from '../tasks/smart-rotation.service';
import { HouseholdScopedController, HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import { MembershipResumeCron } from './membership-resume.cron';

@Module({
  controllers: [HouseholdsController, HouseholdScopedController],
  providers: [HouseholdsService, HouseholdScopeGuard, RoleGuard, SmartRotationService, MembershipResumeCron],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
