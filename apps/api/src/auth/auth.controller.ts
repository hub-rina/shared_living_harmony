import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  LoginInputSchema,
  RefreshInputSchema,
  RegisterInputSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@homebuddy/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterInputSchema)) input: RegisterInput) {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginInputSchema)) input: LoginInput) {
    return this.auth.login(input);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshInputSchema)) input: RefreshInput) {
    return this.auth.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMeWithMemberships(user.id);
  }
}
