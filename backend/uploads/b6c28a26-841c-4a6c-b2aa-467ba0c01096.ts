import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';

const ALLOWED_CREATOR_EMAILS = [
  'admin@gmail.com',
  'nayanpatel@gmail.com',
  'dhruvik@gmail.com',
  'dhruviktra.rajput.1379@gmail.com',
  'admin@example.com'
];

/**
 * Middleware that restricts create/delete actions to allowed emails only.
 */
export const requireAllowedCreator = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || !ALLOWED_CREATOR_EMAILS.includes(req.user.email.toLowerCase())) {
    throw ApiError.forbidden('You do not have permission to perform this action');
  }
  next();
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
};
