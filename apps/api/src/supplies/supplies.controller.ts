import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AddSupplyInputSchema, type AddSupplyInput, type HouseholdScope } from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SuppliesService } from './supplies.service';

@Controller('h/:householdId/supplies')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class SuppliesController {
  constructor(private readonly supplies: SuppliesService) {}

  @Get()
  list(@CurrentScope() scope: HouseholdScope) {
    if (!scope.membership) throw new ForbiddenException();
    return this.supplies.list(scope);
  }

  @Post()
  add(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(AddSupplyInputSchema)) input: AddSupplyInput,
  ) {
    return this.supplies.add(scope, input);
  }

  @Post('defaults')
  addDefaults(@CurrentScope() scope: HouseholdScope) {
    return this.supplies.addDefaults(scope);
  }

  @Post(':id/low')
  markLow(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    return this.supplies.markLow(scope, id);
  }

  @Post(':id/restock')
  restock(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    return this.supplies.restock(scope, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    await this.supplies.remove(scope, id);
  }
}
