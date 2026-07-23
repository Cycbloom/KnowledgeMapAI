import { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { AppError } from "./errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf-token";

const SKIP_CSRF_ROUTES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/health",
  "/api/health/system",
  "/api/analytics",
  "/api/system-monitor",
];

const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const isTokenValid = (cookieToken: string, headerToken: string): boolean => {
  const cookieBuffer = Buffer.from(cookieToken, "utf-8");
  const headerBuffer = Buffer.from(headerToken, "utf-8");
  // Lengths differ: return false without comparing to avoid timingSafeEqual throwing.
  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
};

const shouldSkipCsrf = (req: Request): boolean => {
  const isMobileClient = req.headers["x-mobile-client"] === "true";
  const isElectronClient = req.headers["x-electron-client"] === "true";
  const isRouteSkipped = SKIP_CSRF_ROUTES.some(
    (route) => req.path === route || req.path.startsWith(`${route  }/`),
  );
  const isLocalhost =
    req.hostname === "localhost" || req.hostname === "127.0.0.1";
  // Only skip CSRF for localhost outside production; production must enforce CSRF.
  const skipLocalhost = process.env.NODE_ENV !== "production";
  return (
    isMobileClient ||
    isElectronClient ||
    isRouteSkipped ||
    (skipLocalhost && isLocalhost)
  );
};

const getCookieOptions = () => {
  const isVercel = process.env.VERCEL === "1";
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: false,
    secure: isProduction || isVercel,
    sameSite: isVercel
      ? ("lax" as const)
      : isProduction
        ? ("strict" as const)
        : ("lax" as const),
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
    domain: undefined,
  };
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (shouldSkipCsrf(req)) {
    next();
    return;
  }

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!existingToken) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
      res.locals.csrfToken = token;
    } else {
      res.locals.csrfToken = existingToken;
    }
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken) {
    next(new AppError("CSRF token missing", 403, ErrorCodes.AUTH_FORBIDDEN));
    return;
  }

  if (!isTokenValid(cookieToken, headerToken)) {
    next(new AppError("Invalid CSRF token", 403, ErrorCodes.AUTH_FORBIDDEN));
    return;
  }

  next();
};

export const getCsrfToken = (req: Request, res: Response): void => {
  const token =
    res.locals.csrfToken || req.cookies?.[CSRF_COOKIE_NAME] || generateToken();

  res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());

  res.json({ csrfToken: token });
};
