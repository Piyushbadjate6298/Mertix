import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';

const env = {
  frontendOrigins: ['http://localhost:5173'],
  jwtSecret: 'test-secret-that-is-definitely-longer-than-32-characters',
  jwtExpiresIn: '1h',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 100,
  submissionRateLimitMax: 100,
};
const student = { id: 'student-test', name: 'Test Student', email: 'student@example.com', role: 'student', target: 'JEE Main' };

function makeService(overrides = {}) {
  return {
    health: async () => ({ database: 'connected' }),
    registerUser: async (input) => ({ id: 'student-new', role: 'student', ...input, password: undefined }),
    login: async () => student,
    findUserById: async () => student,
    listExams: async () => [],
    listQuestions: async () => [],
    studentDashboard: async () => ({ registrations: [], attempts: [], rewards: [] }),
    demoWallet: async () => ({ mode: 'demo', availableBalance: 0, transactions: [] }),
    registerExam: async () => ({ registration: { id: 'reg-1' }, payment: { id: 'pay-1' } }),
    paymentConfiguration: () => ({ configured: false, mode: 'test' }),
    createPaymentOrder: async () => ({ free: false, keyId: 'rzp_test_public', order: { id: 'order-1', amount: 49900, currency: 'INR' } }),
    verifyPayment: async () => ({ enrollmentConfirmed: true, payment: { paymentId: 'pay-rzp-1' } }),
    markPaymentFailed: async () => ({ id: 'pay-1', status: 'failed' }),
    processPaymentWebhook: async () => ({ received: true }),
    startAttempt: async () => ({ id: 'attempt-1' }),
    saveAttempt: async () => ({ id: 'attempt-1' }),
    submitAttempt: async () => ({ id: 'attempt-1', status: 'submitted' }),
    listPapers: async () => [],
    createPaper: async () => ({ id: 'paper-1' }),
    adminOverview: async () => ({}),
    approvePaper: async () => ({ id: 'paper-1' }),
    updateExamStatus: async () => ({ id: 'exam-1' }),
    createSupportTicket: async (_id, input) => ({ id: 'ticket-1', ...input }),
    listSupportTickets: async () => [],
    ...overrides,
  };
}

function makeApp(service = makeService(), emailService = { sendSupportNotification: async () => ({ status: 'skipped' }) }, customEnv = env) {
  return createApp({ service, emailService, env: customEnv });
}

test('health endpoint confirms API and database readiness', async () => {
  const response = await request(makeApp()).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.database, 'connected');
});

test('registration accepts valid data and rejects invalid data', async () => {
  const app = makeApp();
  const valid = await request(app).post('/api/auth/register').send({ name: 'Riya Singh', email: 'riya@example.com', password: 'StrongPass123', target: 'NEET UG' });
  assert.equal(valid.status, 201);
  const invalid = await request(app).post('/api/auth/register').send({ name: '', email: 'bad', password: 'short' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});

test('unapproved CORS origin is rejected', async () => {
  const response = await request(makeApp()).get('/api/health').set('Origin', 'https://unapproved.example');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CORS_REJECTED');
});

test('database failures return a safe public error', async () => {
  const response = await request(makeApp(makeService({ registerUser: async () => { throw new Error('postgres password leaked'); } })))
    .post('/api/auth/register').send({ name: 'Riya Singh', email: 'riya@example.com', password: 'StrongPass123', target: 'NEET UG' });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.message, 'Internal server error');
  assert.doesNotMatch(JSON.stringify(response.body), /postgres password/i);
});

test('support ticket remains successful when optional email delivery fails', async () => {
  const token = jwt.sign({ role: 'student' }, env.jwtSecret, { subject: student.id, expiresIn: '1h' });
  const response = await request(makeApp(makeService(), { sendSupportNotification: async () => { throw new Error('provider unavailable'); } }))
    .post('/api/support').set('Authorization', `Bearer ${token}`).send({ subject: 'Exam issue', message: 'The timer stopped during my practice attempt.' });
  assert.equal(response.status, 201);
  assert.equal(response.body.ticket.id, 'ticket-1');
  assert.equal(response.body.emailNotification, 'failed');
});

test('submission rate limiting blocks repeated public form requests', async () => {
  const limitedEnv = { ...env, submissionRateLimitMax: 2 };
  const app = makeApp(makeService(), { sendSupportNotification: async () => ({ status: 'skipped' }) }, limitedEnv);
  const input = { name: 'Riya Singh', email: 'riya@example.com', password: 'StrongPass123', target: 'NEET UG' };
  assert.equal((await request(app).post('/api/auth/register').send(input)).status, 201);
  assert.equal((await request(app).post('/api/auth/register').send(input)).status, 201);
  assert.equal((await request(app).post('/api/auth/register').send(input)).status, 429);
});

test('payment configuration never exposes private Razorpay credentials', async () => {
  const response = await request(makeApp()).get('/api/payments/configuration');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true, configured: false, mode: 'test' });
  assert.doesNotMatch(JSON.stringify(response.body), /secret|webhook/i);
});

