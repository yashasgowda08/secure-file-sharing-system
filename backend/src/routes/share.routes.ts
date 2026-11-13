import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { publicDownloadRateLimiter } from '../middlewares/rate-limiter.middleware';
import { CryptoService } from '../services/crypto.service';
import { StorageService } from '../services/storage.service';
import { AuditService } from '../services/audit.service';
import { config } from '../config/env';

const router = Router();

const getUserAgent = (req: Request): string => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || 'Unknown';
};

const createShareSchema = z.object({
  fileId: z.string().uuid(),
  shareType: z.enum(['PUBLIC_LINK', 'SPECIFIC_USER']).default('PUBLIC_LINK'),
  sharedWithEmail: z.string().email().optional().nullable(),
  password: z.string().min(4).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxDownloads: z.number().int().positive().optional().nullable(),
  permission: z.enum(['VIEW_ONLY', 'DOWNLOAD']).default('DOWNLOAD'),
});

// 1. CREATE SHARE LINK / GRANT
router.post('/', authenticate, validateBody(createShareSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { fileId, shareType, sharedWithEmail, password, expiresAt, maxDownloads, permission } = req.body;

    const file = await prisma.file.findFirst({
      where: { id: String(fileId), ownerId: req.user.id, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found or unauthorized.' });
      return;
    }

    let sharedWithUserId: string | null = null;
    if (shareType === 'SPECIFIC_USER') {
      if (!sharedWithEmail) {
        res.status(400).json({ success: false, message: 'Recipient email is required for user-specific sharing.' });
        return;
      }
      const recipient = await prisma.user.findUnique({
        where: { email: sharedWithEmail.toLowerCase().trim() },
      });
      if (!recipient) {
        res.status(404).json({ success: false, message: `No registered user found with email: ${sharedWithEmail}` });
        return;
      }
      sharedWithUserId = recipient.id;
    }

    const shareToken = CryptoService.generateRandomToken(24);

    let passwordHash: string | null = null;
    if (password && password.trim().length > 0) {
      passwordHash = await CryptoService.hashPassword(password.trim());
    }

    const share = await prisma.fileShare.create({
      data: {
        fileId: file.id,
        createdById: req.user.id,
        shareToken,
        shareType,
        sharedWithUserId,
        sharedWithEmail: sharedWithEmail ? sharedWithEmail.toLowerCase().trim() : null,
        passwordHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxDownloads: maxDownloads || null,
        permission,
      },
      include: {
        file: { select: { id: true, name: true, size: true, mimeType: true } },
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'SHARE_CREATED',
      resourceType: 'SHARE',
      resourceId: share.id,
      details: {
        fileId: file.id,
        filename: file.name,
        shareType,
        hasPassword: !!passwordHash,
        expiresAt,
        maxDownloads,
        permission,
      },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.status(201).json({
      success: true,
      share: {
        id: share.id,
        shareToken: share.shareToken,
        shareUrl: `/share/${share.shareToken}`,
        shareType: share.shareType,
        permission: share.permission,
        expiresAt: share.expiresAt,
        maxDownloads: share.maxDownloads,
        currentDownloads: share.currentDownloads,
        hasPassword: !!passwordHash,
        file: share.file,
      },
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ success: false, message: 'Failed to create share.' });
  }
});

// 2. LIST SHARES CREATED BY CURRENT USER ("Shared by me")
router.get('/my-shares', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const shares = await prisma.fileShare.findMany({
      where: { createdById: req.user.id },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            isDeleted: true,
          },
        },
        sharedWithUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      shares: shares.map((s) => ({
        id: s.id,
        fileId: s.fileId,
        fileName: s.file.name,
        fileSize: s.file.size,
        mimeType: s.file.mimeType,
        fileIsDeleted: s.file.isDeleted,
        shareToken: s.shareToken,
        shareType: s.shareType,
        permission: s.permission,
        sharedWithEmail: s.sharedWithEmail || s.sharedWithUser?.email || null,
        expiresAt: s.expiresAt,
        maxDownloads: s.maxDownloads,
        currentDownloads: s.currentDownloads,
        isRevoked: s.isRevoked,
        hasPassword: !!s.passwordHash,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('List my shares error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve your shares.' });
  }
});

// 3. LIST SHARES RECEIVED BY CURRENT USER ("Shared with me")
router.get('/shared-with-me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const shares = await prisma.fileShare.findMany({
      where: {
        sharedWithUserId: req.user.id,
        isRevoked: false,
        file: { isDeleted: false },
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            isEncrypted: true,
            isE2EE: true,
            createdAt: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, shares });
  } catch (error) {
    console.error('List shared with me error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shared files.' });
  }
});

