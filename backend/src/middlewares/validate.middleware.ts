import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.issues) {
        const issues = error.issues || error.errors || [];
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: issues.map((err: any) => ({
            field: Array.isArray(err.path) ? err.path.join('.') : String(err.path),
            message: err.message,
          })),
        });
        return;
      }
      res.status(400).json({ success: false, message: 'Invalid request data' });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed as any;
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.issues) {
        const issues = error.issues || error.errors || [];
        res.status(400).json({
          success: false,
          message: 'Query parameter validation failed',
          errors: issues.map((err: any) => ({
            field: Array.isArray(err.path) ? err.path.join('.') : String(err.path),
            message: err.message,
          })),
        });
        return;
      }
      res.status(400).json({ success: false, message: 'Invalid query parameters' });
    }
  };
};
