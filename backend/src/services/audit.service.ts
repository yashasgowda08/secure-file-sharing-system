import { prisma } from '../db/prisma';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

export class AuditService {
  /**
   * Sanitizes details to ensure no sensitive fields (passwords, tokens, keys) are ever persisted
   */
  private static sanitizeDetails(details?: Record<string, any>): string | undefined {
    if (!details) return undefined;
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'iv', 'authTag', 'backupCodes', 'cookie'];
    const sanitized: Record<string, any> = {};

    for (const [k, v] of Object.entries(details)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }

    return JSON.stringify(sanitized);
  }

  /**
   * Records an audit log entry asynchronously
   */
  public static async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resourceType: params.resourceType || null,
          resourceId: params.resourceId || null,
          detailsJson: this.sanitizeDetails(params.details),
          ipAddress: params.ipAddress || 'unknown',
          userAgent: params.userAgent || 'unknown',
          status: params.status || 'SUCCESS',
        },
      });
    } catch (err) {
      // Never crash the main request if logging fails, but print error
      console.error('AuditLog error:', err);
    }
  }
}
