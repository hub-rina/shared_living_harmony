import { Module } from '@nestjs/common';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { OcrModule } from '../ocr/ocr.module';
import { StorageModule } from '../storage/storage.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [StorageModule, OcrModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, HouseholdScopeGuard, RoleGuard],
})
export class ExpensesModule {}