// 4. REVOKE A SHARE LINK
router.patch('/:id/revoke', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const share = await prisma.fileShare.findFirst({
      where: { id: String(id), createdById: req.user.id },
      include: { file: true },
    });

    if (!share) {
      res.status(404).json({ success: false, message: 'Share link not found.' });
      return;
    }

    const updated = await prisma.fileShare.update({
      where: { id: String(id) },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'SHARE_REVOKED',
      resourceType: 'SHARE',
      resourceId: String(id),
      details: { fileId: share.fileId, filename: share.file.name },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Share link has been revoked.', share: updated });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke share link.' });
  }
});

// 5. DELETE A SHARE RECORD
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const share = await prisma.fileShare.findFirst({
      where: { id: String(id), createdById: req.user.id },
    });

    if (!share) {
      res.status(404).json({ success: false, message: 'Share link not found.' });
      return;
    }

    await prisma.fileShare.delete({ where: { id: String(id) } });

    res.json({ success: true, message: 'Share record deleted.' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete share.' });
  }
});

// 6. PUBLIC: GET SHARE METADATA BY TOKEN
router.get('/public/:token', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const share = await prisma.fileShare.findUnique({
      where: { shareToken: String(token) },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            isEncrypted: true,
            isE2EE: true,
            isQuarantined: true,
            isDeleted: true,
          },
        },
        createdBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!share || share.file.isDeleted) {
      res.status(404).json({ success: false, message: 'Shared file not found or has been removed.' });
      return;
    }

    if (share.isRevoked) {
      res.status(410).json({
        success: false,
        isRevoked: true,
        message: 'This sharing link has been revoked by the owner.',
      });
      return;
    }

    const isExpired = share.expiresAt ? new Date() > share.expiresAt : false;
    if (isExpired) {
      res.status(410).json({
        success: false,
        isExpired: true,
        message: 'This sharing link has expired.',
      });
      return;
    }

    const isLimitReached = share.maxDownloads ? share.currentDownloads >= share.maxDownloads : false;
    if (isLimitReached) {
      res.status(410).json({
        success: false,
        isLimitReached: true,
        message: 'Maximum download limit has been reached for this link.',
      });
      return;
    }

    if (share.shareType === 'SPECIFIC_USER') {
      if (!req.user || req.user.id !== share.sharedWithUserId) {
        res.status(403).json({
          success: false,
          requiresAuth: true,
          message: 'This file is shared exclusively with a specific user. Please log in with the authorized account.',
        });
        return;
      }
    }

    res.json({
      success: true,
      share: {
        token: share.shareToken,
        fileName: share.file.name,
        fileSize: share.file.size,
        mimeType: share.file.mimeType,
        isE2EE: share.file.isE2EE,
        permission: share.permission,
        requiresPassword: !!share.passwordHash,
        expiresAt: share.expiresAt,
        maxDownloads: share.maxDownloads,
        currentDownloads: share.currentDownloads,
        ownerName: share.createdBy.fullName,
      },
    });
  } catch (error) {
    console.error('Get public share metadata error:', error);
    res.status(500).json({ success: false, message: 'Failed to access shared link.' });
  }
});

// 7. PUBLIC: VERIFY SHARE PASSWORD
router.post('/public/:token/verify-password', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const share = await prisma.fileShare.findUnique({
      where: { shareToken: String(token) },
    });

    if (!share || share.isRevoked) {
      res.status(404).json({ success: false, message: 'Share link invalid or revoked.' });
      return;
    }

    if (!share.passwordHash) {
      res.json({ success: true, message: 'No password required.' });
      return;
    }

    if (!password) {
      res.status(400).json({ success: false, message: 'Password is required.' });
      return;
    }

    const isValid = await CryptoService.verifyPassword(password, share.passwordHash);
    if (!isValid) {
      await AuditService.log({
        action: 'SHARE_PASSWORD_FAILED',
        resourceType: 'SHARE',
        resourceId: share.id,
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
        status: 'WARNING',
      });
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    }

    const accessToken = jwt.sign(
      { shareId: share.id, shareToken: share.shareToken, authorized: true },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'Password verified successfully.',
      accessToken,
    });
  } catch (error) {
    console.error('Verify share password error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify password.' });
  }
});

