import jwt from "jsonwebtoken";
import { Response } from "express";
import { UserRole } from "../types";

interface TokenPayload {
  userId: string;
  role: UserRole;
  manufacturerId?: string;
}

export const issueTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET as string,
    {
      expiresIn: "15m",
    },
  );
  const refreshToken = jwt.sign(
    { userId: payload.userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" },
  );
  return { accessToken, refreshToken };
};

export const setTokenCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  const isProd = process.env.NODE_ENV === "production";
  // For cross-site frontends (frontend origin != api origin) we need SameSite=None and Secure=true
  // in production so browsers will send cookies on cross-site requests. For local development
  // we'll use SameSite=lax so cookies are usable on same-site localhost flows.
  const sameSiteSetting: "none" | "lax" = isProd ? "none" : "lax";

  const accessCookieOpts: Record<string, any> = {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSiteSetting,
    maxAge: 15 * 60 * 1000,
    path: "/",
  };

  const refreshCookieOpts: Record<string, any> = {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSiteSetting,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // Keep refresh cookie scoped to the auth refresh path to limit exposure.
    path: "/api/v1/auth/refresh",
  };

  // Optional explicit domain (useful when running behind certain proxies)
  if (process.env.COOKIE_DOMAIN) {
    accessCookieOpts.domain = process.env.COOKIE_DOMAIN;
    refreshCookieOpts.domain = process.env.COOKIE_DOMAIN;
  }

  res.cookie("accessToken", accessToken, accessCookieOpts);
  res.cookie("refreshToken", refreshToken, refreshCookieOpts);
};

export const clearTokenCookies = (res: Response): void => {
  const opts: Record<string, any> = { path: "/" };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie("accessToken", opts);
  const refreshOpts: Record<string, any> = { path: "/api/v1/auth/refresh" };
  if (process.env.COOKIE_DOMAIN) refreshOpts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie("refreshToken", refreshOpts);
};
