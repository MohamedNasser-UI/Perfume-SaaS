import { ConfigService } from "@nestjs/config";
import { CookieOptions, Request, Response } from "express";
import { parseDuration } from "../../common/auth-tokens";

export const REFRESH_COOKIE = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export function refreshCookieMaxAge(config: ConfigService) {
  return parseDuration(config.get<string>("REFRESH_TOKEN_EXPIRES_IN"), 7 * 24 * 60 * 60 * 1000);
}

export function refreshCookieOptions(req: Request, config: ConfigService): CookieOptions {
  const explicit = config.get<string>("AUTH_COOKIE_SECURE");
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  const https = req.secure || proto === "https";
  const secure = explicit === "true" ? true : explicit === "false" ? false : https;
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshCookieMaxAge(config),
  };
}

export function setRefreshCookie(res: Response, req: Request, config: ConfigService, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(req, config));
}

export function clearRefreshCookie(res: Response, req: Request, config: ConfigService) {
  res.clearCookie(REFRESH_COOKIE, {
    ...refreshCookieOptions(req, config),
    maxAge: 0,
  });
}
