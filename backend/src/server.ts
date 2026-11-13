import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import { generalRateLimiter } from './middlewares/rate-limiter.middleware';
import { errorHandler } from './middlewares/error.middleware';

import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/file.routes';
import folderRoutes from './routes/folder.routes';
import shareRoutes from './routes/share.routes';
import auditRoutes from './routes/audit.routes';
import adminRoutes from './routes/admin.routes';

export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // 2. Strict CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === config.corsOrigin ||
          origin === 'http://localhost:5173' ||
          origin === 'http://localhost:5000' ||
          origin === 'http://127.0.0.1:5000' ||
          origin === 'http://127.0.0.1:5173'
        ) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by Cross-Origin Resource Sharing policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Core parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // 4. Rate Limiting for general API endpoints
  app.use('/api', generalRateLimiter);

  // 5. Health Check Endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Secure File Vault API',
      version: '1.0.0',
    });
  });

  // 6. Mount API Route Modules
  app.use('/api/auth', authRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/shares', shareRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/admin', adminRoutes);

  // 7. Static Asset Serving (Frontend SPA)
  const clientDistPath =
    process.env.CLIENT_DIST_PATH ||
    (fs.existsSync(path.resolve(__dirname, '../../frontend/dist'))
      ? path.resolve(__dirname, '../../frontend/dist')
      : path.resolve(__dirname, './public'));

  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // 8. 404 Route Handler for unmatched API calls
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Requested API endpoint not found.' });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
};
