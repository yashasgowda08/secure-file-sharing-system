import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { AuditService } from '../services/audit.service';
import { StorageService } from '../services/storage.service';

const router = Router();

// Helper for safe user agent extraction
const getUserAgent = (req: Request): string => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || 'Unknown';
};

// Enforce ADMIN role for all routes in this router
router.use(authenticate);
router.use(requireRole('ADMIN'));

const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'AUDITOR']),
});

const updateQuotaSchema = z.object({
  storageLimit: z.number().int().positive(),
});

// 1. SYSTEM STATS & METRICS
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalFiles = await prisma.file.count({ where: { isDeleted: false } });
    const totalShares = await prisma.fileShare.count({ where: { isRevoked: false } });
    const totalDownloads = await prisma.downloadEvent.count();
    const quarantinedFiles = await prisma.file.count({ where: { isQuarantined: true } });

    // Aggregate storage used across all users
    const storageAggregate = await prisma.user.aggregate({
      _sum: { storageUsed: true },
    });
    const totalStorageBytes = storageAggregate._sum.storageUsed || 0;

    // Recent security alerts (failures/warnings)
    const securityAlerts = await prisma.auditLog.findMany({
      where: {
        status: { in: ['FAILURE', 'WARNING'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalFiles,
        totalShares,
        totalDownloads,
        quarantinedFiles,
        totalStorageBytes,
      },
      securityAlerts,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve admin statistics.' });
  }
});

// 2. LIST USERS
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { search, limit = '50' } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: String(search) } },
        { fullName: { contains: String(search) } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isVerified: true,
        isMfaEnabled: true,
        storageUsed: true,
        storageLimit: true,
        failedLoginAttempts: true,
        lockoutUntil: true,
        createdAt: true,
        _count: {
          select: {
            files: { where: { isDeleted: false } },
            sharesCreated: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(String(limit), 10) || 50, 100),
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

// 3. UPDATE USER ROLE
router.patch('/users/:id/role', validateBody(updateRoleSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Target user not found.' });
      return;
    }

    // Prevent removing admin role from oneself if only one admin left
    if (targetUser.id === req.user?.id && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        res.status(400).json({ success: false, message: 'Cannot demote the sole remaining administrator.' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { role },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await AuditService.log({
      userId: req.user?.id,
      action: 'ADMIN_ROLE_UPDATED',
      resourceType: 'USER',
      resourceId: String(id),
      details: { targetEmail: targetUser.email, oldRole: targetUser.role, newRole: role },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: `Role updated to ${role}`, user: updated });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update role.' });
  }
});

// 4. UPDATE USER STORAGE QUOTA
router.patch('/users/:id/quota', validateBody(updateQuotaSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { storageLimit } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { storageLimit },
      select: { id: true, email: true, storageLimit: true, storageUsed: true },
    });

    await AuditService.log({
      userId: req.user?.id,
      action: 'ADMIN_QUOTA_UPDATED',
      resourceType: 'USER',
      resourceId: String(id),
      details: { targetEmail: targetUser.email, oldQuota: targetUser.storageLimit, newQuota: storageLimit },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Storage quota adjusted.', user: updated });
  } catch (error) {
    console.error('Update quota error:', error);
    res.status(500).json({ success: false, message: 'Failed to update quota.' });
  }
});

// 5. SYSTEM-WIDE AUDIT LOGS
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { action, status, limit = '100' } = req.query;

    const where: any = {};
    if (action) where.action = String(action);
    if (status) where.status = String(status);

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { email: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(String(limit), 10) || 100, 200),
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Admin audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

// 6. QUARANTINED FILES MANAGEMENT
router.get('/quarantined', async (req: Request, res: Response) => {
  try {
    const files = await prisma.file.findMany({
      where: { isQuarantined: true, isDeleted: false },
      include: {
        owner: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, files });
  } catch (error) {
    console.error('Get quarantined files error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve quarantined files.' });
  }
});

// 7. RELEASE OR DELETE QUARANTINED FILE
router.post('/quarantined/:fileId/action', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { decision } = req.body; // 'RELEASE' or 'PURGE'

    const file = await prisma.file.findUnique({ where: { id: String(fileId) } });
    if (!file) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    if (decision === 'RELEASE') {
      await prisma.file.update({
        where: { id: String(fileId) },
        data: { isQuarantined: false, quarantineReason: null },
      });

      await AuditService.log({
        userId: req.user?.id,
        action: 'ADMIN_QUARANTINE_RELEASED',
        resourceType: 'FILE',
        resourceId: String(fileId),
        details: { filename: file.name },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, message: 'File released from quarantine.' });
    } else if (decision === 'PURGE') {
      const storageProvider = StorageService.getProvider();
      await storageProvider.delete(file.storageKey);

      await prisma.file.delete({ where: { id: String(fileId) } });

      await prisma.user.update({
        where: { id: file.ownerId },
        data: { storageUsed: { decrement: file.size } },
      });

      await AuditService.log({
        userId: req.user?.id,
        action: 'ADMIN_QUARANTINE_PURGED',
        resourceType: 'FILE',
        resourceId: String(fileId),
        details: { filename: file.name },
        ipAddress: req.ip,
        userAgent: getUserAgent(req),
      });

      res.json({ success: true, message: 'Malicious file permanently deleted.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid decision. Must be RELEASE or PURGE.' });
    }
  } catch (error) {
    console.error('Quarantine action error:', error);
    res.status(500).json({ success: false, message: 'Failed to process quarantine action.' });
  }
});

export default router;
