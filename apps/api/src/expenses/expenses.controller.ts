import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateExpenseInputSchema,
  MarkSharePaidInputSchema,
  ScanReceiptInputSchema,
  UpdateExpenseInputSchema,
  expensePolicy,
  type CreateExpenseInput,
  type HouseholdScope,
  type MarkSharePaidInput,
  type ScanReceiptInput,
  type UpdateExpenseInput,
} from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExpensesService } from './expenses.service';

@Controller('h/:householdId/expenses')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@CurrentScope() scope: HouseholdScope) {
    if (!expensePolicy.canViewList(scope)) throw new ForbiddenException();
    return this.expenses.list(scope);
  }

  @Post('scan')
  scan(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(ScanReceiptInputSchema)) input: ScanReceiptInput,
  ) {
    return this.expenses.scan(scope, input.imageDataUrl);
  }

  @Post()
  create(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(CreateExpenseInputSchema)) input: CreateExpenseInput,
  ) {
    return this.expenses.create(scope, input);
  }

  @Patch(':id')
  update(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateExpenseInputSchema)) input: UpdateExpenseInput,
  ) {
    return this.expenses.update(scope, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    await this.expenses.remove(scope, id);
  }

  @Post(':id/shares/:shareId/paid')
  markPaid(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
    @Body(new ZodValidationPipe(MarkSharePaidInputSchema)) input: MarkSharePaidInput,
  ) {
    return this.expenses.markPaid(scope, id, shareId, input.proofImageDataUrl);
  }

  @Post(':id/shares/:shareId/confirm')
  confirm(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
  ) {
    return this.expenses.confirm(scope, id, shareId);
  }
}
