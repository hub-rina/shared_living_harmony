import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ChangeMemberRoleInputSchema,
  CreateHouseholdInputSchema,
  InviteMemberInputSchema,
  JoinHouseholdInputSchema,
  LinkLandlordInputSchema,
  SetInactiveInputSchema,
  UpdateHouseholdInputSchema,
  UpdateLandlordLinkInputSchema,
  type ChangeMemberRoleInput,
  type CreateHouseholdInput,
  type HouseholdScope,
  type InviteMemberInput,
  type JoinHouseholdInput,
  type LinkLandlordInput,
  type SetInactiveInput,
  type UpdateHouseholdInput,
  type UpdateLandlordLinkInput,
} from '@homebuddy/shared';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { HouseholdsService } from './households.service';

@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.households.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateHouseholdInputSchema)) input: CreateHouseholdInput,
  ) {
    return this.households.create(user.id, input);
  }

  @Post('join')
  @HttpCode(200)
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(JoinHouseholdInputSchema)) input: JoinHouseholdInput,
  ) {
    return this.households.joinByCode(user.id, input);
  }
}

@Controller('h/:householdId')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class HouseholdScopedController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  get(@CurrentScope() scope: HouseholdScope) {
    return this.households.getForScope(scope);
  }

  @Get('me')
  me(@CurrentScope() scope: HouseholdScope) {
    return this.households.getScopeView(scope);
  }

  @Patch()
  @RequireRole('admin')
  update(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(UpdateHouseholdInputSchema)) input: UpdateHouseholdInput,
  ) {
    return this.households.updateSettings(scope, input);
  }

  @Post('join-code/regenerate')
  @RequireRole('admin')
  @HttpCode(200)
  regenerateJoinCode(@CurrentScope() scope: HouseholdScope) {
    return this.households.regenerateJoinCode(scope);
  }

  @Delete()
  @HttpCode(204)
  @RequireRole('admin')
  async remove(@CurrentScope() scope: HouseholdScope) {
    await this.households.remove(scope);
  }

  @Post('members/invite')
  @RequireRole('admin')
  invite(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(InviteMemberInputSchema)) input: InviteMemberInput,
  ) {
    return this.households.invite(scope, input);
  }

  @Delete('members/:memberId')
  @HttpCode(204)
  @RequireRole('admin')
  async removeMember(
    @CurrentScope() scope: HouseholdScope,
    @Param('memberId') memberId: string,
  ) {
    await this.households.removeMember(scope, memberId);
  }

  @Patch('members/:memberId/role')
  @RequireRole('admin')
  changeRole(
    @CurrentScope() scope: HouseholdScope,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(ChangeMemberRoleInputSchema)) input: ChangeMemberRoleInput,
  ) {
    return this.households.changeMemberRole(scope, memberId, input.role);
  }

  @Post('landlord')
  @RequireRole('admin')
  linkLandlord(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(LinkLandlordInputSchema)) input: LinkLandlordInput,
  ) {
    return this.households.linkLandlord(scope, input);
  }

  @Patch('landlord/:landlordUserId')
  @RequireRole('admin')
  updateLandlord(
    @CurrentScope() scope: HouseholdScope,
    @Param('landlordUserId') landlordUserId: string,
    @Body(new ZodValidationPipe(UpdateLandlordLinkInputSchema)) input: UpdateLandlordLinkInput,
  ) {
    return this.households.updateLandlordLink(scope, landlordUserId, input);
  }

  @Delete('landlord/:landlordUserId')
  @HttpCode(204)
  @RequireRole('admin')
  async unlinkLandlord(
    @CurrentScope() scope: HouseholdScope,
    @Param('landlordUserId') landlordUserId: string,
  ) {
    await this.households.unlinkLandlord(scope, landlordUserId);
  }

  @Post('membership/inactive')
  async setSelfInactive(
    @CurrentScope() scope: HouseholdScope,
    @Body(new ZodValidationPipe(SetInactiveInputSchema)) input: SetInactiveInput,
  ) {
    return this.households.setSelfInactive(scope, input);
  }

  @Post('membership/active')
  @HttpCode(200)
  async endOwnInactive(@CurrentScope() scope: HouseholdScope) {
    return this.households.endOwnInactive(scope);
  }

  @Post('members/:memberId/end-inactive')
  @RequireRole('admin')
  async forceEndOther(
    @CurrentScope() scope: HouseholdScope,
    @Param('memberId') memberId: string,
  ) {
    return this.households.forceEndOther(scope, memberId);
  }
}
