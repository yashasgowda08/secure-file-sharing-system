import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// GET PERSONAL USER AUDIT LOGS
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return;

    const { limit = '50', action } = req.query;

    const where: any = {
      userId: req.user.id,
    };

    if (action) {
      where.action = String(action);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(String(limit), 10) || 50, 100),
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
});

export default router;
