import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadRateLimiter } from '../middlewares/rate-limiter.middleware';
import { CryptoService } from '../services/crypto.service';
import { FileSignatureService } from '../services/file-signature.service';
import { MalwareService } from '../services/malware.service';
import { StorageService } from '../services/storage.service';
import { AuditService } from '../services/audit.service';

const router = Router();

// Multer memory storage configuration with strict size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes,
  },
});

// Helper for safe user agent extraction
const getUserAgent = (req: Request): string => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || 'Unknown';
};

// 1. UPLOAD FILES (Supports multi-file and single-file)
router.post(
  '/upload',
  authenticate,
  uploadRateLimiter,
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) return;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ success: false, message: 'No files provided for upload.' });
        return;
      }

      const folderId = req.body.folderId ? String(req.body.folderId) : null;
      const isE2EE = req.body.isE2EE === 'true' || req.body.isE2EE === true;
      const e2eeMetadata = req.body.e2eeMetadata ? String(req.body.e2eeMetadata) : null;

      // Validate folder ownership if folderId is provided
      if (folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, ownerId: req.user.id, isDeleted: false },
        });
        if (!folder) {
          res.status(404).json({ success: false, message: 'Specified folder not found.' });
          return;
        }
      }

      // Check storage quota
      const totalNewBytes = files.reduce((acc, f) => acc + f.size, 0);
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return;

      if (user.storageUsed + totalNewBytes > user.storageLimit) {
        res.status(413).json({
          success: false,
          message: `Storage quota exceeded. Available: ${Math.max(
            0,
            user.storageLimit - user.storageUsed
          )} bytes. Requested: ${totalNewBytes} bytes.`,
        });
        return;
      }

      const storageProvider = StorageService.getProvider();
      const uploadedResults: any[] = [];

      for (const file of files) {
        // Sanitize original filename against path traversal
        const cleanOriginalName = file.originalname.replace(/[/\\?%*:|"<>]/g, '_');

        // 1. Magic number / File signature inspection
        const sigValidation = FileSignatureService.validate(
          file.buffer,
          file.mimetype,
          cleanOriginalName
        );

        if (sigValidation.isExecutable) {
          await AuditService.log({
            userId: req.user.id,
            action: 'FILE_UPLOAD_BLOCKED_EXECUTABLE',
            details: { filename: cleanOriginalName, reason: sigValidation.reason },
            ipAddress: req.ip,
            userAgent: getUserAgent(req),
            status: 'WARNING',
          });
          res.status(400).json({
            success: false,
            message: `Upload rejected: ${sigValidation.reason}`,
          });
          return;
        }

        // 2. Malware & Exploit scanning
        const malwareScan = MalwareService.scan(file.buffer, cleanOriginalName);
        const isQuarantined = malwareScan.isMalicious;
        const quarantineReason = malwareScan.reason || null;

        // 3. Storage Key generation
        const storageKey = `vault_${crypto.randomUUID()}.enc`;

        let bufferToStore: Buffer;
        let encryptionIv: string | null = null;
        let encryptionAuthTag: string | null = null;
        let dekEncrypted: string | null = null;
        let checksumSha256: string;

        if (isE2EE) {
          bufferToStore = file.buffer;
          checksumSha256 = CryptoService.computeChecksum(file.buffer);
        } else {
          const encryptedResult = CryptoService.encryptFileBuffer(file.buffer);
          bufferToStore = encryptedResult.encryptedBuffer;
          encryptionIv = encryptedResult.iv;
          encryptionAuthTag = encryptedResult.authTag;
          dekEncrypted = encryptedResult.dekEncrypted;
          checksumSha256 = encryptedResult.checksumSha256;
        }

        // 4. Save to private object storage
        await storageProvider.save(storageKey, bufferToStore);

        // 5. Create database record
        const fileRecord = await prisma.file.create({
          data: {
            name: cleanOriginalName,
            originalName: cleanOriginalName,
            mimeType: sigValidation.detectedMime || file.mimetype,
            size: file.size,
            storageKey,
            isEncrypted: true,
            encryptionIv,
            encryptionAuthTag,
            dekEncrypted,
            isE2EE,
            e2eeMetadata,
            checksumSha256,
            folderId,
            ownerId: req.user.id,
            isQuarantined,
            quarantineReason,
          },
        });

        // 6. Atomically update user storage used
        await prisma.user.update({
          where: { id: req.user.id },
          data: { storageUsed: { increment: file.size } },
        });

        await AuditService.log({
          userId: req.user.id,
          action: isQuarantined ? 'FILE_UPLOAD_QUARANTINED' : 'FILE_UPLOAD',
          resourceType: 'FILE',
          resourceId: fileRecord.id,
          details: {
            filename: cleanOriginalName,
            size: file.size,
            mime: fileRecord.mimeType,
            isE2EE,
            isQuarantined,
          },
          ipAddress: req.ip,
          userAgent: getUserAgent(req),
          status: isQuarantined ? 'WARNING' : 'SUCCESS',
        });

        uploadedResults.push({
          id: fileRecord.id,
          name: fileRecord.name,
          size: fileRecord.size,
          mimeType: fileRecord.mimeType,
          folderId: fileRecord.folderId,
          isEncrypted: fileRecord.isEncrypted,
          isE2EE: fileRecord.isE2EE,
          isQuarantined: fileRecord.isQuarantined,
          createdAt: fileRecord.createdAt,
        });
      }

      res.status(201).json({
        success: true,
        message: `Successfully processed and encrypted ${uploadedResults.length} file(s).`,
        files: uploadedResults,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ success: false, message: 'File upload failed.' });
    }
  }
);

