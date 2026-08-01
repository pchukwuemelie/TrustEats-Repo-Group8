import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, UserRole } from "../types";

interface JwtPayload {
  userId: string;
  role: UserRole;
  manufacturerId?: string;
}

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const cookieToken = req.cookies?.accessToken;
  const headerToken =
    typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : undefined;
  const token = cookieToken ?? headerToken;

  if (!token) {
    res
      .status(401)
      .json({ success: false, error: "Unauthorised — please log in" });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string,
    ) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      manufacturerId: decoded.manufacturerId,
    };
    next();
  } catch {
    res
      .status(401)
      .json({ success: false, error: "Session expired — please log in again" });
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "Forbidden — insufficient permissions",
      });
      return;
    }
    next();
  };
