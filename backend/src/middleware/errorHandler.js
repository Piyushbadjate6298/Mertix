import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, `API route not found: ${req.method} ${req.path}`, 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  const uploadStatus = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.code?.startsWith?.('LIMIT_') ? 400 : null;
  const status = error.status || uploadStatus || (error.code === '23505' ? 409 : 500);
  if (error.code === 'LIMIT_FILE_SIZE') error.message = 'The uploaded file exceeds the 12 MB limit';
  const publicMessage = status >= 500 ? 'Internal server error' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: publicMessage } });
}
