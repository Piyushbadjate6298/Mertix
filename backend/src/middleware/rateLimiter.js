import { rateLimit } from 'express-rate-limit';

const handler = (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
export const createGeneralLimiter = (env) => rateLimit({ windowMs: env.rateLimitWindowMs, limit: env.rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false, handler });
export const createSubmissionLimiter = (env) => rateLimit({ windowMs: env.rateLimitWindowMs, limit: env.submissionRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false, handler });
