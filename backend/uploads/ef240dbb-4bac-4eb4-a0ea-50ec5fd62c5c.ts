import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log all errors for debugging
  console.error(`[ERROR] ${_req.method} ${_req.path} → ${err.constructor.name}: ${err.message}`);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: Object.keys(err.errors).length > 0 ? err.errors : undefined,
    });
    return;
  }

  // Check for Zod errors (instanceof + name check for hot-reload safety)
  if (err instanceof ZodError || (err.name === 'ZodError' && 'issues' in err)) {
    const zodErr = err as ZodError;
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of zodErr.issues) {
      const key = issue.path.join('.');
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors,
    });
    return;
  }

  console.error('Unhandled error stack:', err.stack);

  res.status(500).json({
    success: false,
    message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
