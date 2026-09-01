import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@perfume/validation";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { ZodPipe } from "../../common/zod-pipe";
import { CurrentSessionId, CurrentUser, RequestUser } from "../../common/context";
import { Public, SkipOutlet } from "../../common/guards";
import { AuthRateLimit, AuthRateLimitGuard } from "./auth-rate-limit";

@SkipOutlet()
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 900_000)
  @Post("login")
  login(
    @Body(new ZodPipe(loginSchema))
    body: { email: string; password: string; deviceId?: string; deviceLabel?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(body.email, body.password, body.deviceId, body.deviceLabel, req, res);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(30, 900_000)
  @Post("refresh")
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Public()
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Post("logout-all")
  logoutAll(@CurrentUser() user: RequestUser) {
    return this.auth.logoutAll(user.id, user.tenantId);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Get("sessions")
  sessions(@CurrentUser() user: RequestUser, @CurrentSessionId() sessionId?: string) {
    return this.auth.listSessions(user.id, sessionId);
  }

  @Post("sessions/:id/revoke")
  revokeSession(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.auth.revokeOwnSession(user.id, id);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(5, 900_000)
  @Post("forgot-password")
  forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: { email: string }) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 900_000)
  @Post("reset-password")
  resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: { token: string; newPassword: string }) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post("change-password")
  changePassword(
    @CurrentUser() user: RequestUser,
    @CurrentSessionId() sessionId: string | undefined,
    @Body(new ZodPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(user.id, body.currentPassword, body.newPassword, sessionId);
  }
}
