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
    registerExam: async () => ({ registration: { id: 'reg-1' }, payment: { id: 'pay-1' } }),
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
