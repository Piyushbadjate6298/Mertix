import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, `API route not found: ${req.method} ${req.path}`, 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || (error.code === '23505' ? 409 : 500);
  const publicMessage = status >= 500 ? 'Internal server error' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: publicMessage } });
}
