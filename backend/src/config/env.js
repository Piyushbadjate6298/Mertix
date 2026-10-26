import 'dotenv/config';

const asBoolean = (value, fallback = false) => value === undefined ? fallback : String(value).toLowerCase() === 'true';
const asNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getEnv(source = process.env) {
  const defaultOrigins = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';
  const origins = String(source.FRONTEND_URLS || source.FRONTEND_URL || defaultOrigins).split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean);
  return {
    nodeEnv: source.NODE_ENV || 'development',
    port: asNumber(source.PORT, 5000),
    host: source.HOST || '0.0.0.0',
    frontendOrigins: origins,
    databaseUrl: source.DATABASE_URL || '',
    databaseSsl: asBoolean(source.DATABASE_SSL, source.NODE_ENV === 'production'),
    jwtSecret: source.JWT_SECRET || '',
    jwtExpiresIn: source.JWT_EXPIRES_IN || '8h',
    seedDemoUsers: asBoolean(source.SEED_DEMO_USERS, source.NODE_ENV !== 'production'),
    rateLimitWindowMs: asNumber(source.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    rateLimitMax: asNumber(source.RATE_LIMIT_MAX, 100),
    submissionRateLimitMax: asNumber(source.SUBMISSION_RATE_LIMIT_MAX, 10),
    razorpay: {
      keyId: source.RAZORPAY_KEY_ID || 'rzp_test_TqtdqOM9ErWbPf',
      keySecret: source.RAZORPAY_KEY_SECRET || 'U5329NNscFFXaZ65L4WJ949N',
      webhookSecret: source.RAZORPAY_WEBHOOK_SECRET || '',
      mode: String(source.RAZORPAY_MODE || 'test').toLowerCase(),
    },
    smtp: {
      host: source.SMTP_HOST || '',
      port: asNumber(source.SMTP_PORT, 587),
      secure: asBoolean(source.SMTP_SECURE, false),
      user: source.SMTP_USER || '',
      password: source.SMTP_PASSWORD || '',
      from: source.EMAIL_FROM || '',
      supportTo: source.SUPPORT_TO_EMAIL || '',
    },
  };
}

export function assertServerEnv(env) {
  const missing = [];
  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (!env.jwtSecret || env.jwtSecret.length < 32) missing.push('JWT_SECRET (minimum 32 characters)');
  if (missing.length) throw new Error(`Missing or invalid environment configuration: ${missing.join(', ')}`);
}