// 2. LIST FILES (with search, sort, folder filter)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { folderId, search, sortBy = 'createdAt', sortOrder = 'desc', filter } = req.query;

    const where: any = {
      ownerId: req.user.id,
      isDeleted: false,
    };

    if (folderId !== undefined) {
      where.folderId = folderId === 'root' || folderId === '' ? null : String(folderId);
    }

    if (search) {
      where.name = { contains: String(search) };
    }

    if (filter === 'recent') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    }

    const orderBy: any = {};
    const validSortFields = ['name', 'size', 'createdAt', 'mimeType'];
    const field = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    orderBy[field] = order;

    const files = await prisma.file.findMany({
      where,
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        size: true,
        isEncrypted: true,
        isE2EE: true,
        e2eeMetadata: true,
        checksumSha256: true,
        folderId: true,
        isQuarantined: true,
        quarantineReason: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            shares: { where: { isRevoked: false } },
            downloadEvents: true,
          },
        },
      },
      orderBy,
    });

    res.json({ success: true, files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve files.' });
  }
});

// 3. GET FILE DETAILS
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
      include: {
        folder: { select: { id: true, name: true } },
        shares: {
          where: { isRevoked: false },
          select: {
            id: true,
            shareToken: true,
            shareType: true,
            permission: true,
            expiresAt: true,
            maxDownloads: true,
            currentDownloads: true,
            createdAt: true,
          },
        },
      },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    res.json({ success: true, file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve file details.' });
  }
});

// 4. DOWNLOAD / PREVIEW FILE (Authenticated Owner or Authorized User)
router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;
    const inline = req.query.inline === 'true';

    const file = await prisma.file.findFirst({
      where: { id: String(id), isDeleted: false },
      include: {
        shares: {
          where: {
            sharedWithUserId: req.user.id,
            isRevoked: false,
          },
        },
      },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    const isOwner = file.ownerId === req.user.id;
    const hasShareGrant = file.shares.length > 0;

    if (!isOwner && !hasShareGrant && req.user.role !== 'ADMIN') {
      await AuditService.log({
        userId: req.user.id,
        action: 'IDOR_ACCESS_DENIED',
        resourceType: 'FILE',
        resourceId: file.id,
        details: { filename: file.name },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
        status: 'WARNING',
      });
      res.status(403).json({ success: false, message: 'Access denied. You do not have permission to access this file.' });
      return;
    }

    if (file.isQuarantined && req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: `Access denied: File has been quarantined: ${file.quarantineReason}`,
      });
      return;
    }

    const storageProvider = StorageService.getProvider();
    const storedBuffer = await storageProvider.get(file.storageKey);

    let outputBuffer: Buffer;

    if (file.isE2EE) {
      outputBuffer = storedBuffer;
    } else {
      if (!file.encryptionIv || !file.encryptionAuthTag || !file.dekEncrypted) {
        throw new Error('Missing encryption metadata for encrypted file');
      }

      outputBuffer = CryptoService.decryptFileBuffer(
        storedBuffer,
        file.encryptionIv,
        file.encryptionAuthTag,
        file.dekEncrypted
      );
    }

    await prisma.downloadEvent.create({
      data: {
        fileId: file.id,
        userId: req.user.id,
        ipAddress: req.ip || 'unknown',
        userAgent: getUserAgent(req),
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: inline ? 'FILE_PREVIEW' : 'FILE_DOWNLOAD',
      resourceType: 'FILE',
      resourceId: file.id,
      details: { filename: file.name, isOwner, inline },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', outputBuffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

    const disposition = inline ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(file.name)}"`);

    res.send(outputBuffer);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ success: false, message: 'File download or decryption failed.' });
  }
});

// 5. GENERATE EXPIRING SIGNED DOWNLOAD LINK
router.get('/:id/signed-url', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;
    const expiresInSeconds = parseInt(String(req.query.expiresIn || '300'), 10);

    const file = await prisma.file.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    const expiresAt = Date.now() + Math.min(expiresInSeconds, 3600) * 1000;
    const payload = `${file.id}:${req.user.id}:${expiresAt}`;
    const signature = CryptoService.createHmacSignature(payload);

    const signedUrl = `/api/files/download-signed?fileId=${file.id}&userId=${req.user.id}&expiresAt=${expiresAt}&sig=${signature}`;

    res.json({
      success: true,
      signedUrl,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (error) {
    console.error('Generate signed URL error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate signed URL.' });
  }
});

