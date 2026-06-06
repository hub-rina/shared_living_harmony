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
import {
  CreateRitualInputSchema,
  ritualPolicy,
  type CreateRitualInput,
  type HouseholdScope,
} from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RitualsService } from './rituals.service';

@Controller('h/:householdId/rituals')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class RitualsController {
  constructor(private readonly rituals: RitualsService) {}

  @Get()
  list(@CurrentScope() scope: HouseholdScope) {
    if (!ritualPolicy.canViewList(scope)) throw new ForbiddenException();
    return this.rituals.listForHousehold(scope);
  }

  @Post()
  create(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(CreateRitualInputSchema)) input: CreateRitualInput,
  ) {
    if (!ritualPolicy.canPropose(scope)) throw new ForbiddenException();
    return this.rituals.create(scope, input);
  }

  @Post(':id/join')
  join(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    return this.rituals.join(scope, id);
  }

  @Post(':id/complete')
  complete(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    return this.rituals.complete(scope, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    await this.rituals.remove(scope, id);
  }
}
