import { randomUUID } from 'crypto';
export function requestIdMiddleware(req, res, next) {
    const existingId = req.headers['x-request-id'];
    req.requestId = existingId || randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
}
//# sourceMappingURL=requestId.js.map