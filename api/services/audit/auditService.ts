import { logger } from '../../utils/logger';
import { getSupabaseAdmin } from '../../supabase';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'ACCOUNT_DELETE'
  | 'PERMISSION_CHANGE'
  | 'API_KEY_CHANGE'
  | 'SENSITIVE_READ';

export interface SecurityEvent {
  eventType: SecurityEventType;
  userId: string | undefined;
  ip: string | undefined;
  userAgent: string | undefined;
  details: Record<string, unknown> | undefined;
  timestamp: Date;
}

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string | undefined {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip;
}

function getUserAgent(req: { headers?: Record<string, string | string[] | undefined> }): string | undefined {
  const ua = req.headers?.['user-agent'];
  return typeof ua === 'string' ? ua : undefined;
}

function redactSensitiveData(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;

  const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'authorization'];
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const { eventType, userId, ip, userAgent, details, timestamp } = event;
  const redactedDetails = redactSensitiveData(details);

  // Always log to console with [AUDIT] prefix
  logger.info(`[AUDIT] ${eventType}`, {
    eventType,
    userId,
    ip,
    userAgent,
    details: redactedDetails,
    timestamp: timestamp.toISOString(),
  });

  // Attempt to log to database audit_logs table if it exists
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('audit_logs').insert({
      event_type: eventType,
      user_id: userId,
      ip,
      user_agent: userAgent,
      details: redactedDetails,
      timestamp: timestamp.toISOString(),
    });

    if (error) {
      // Table doesn't exist or insert failed — fall back to logger only
      logger.warn(`[AUDIT] Database insert failed (table may not exist): ${error.message}`);
    }
  } catch {
    // Silently fall back to console logging
    logger.warn('[AUDIT] Database insert failed — audit_logs table may not exist');
  }
}

export function createSecurityEvent(
  eventType: SecurityEventType,
  req: { ip?: string; headers?: Record<string, string | string[] | undefined>; user?: { id?: string } },
  details?: Record<string, unknown>,
): SecurityEvent {
  return {
    eventType,
    userId: req.user?.id,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
    timestamp: new Date(),
  };
}

export { getClientIp, getUserAgent };