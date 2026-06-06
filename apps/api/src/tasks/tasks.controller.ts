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
  CompleteTaskInputSchema,
  CreateCaretakerTaskInputSchema,
  CreateTaskInputSchema,
  FlagMessInputSchema,
  UpdateTaskInputSchema,
  taskPolicy,
  type CompleteTaskInput,
  type CreateCaretakerTaskInput,
  type CreateTaskInput,
  type FlagMessInput,
  type HouseholdScope,
  type UpdateTaskInput,
} from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TasksService } from './tasks.service';

@Controller('h/:householdId/tasks')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentScope() scope: HouseholdScope) {
    if (!taskPolicy.canViewList(scope)) throw new ForbiddenException();
    return this.tasks.listForHousehold(scope);
  }

  @Get('mine')
  mine(@CurrentScope() scope: HouseholdScope) {
    if (!taskPolicy.canViewList(scope)) throw new ForbiddenException();
    return this.tasks.listAssignedToMe(scope);
  }

  @Post()
  create(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(CreateTaskInputSchema)) input: CreateTaskInput,
  ) {
    if (!taskPolicy.canCreate(scope)) throw new ForbiddenException();
    return this.tasks.create(scope, input);
  }

  @Post('caretaker')
  @RequireRole('admin')
  createCaretakerChore(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(CreateCaretakerTaskInputSchema)) input: CreateCaretakerTaskInput,
  ) {
    return this.tasks.createCaretakerChore(scope, input);
  }

  @Post('flag-mess')
  flagMess(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(FlagMessInputSchema)) input: FlagMessInput,
  ) {
    if (!taskPolicy.canCreate(scope)) throw new ForbiddenException();
    return this.tasks.flagMess(scope, input);
  }

  @Post(':id/complete')
  complete(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteTaskInputSchema)) input: CompleteTaskInput,
  ) {
    return this.tasks.complete(scope, id, input);
  }

  @Patch(':id')
  update(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTaskInputSchema)) input: UpdateTaskInput,
  ) {
    return this.tasks.update(scope, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    await this.tasks.remove(scope, id);
  }

  @Post(':id/reassign')
  @RequireRole('admin')
  reassign(
    @CurrentScope() scope: HouseholdScope,
    @Param('id') id: string,
  ) {
    return this.tasks.reassign(scope, id);
  }

  @Post(':id/snooze')
  snooze(@CurrentScope() scope: HouseholdScope, @Param('id') id: string) {
    return this.tasks.snooze(scope, id);
  }
}
