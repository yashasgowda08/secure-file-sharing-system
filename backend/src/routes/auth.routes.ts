import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { CryptoService } from '../services/crypto.service';
import { MfaService } from '../services/mfa.service';
import { AuditService } from '../services/audit.service';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { authRateLimiter } from '../middlewares/rate-limiter.middleware';
import { config } from '../config/env';

const router = Router();

const getUserAgent = (req: Request): string => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || 'Unknown';
};

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const mfaVerifySchema = z.object({
  tempToken: z.string(),
  code: z.string().min(6).max(10),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z
    .string()
    .min(10)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

export const getSessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  expires,
  path: '/',
});

// 1. REGISTER
router.post('/register', authRateLimiter, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    const lowerEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existing) {
      await AuditService.log({
        action: 'AUTH_REGISTER_COLLISION',
        details: { email: lowerEmail },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
        status: 'WARNING',
      });
      res.status(400).json({ success: false, message: 'An account with this email already exists or is unavailable.' });
      return;
    }

    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'USER';

    const passwordHash = await CryptoService.hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: lowerEmail,
        passwordHash,
        fullName,
        role,
        isVerified: true,
        storageLimit: config.defaultUserQuotaBytes,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'AUTH_REGISTER',
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    const rawToken = CryptoService.generateRandomToken(32);
    const tokenHash = CryptoService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        userAgent: getUserAgent(req),
        ipAddress: req.ip || 'Unknown',
        expiresAt,
      },
    });

    res.cookie('session_token', rawToken, getSessionCookieOptions(expiresAt));

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        isMfaEnabled: user.isMfaEnabled,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
      },
      token: rawToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed due to a server error.' });
  }
});

