import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

export function createAuthMiddleware({ env, service }) {
  const authenticate = async (req, _res, next) => {
    const value = req.get('authorization') || '';
    const token = value.startsWith('Bearer ') ? value.slice(7) : '';
    if (!token) return next(new AppError(401, 'Please sign in', 'AUTH_REQUIRED'));
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await service.findUserById(payload.sub);
      if (!user) throw new Error('Unknown user');
      req.user = user;
      next();
    } catch {
      next(new AppError(401, 'Your session is invalid or expired', 'INVALID_SESSION'));
    }
  };
  const optionalAuthenticate = async (req, _res, next) => {
    const value = req.get('authorization') || '';
    const token = value.startsWith('Bearer ') ? value.slice(7) : '';
    if (!token) {
      req.user = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await service.findUserById(payload.sub);
      req.user = user || null;
    } catch {
      req.user = null;
    }
    next();
  };
  const authorize = (...roles) => (req, _res, next) => roles.includes(req.user?.role) ? next() : next(new AppError(403, 'Not authorized for this action', 'FORBIDDEN'));
  return { authenticate, optionalAuthenticate, authorize };
}
