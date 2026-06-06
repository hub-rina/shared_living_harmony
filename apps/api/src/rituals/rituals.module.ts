import { Module } from '@nestjs/common';
import { HarmonyModule } from '../harmony/harmony.module';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RitualsController } from './rituals.controller';
import { RitualsService } from './rituals.service';

@Module({
  imports: [HarmonyModule],
  controllers: [RitualsController],
  providers: [RitualsService, HouseholdScopeGuard, RoleGuard],
  exports: [RitualsService],
})
export class RitualsModule {}
