import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();

const getUserAgent = (req: Request): string => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || 'Unknown';
};

const createFolderSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*]+$/, 'Invalid folder name characters'),
  parentId: z.string().uuid().optional().nullable(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*]+$/).optional(),
  parentId: z.string().uuid().optional().nullable(),
});

// 1. CREATE FOLDER
router.post('/', authenticate, validateBody(createFolderSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { name, parentId } = req.body;

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: String(parentId), ownerId: req.user.id, isDeleted: false },
      });
      if (!parent) {
        res.status(404).json({ success: false, message: 'Parent folder not found.' });
        return;
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId ? String(parentId) : null,
        ownerId: req.user.id,
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'FOLDER_CREATE',
      resourceType: 'FOLDER',
      resourceId: folder.id,
      details: { name, parentId },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.status(201).json({ success: true, folder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to create folder.' });
  }
});

// 2. LIST FOLDERS
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { parentId } = req.query;

    const whereClause: any = {
      ownerId: req.user.id,
      isDeleted: false,
    };

    if (parentId !== undefined) {
      whereClause.parentId = parentId === 'root' || parentId === '' ? null : String(parentId);
    }

    const folders = await prisma.folder.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            files: { where: { isDeleted: false } },
            subfolders: { where: { isDeleted: false } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, folders });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch folders.' });
  }
});

// 3. RENAME / MOVE FOLDER
router.patch('/:id', authenticate, validateBody(updateFolderSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;
    const { name, parentId } = req.body;

    const folder = await prisma.folder.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
    });

    if (!folder) {
      res.status(404).json({ success: false, message: 'Folder not found.' });
      return;
    }

    if (parentId && parentId === id) {
      res.status(400).json({ success: false, message: 'A folder cannot be its own parent.' });
      return;
    }

    const updated = await prisma.folder.update({
      where: { id: String(id) },
      data: {
        ...(name && { name }),
        ...(parentId !== undefined && { parentId: parentId ? String(parentId) : null }),
      },
    });

    await AuditService.log({
      userId: req.user.id,
      action: 'FOLDER_UPDATE',
      resourceType: 'FOLDER',
      resourceId: String(id),
      details: { name, parentId },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, folder: updated });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to update folder.' });
  }
});

// 4. DELETE FOLDER
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;
    const { id } = req.params;

    const folder = await prisma.folder.findFirst({
      where: { id: String(id), ownerId: req.user.id, isDeleted: false },
    });

    if (!folder) {
      res.status(404).json({ success: false, message: 'Folder not found.' });
      return;
    }

    await prisma.$transaction([
      prisma.folder.update({
        where: { id: String(id) },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
      prisma.file.updateMany({
        where: { folderId: String(id) },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
    ]);

    await AuditService.log({
      userId: req.user.id,
      action: 'FOLDER_DELETE',
      resourceType: 'FOLDER',
      resourceId: String(id),
      details: { name: folder.name },
      ipAddress: req.ip,
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, message: 'Folder and contents moved to trash.' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder.' });
  }
});

export default router;
