import { AppError } from '../utils/errors.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => issue.message).join('; ');
    return next(new AppError(400, detail || 'Invalid request', 'VALIDATION_ERROR'));
  }
  req.validatedBody = result.data;
  next();
};
