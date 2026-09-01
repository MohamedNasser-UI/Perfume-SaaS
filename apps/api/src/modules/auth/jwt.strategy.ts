import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { AuthService } from "./auth.service";

export type JwtPayload = {
  sub: string;
  sid: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") ?? "change-me-to-a-long-random-string",
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (!payload?.sub || !payload?.sid) throw new UnauthorizedException();
    const alive = await this.auth.assertSession(payload.sid, payload.sub);
    if (!alive) throw new UnauthorizedException();
    const user = await this.auth.resolveUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    (req as Request & { authSessionId?: string }).authSessionId = payload.sid;
    return user;
  }
}