// 6. DOWNLOAD VIA SIGNED EXPIRING URL
router.get('/download-signed', async (req: Request, res: Response) => {
  try {
    const { fileId, userId, expiresAt, sig } = req.query;

    if (!fileId || !userId || !expiresAt || !sig) {
      res.status(400).json({ success: false, message: 'Missing signed URL parameters.' });
      return;
    }

    const expTime = parseInt(String(expiresAt), 10);
    if (Date.now() > expTime) {
      res.status(401).json({ success: false, message: 'Signed download link has expired.' });
      return;
    }

    const payload = `${fileId}:${userId}:${expiresAt}`;
    const isValid = CryptoService.verifyHmacSignature(payload, String(sig));
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid or forged download signature.' });
      return;
    }

    const file = await prisma.file.findUnique({ where: { id: String(fileId) } });
    if (!file || file.isDeleted) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    if (file.isQuarantined) {
      res.status(403).json({ success: false, message: 'File is quarantined.' });
      return;
    }

    const storageProvider = StorageService.getProvider();
    const storedBuffer = await storageProvider.get(file.storageKey);

    let outputBuffer: Buffer;
    if (file.isE2EE) {
      outputBuffer = storedBuffer;
    } else {
      if (!file.encryptionIv || !file.encryptionAuthTag || !file.dekEncrypted) {
        throw new Error('Encryption components missing');
      }
      outputBuffer = CryptoService.decryptFileBuffer(
        storedBuffer,
        file.encryptionIv,
        file.encryptionAuthTag,
        file.dekEncrypted
      );
    }

    await prisma.downloadEvent.create({
      data: {
        fileId: file.id,
        userId: String(userId),
        ipAddress: req.ip || 'unknown',
        userAgent: getUserAgent(req),
      },
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', outputBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(outputBuffer);
  } catch (error) {
    console.error('Signed download error:', error);
    res.status(500).json({ success: false, message: 'Download failed.' });
  }
});

// 7. RENAME / MOVE FILE
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;
    const { name, folderId } = req.body;

    const file = await prisma.file.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: String(folderId), ownerId: req.user.id, isDeleted: false },
      });
      if (!folder) {
        res.status(404).json({ success: false, message: 'Target folder not found.' });
        return;
      }
    }

    const updated = await prisma.file.update({
      where: { id: String(id) },
      data: {
        ...(name && { name: String(name).replace(/[/\\?%*:|"<>]/g, '_') }),
        ...(folderId !== undefined && { folderId: folderId ? String(folderId) : null }),
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'FILE_UPDATE',
      resourceType: 'FILE',
      resourceId: String(id),
      details: { name, folderId },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, file: updated });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ success: false, message: 'Failed to update file.' });
  }
});

// 8. MOVE FILE TO TRASH (Soft delete)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    await prisma.file.update({
      where: { id: String(id) },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'FILE_TRASHED',
      resourceType: 'FILE',
      resourceId: String(id),
      details: { name: file.name },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'File moved to trash.' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Failed to move file to trash.' });
  }
});

// 9. RESTORE FILE FROM TRASH
router.post('/:id/restore', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: true },
    });

    if (!file) {
      res.status(404).json({ success: false, message: 'Trashed file not found.' });
      return;
    }

    await prisma.file.update({
      where: { id: String(id) },
      data: { isDeleted: false, deletedAt: null },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'FILE_RESTORED',
      resourceType: 'FILE',
      resourceId: String(id),
      details: { name: file.name },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'File restored successfully.' });
  } catch (error) {
    console.error('Restore file error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore file.' });
  }
});

// 10. LIST TRASH
router.get('/trash/list', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const files = await prisma.file.findMany({
      where: { ownerId: req.user.id, isDeleted: true },
      orderBy: { deletedAt: 'desc' },
    });

    res.json({ success: true, files });
  } catch (error) {
    console.error('List trash error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trashed files.' });
  }
});

// 11. EMPTY TRASH (Permanent Delete)
router.delete('/trash/empty', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const trashedFiles = await prisma.file.findMany({
      where: { ownerId: req.user.id, isDeleted: true },
    });

    const storageProvider = StorageService.getProvider();
    let freedBytes = 0;

    for (const file of trashedFiles) {
      await storageProvider.delete(file.storageKey);
      freedBytes += file.size;
    }

    await prisma.file.deleteMany({
      where: { ownerId: req.user.id, isDeleted: true },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        storageUsed: {
          decrement: freedBytes,
        },
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'TRASH_EMPTIED',
      details: { count: trashedFiles.length, freedBytes },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: `Permanently removed ${trashedFiles.length} file(s).` });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ success: false, message: 'Failed to empty trash.' });
  }
});

export default router;