// 8. PUBLIC: DOWNLOAD / PREVIEW VIA SHARE LINK
router.get(
  '/public/:token/download',
  publicDownloadRateLimiter,
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { accessToken, inline } = req.query;

      const share = await prisma.fileShare.findUnique({
        where: { shareToken: String(token) },
        include: { file: true },
      });

      if (!share || share.file.isDeleted) {
        res.status(404).json({ success: false, message: 'Share link not found.' });
        return;
      }

      if (share.isRevoked) {
        res.status(410).json({ success: false, message: 'Share link has been revoked.' });
        return;
      }

      if (share.expiresAt && new Date() > share.expiresAt) {
        res.status(410).json({ success: false, message: 'Share link has expired.' });
        return;
      }

      if (share.maxDownloads && share.currentDownloads >= share.maxDownloads) {
        res.status(410).json({ success: false, message: 'Maximum download limit reached for this link.' });
        return;
      }

      if (share.shareType === 'SPECIFIC_USER') {
        if (!req.user || req.user.id !== share.sharedWithUserId) {
          res.status(403).json({ success: false, message: 'Unauthorized. You must be logged in as the designated recipient.' });
          return;
        }
      }

      if (share.passwordHash) {
        let authorized = false;
        if (accessToken) {
          try {
            const payload: any = jwt.verify(String(accessToken), config.jwtSecret);
            if (payload.shareId === share.id && payload.authorized) {
              authorized = true;
            }
          } catch {
            authorized = false;
          }
        }

        if (!authorized) {
          res.status(401).json({ success: false, message: 'Password verification required to access this file.' });
          return;
        }
      }

      if (share.file.isQuarantined) {
        res.status(403).json({ success: false, message: 'This file is quarantined due to safety concerns.' });
        return;
      }

      const isInlineRequest = inline === 'true' || share.permission === 'VIEW_ONLY';
      if (share.permission === 'VIEW_ONLY' && inline === 'false') {
        res.status(403).json({ success: false, message: 'This link grants view-only permissions.' });
        return;
      }

      const updatedShare = await prisma.fileShare.update({
        where: { id: share.id },
        data: { currentDownloads: { increment: 1 } },
      });

      if (updatedShare.maxDownloads && updatedShare.currentDownloads >= updatedShare.maxDownloads) {
        await prisma.fileShare.update({
          where: { id: share.id },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      const storageProvider = StorageService.getProvider();
      const encryptedBuffer = await storageProvider.get(share.file.storageKey);

      let outputBuffer: Buffer;
      if (share.file.isE2EE) {
        outputBuffer = encryptedBuffer;
      } else {
        if (!share.file.encryptionIv || !share.file.encryptionAuthTag || !share.file.dekEncrypted) {
          throw new Error('Encryption components missing');
        }
        outputBuffer = CryptoService.decryptFileBuffer(
          encryptedBuffer,
          share.file.encryptionIv,
          share.file.encryptionAuthTag,
          share.file.dekEncrypted
        );
      }

      await prisma.downloadEvent.create({
        data: {
          fileId: share.file.id,
          shareId: share.id,
          userId: req.user?.id || null,
          ipAddress: req.ip || 'unknown',
          userAgent: getUserAgent(req),
        },
      });

      await AuditService.log({
        userId: req.user?.id || null,
        action: 'SHARE_DOWNLOAD',
        resourceType: 'SHARE',
        resourceId: share.id,
        details: {
          fileId: share.file.id,
          filename: share.file.name,
          currentDownloads: updatedShare.currentDownloads,
          maxDownloads: updatedShare.maxDownloads,
        },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
      });

      res.setHeader('Content-Type', share.file.mimeType);
      res.setHeader('Content-Length', outputBuffer.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

      const disposition = isInlineRequest ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(share.file.name)}"`);

      res.send(outputBuffer);
    } catch (error) {
      console.error('Public download error:', error);
      res.status(500).json({ success: false, message: 'Failed to download shared file.' });
    }
  }
);

export default router;
