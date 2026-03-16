import crypto from 'crypto';
import { AppError } from './errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';
const SKIP_CSRF_ROUTES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/health',
    '/api/health/system',
    '/api/analytics',
    '/api/system-monitor',
];
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
const shouldSkipCsrf = (req) => {
    return SKIP_CSRF_ROUTES.some(route => req.path === route || req.path.startsWith(route + '/'));
};
const getCookieOptions = () => {
    const isVercel = process.env.VERCEL === '1';
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: false,
        secure: isProduction || isVercel,
        sameSite: isVercel ? 'lax' : (isProduction ? 'strict' : 'lax'),
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
        domain: undefined,
    };
};
export const csrfProtection = (req, res, next) => {
    if (shouldSkipCsrf(req)) {
        next();
        return;
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
        if (!existingToken) {
            const token = generateToken();
            res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
            res.locals.csrfToken = token;
        }
        else {
            res.locals.csrfToken = existingToken;
        }
        next();
        return;
    }
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER];
    if (!cookieToken || !headerToken) {
        next(new AppError('CSRF token missing', 403, ErrorCodes.FORBIDDEN));
        return;
    }
    if (cookieToken !== headerToken) {
        next(new AppError('Invalid CSRF token', 403, ErrorCodes.FORBIDDEN));
        return;
    }
    next();
};
export const getCsrfToken = (req, res) => {
    const token = res.locals.csrfToken || req.cookies?.[CSRF_COOKIE_NAME] || generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
    res.json({ csrfToken: token });
};
//# sourceMappingURL=csrf.js.map