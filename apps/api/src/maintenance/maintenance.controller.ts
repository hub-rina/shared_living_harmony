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
  CreateMaintenanceInputSchema,
  SetMaintenanceEscalationInputSchema,
  UpdateMaintenanceStatusInputSchema,
  type CreateMaintenanceInput,
  type HouseholdScope,
  type SetMaintenanceEscalationInput,
  type UpdateMaintenanceStatusInput,
} from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MaintenanceService } from './maintenance.service';

@Controller('h/:householdId/maintenance')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@CurrentScope() scope: HouseholdScope) {
    if (!scope.membership) throw new ForbiddenException();
    return this.maintenance.list(scope);
  }

  @Post()
  create(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(CreateMaintenanceInputSchema)) input: CreateMaintenanceInput,
  ) {
    return this.maintenance.create(scope, input);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceStatusInputSchema))
    input: UpdateMaintenanceStatusInput,
  ) {
    return this.maintenance.updateStatus(scope, id, input.status);
  }

  @Patch(':id/escalation')
  setEscalation(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetMaintenanceEscalationInputSchema))
    input: SetMaintenanceEscalationInput,
  ) {
    return this.maintenance.setEscalation(scope, id, input.escalated);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    await this.maintenance.remove(scope, id);
  }
}
