import { Module } from '@nestjs/common';
import { HarmonyModule } from '../harmony/harmony.module';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmartRotationService } from './smart-rotation.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [HarmonyModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, SmartRotationService, HouseholdScopeGuard, RoleGuard],
  exports: [TasksService],
})
export class TasksModule {}
