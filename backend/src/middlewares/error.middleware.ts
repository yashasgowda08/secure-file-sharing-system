import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Unhandled Application Error:', err);

  const statusCode = err.statusCode || (err.name === 'UnauthorizedError' ? 401 : 500);
  const message = err.isOperational ? err.message : 'An internal security or server error occurred.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && {
      stack: err.stack,
      rawError: err.message,
    }),
  });
};
