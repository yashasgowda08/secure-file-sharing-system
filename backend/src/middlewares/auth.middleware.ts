import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { CryptoService } from '../services/crypto.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isVerified: boolean;
  isMfaEnabled: boolean;
  storageUsed: number;
  storageLimit: number;
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: AuthenticatedSession;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.session_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. No session found.' });
      return;
    }

    const tokenHash = CryptoService.hashToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isVerified: true,
            isMfaEnabled: true,
            storageUsed: true,
            storageLimit: true,
          },
        },
      },
    });

    if (!session) {
      res.status(401).json({ success: false, message: 'Invalid or expired session.' });
      return;
    }

    if (session.revokedAt) {
      res.status(401).json({ success: false, message: 'Session has been revoked.' });
      return;
    }

    if (new Date() > session.expiresAt) {
      res.status(401).json({ success: false, message: 'Session has expired.' });
      return;
    }

    req.user = session.user;
    req.session = {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Internal server error in authentication.' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Requires one of the following roles: [${roles.join(', ')}]. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.session_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    const tokenHash = CryptoService.hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isVerified: true,
            isMfaEnabled: true,
            storageUsed: true,
            storageLimit: true,
          },
        },
      },
    });

    if (session && !session.revokedAt && new Date() <= session.expiresAt) {
      req.user = session.user;
      req.session = {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      };
    }

    next();
  } catch {
    next();
  }
};