test('payment order and verification endpoints require a student session', async () => {
  assert.equal((await request(makeApp()).post('/api/payments/orders').send({ examId: 'exam-1' })).status, 401);
  const token = jwt.sign({ role: 'student' }, env.jwtSecret, { subject: student.id, expiresIn: '1h' });
  const order = await request(makeApp()).post('/api/payments/orders').set('Authorization', `Bearer ${token}`).send({ examId: 'exam-1' });
  assert.equal(order.status, 201);
  assert.equal(order.body.keyId, 'rzp_test_public');
  const verified = await request(makeApp()).post('/api/payments/verify').set('Authorization', `Bearer ${token}`).send({ razorpayOrderId: 'order-1', razorpayPaymentId: 'pay-1', razorpaySignature: 'a'.repeat(64) });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.enrollmentConfirmed, true);
});

test('demo wallet is private to the authenticated student', async () => {
  const studentToken = jwt.sign({ role: 'student' }, env.jwtSecret, { subject: student.id, expiresIn: '1h' });
  const admin = { ...student, id: 'admin-test', role: 'admin' };
  const adminToken = jwt.sign({ role: 'admin' }, env.jwtSecret, { subject: admin.id, expiresIn: '1h' });
  const app = makeApp(makeService({ findUserById: async (id) => id === admin.id ? admin : student }));
  assert.equal((await request(app).get('/api/me/wallet')).status, 401);
  assert.equal((await request(app).get('/api/me/wallet').set('Authorization', `Bearer ${studentToken}`)).status, 200);
  assert.equal((await request(app).get('/api/me/wallet').set('Authorization', `Bearer ${adminToken}`)).status, 403);
});

test('Google sign-in fails closed until a client ID is configured', async () => {
  const response = await request(makeApp(makeService(), undefined, { ...env, googleClientId: '' }))
    .post('/api/auth/google').send({ credential: 'x'.repeat(80), target: 'JEE Main' });
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'GOOGLE_AUTH_NOT_CONFIGURED');
});

test('admin course artwork accepts supported uploads and rejects unsupported formats', async () => {
  const admin = { ...student, id: 'admin-test', role: 'admin' };
  const service = makeService({
    findUserById: async () => admin,
    saveCourse: async (_actorId, input) => ({ id: 'course-test', ...input }),
  });
  const token = jwt.sign({ role: 'admin' }, env.jwtSecret, { subject: admin.id, expiresIn: '1h' });
  const base = { slug: 'test-course', name: 'Test Course', category: 'Engineering Entrance', examType: 'JEE Main', shortDescription: '', fullDescription: '', bannerImageUrl: null, fee: 499, discountPercent: 0, durationDays: 180, mockTestCount: 1, status: 'published', visible: true, featured: true, displayOrder: 1 };
  const valid = await request(makeApp(service)).post('/api/admin/courses').set('Authorization', `Bearer ${token}`).send({ ...base, imageUrl: 'data:image/webp;base64,UklGRg==' });
  assert.equal(valid.status, 201);
  assert.equal(valid.body.course.imageUrl, 'data:image/webp;base64,UklGRg==');
  const invalid = await request(makeApp(service)).post('/api/admin/courses').set('Authorization', `Bearer ${token}`).send({ ...base, imageUrl: 'data:image/gif;base64,R0lGODlh' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});

test('Razorpay webhook receives the raw JSON body and signature header', async () => {
  let observed;
  const service = makeService({ processPaymentWebhook: async (signature, body) => { observed = { signature, isBuffer: Buffer.isBuffer(body), body: body.toString('utf8') }; return { received: true }; } });
  const payload = JSON.stringify({ event: 'payment.captured' });
  const response = await request(makeApp(service)).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'signed').send(payload);
  assert.equal(response.status, 200);
  assert.deepEqual(observed, { signature: 'signed', isBuffer: true, body: payload });
});