// 2. LOGIN
router.post('/login', authRateLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });

    if (user && user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to excessive failed attempts. Try again in ${waitMinutes} minute(s).`,
      });
      return;
    }

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await CryptoService.verifyPassword(password, user.passwordHash);
    }

    if (!user || !isPasswordValid) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts, lockoutUntil },
        });

        await AuditService.log({
          userId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          details: { email: lowerEmail, attemptCount: attempts },
          ipAddress: req.ip,
          userAgent: getUserAgent(req),
          status: 'WARNING',
        });
      }

      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null },
    });

    if (user.isMfaEnabled) {
      const tempToken = jwt.sign({ userId: user.id, stage: 'mfa_pending' }, config.jwtSecret, { expiresIn: '5m' });

      await AuditService.log({
        userId: user.id,
        action: 'AUTH_LOGIN_MFA_CHALLENGE',
        details: { email: user.email },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        mfaRequired: true,
        tempToken,
        message: 'Two-factor authentication code required.',
      });
      return;
    }

    const rawToken = CryptoService.generateRandomToken(32);
    const tokenHash = CryptoService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        userAgent: getUserAgent(req),
        ipAddress: req.ip || 'Unknown',
        expiresAt,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.cookie('session_token', rawToken, getSessionCookieOptions(expiresAt));

    res.json({
      success: true,
      mfaRequired: false,
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        isMfaEnabled: user.isMfaEnabled,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
      },
      token: rawToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed due to a server error.' });
  }
});

// 3. VERIFY MFA
router.post('/verify-mfa', authRateLimiter, validateBody(mfaVerifySchema), async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;

    let payload: any;
    try {
      payload = jwt.verify(tempToken, config.jwtSecret);
    } catch {
      res.status(401).json({ success: false, message: 'MFA session expired. Please log in again.' });
      return;
    }

    if (payload.stage !== 'mfa_pending' || !payload.userId) {
      res.status(401).json({ success: false, message: 'Invalid MFA challenge token.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      res.status(400).json({ success: false, message: 'MFA is not enabled on this account.' });
      return;
    }

    let isCodeValid = MfaService.verifyToken(code, user.mfaSecret);
    let usedBackupCode = false;

    if (!isCodeValid && user.mfaBackupCodes) {
      const backupResult = MfaService.verifyAndConsumeBackupCode(code, user.mfaBackupCodes);
      if (backupResult.valid) {
        isCodeValid = true;
        usedBackupCode = true;
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: backupResult.remainingHashes },
        });
      }
    }

    if (!isCodeValid) {
      await AuditService.log({
        userId: user.id,
        action: 'AUTH_MFA_FAILED',
        details: { email: user.email },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
        status: 'WARNING',
      });
      res.status(401).json({ success: false, message: 'Invalid authentication or backup code.' });
      return;
    }

    const rawToken = CryptoService.generateRandomToken(32);
    const tokenHash = CryptoService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        userAgent: getUserAgent(req),
        ipAddress: req.ip || 'Unknown',
        expiresAt,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: usedBackupCode ? 'AUTH_LOGIN_MFA_BACKUP_CODE' : 'AUTH_LOGIN_MFA_SUCCESS',
      details: { email: user.email, usedBackupCode },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.cookie('session_token', rawToken, getSessionCookieOptions(expiresAt));

    res.json({
      success: true,
      message: 'Authentication successful.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        isMfaEnabled: user.isMfaEnabled,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
      },
      token: rawToken,
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ success: false, message: 'MFA verification failed.' });
  }
});

// 4. GET CURRENT USER
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user,
    session: req.session,
  });
});

// 5. LOGOUT
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.session?.id) {
      await prisma.session.update({
        where: { id: req.session.id },
        data: { revokedAt: new Date() },
      });
    }

    await AuditService.log({
      userId: req.user?.id,
      action: 'AUTH_LOGOUT',
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.clearCookie('session_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
});

// 6. LOGOUT ALL SESSIONS
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    await prisma.session.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'AUTH_LOGOUT_ALL',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.clearCookie('session_token', { path: '/' });
    res.json({ success: true, message: 'Logged out from all devices.' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ success: false, message: 'Logout all failed.' });
  }
});

// 7. SETUP MFA
router.post('/mfa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const secret = MfaService.generateSecret();
    const { otpauthUrl, qrCodeDataUrl } = await MfaService.generateQrCode(req.user.email, secret);

    res.json({
      success: true,
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate MFA setup.' });
  }
});

// 8. ENABLE MFA
router.post('/mfa/enable', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { secret, code } = req.body;

    if (!secret || !code) {
      res.status(400).json({ success: false, message: 'Secret and verification code are required.' });
      return;
    }

    const isValid = MfaService.verifyToken(code, secret);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Invalid verification code.' });
      return;
    }

    const { plainCodes, hashedCodes } = MfaService.generateBackupCodes();

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isMfaEnabled: true,
        mfaSecret: secret,
        mfaBackupCodes: hashedCodes.join(','),
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'AUTH_MFA_ENABLED',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({
      success: true,
      message: 'Multi-Factor Authentication enabled successfully.',
      backupCodes: plainCodes,
    });
  } catch (error) {
    console.error('Enable MFA error:', error);
    res.status(500).json({ success: false, message: 'Failed to enable MFA.' });
  }
});

// 9. DISABLE MFA
router.post('/mfa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return;

    const isValid = await CryptoService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isMfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'AUTH_MFA_DISABLED',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Multi-Factor Authentication disabled.' });
  } catch (error) {
    console.error('Disable MFA error:', error);
    res.status(500).json({ success: false, message: 'Failed to disable MFA.' });
  }
});

// 10. LIST SESSIONS
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      currentSessionId: req.session?.id,
      sessions,
    });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions.' });
  }
});

// 11. REVOKE SPECIFIC SESSION
router.delete('/sessions/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { sessionId } = req.params;

    const session = await prisma.session.findFirst({
      where: { id: String(sessionId), userId: req.user.id },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found.' });
      return;
    }

    await prisma.session.update({
      where: { id: String(sessionId) },
      data: { revokedAt: new Date() },
    });

    if (sessionId === req.session?.id) {
      res.clearCookie('session_token', { path: '/' });
    }

    await AuditService.log({
      userId: req.user.id,
      action: 'AUTH_SESSION_REVOKED',
      details: { sessionId, revokedCurrent: sessionId === req.session?.id },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Session revoked successfully.' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke session.' });
  }
});

// 12. FORGOT PASSWORD
router.post('/forgot-password', authRateLimiter, validateBody(resetPasswordRequestSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (user) {
      const rawResetToken = CryptoService.generateRandomToken(32);
      const tokenHash = CryptoService.hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await AuditService.log({
        userId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        details: { email: user.email },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        message: 'If the email is registered, password reset instructions have been dispatched.',
        ...(config.nodeEnv !== 'production' && { devResetToken: rawResetToken }),
      });
      return;
    }

    res.json({
      success: true,
      message: 'If the email is registered, password reset instructions have been dispatched.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
  }
});

// 13. RESET PASSWORD
router.post('/reset-password', authRateLimiter, validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = CryptoService.hashToken(token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
      res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
      return;
    }

    const passwordHash = await CryptoService.hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockoutUntil: null },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      userId: resetRecord.userId,
      action: 'AUTH_PASSWORD_RESET_SUCCESS',
      details: { email: resetRecord.user.email },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

export default router;
