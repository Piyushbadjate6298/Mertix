import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { evaluate } from '../src/utils/evaluation.js';

const env = {
  frontendOrigins: ['http://localhost:5173'],
  jwtSecret: 'test-secret-that-is-definitely-longer-than-32-characters',
  jwtExpiresIn: '1h',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 100,
  submissionRateLimitMax: 100,
};

const candidate = {
  id: 'candidate-cam-proctor-1',
  name: 'Priya Patel',
  email: 'priya.patel@example.com',
  role: 'student',
  target: 'MH CET'
};

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function createMockService() {
  const users = { [candidate.id]: candidate };
  const mockQuestions = [
    {
      id: 'q1',
      text: 'What is the speed of light in vacuum?',
      options: ['3 x 10^8 m/s', '3 x 10^6 m/s', '3 x 10^10 m/s', '3 x 10^5 m/s'],
      correctOption: 0,
      correctOptions: [0],
      questionType: 'single_correct',
      subject: 'Physics',
      maximumMarks: 4,
    },
    {
      id: 'q2',
      text: 'What is the pH of pure water at 25°C?',
      options: ['5', '6', '7', '8'],
      correctOption: 2,
      correctOptions: [2],
      questionType: 'single_correct',
      subject: 'Chemistry',
      maximumMarks: 4,
    }
  ];

  let attemptState = {
    id: 'att-cam-proctor-1',
    studentId: candidate.id,
    examId: 'mht-cet-mock-01',
    examTitle: 'MH CET Engineering Mock',
    status: 'in_progress',
    answers: {},
    marked: [],
    result: null,
    questions: mockQuestions,
    questionSnapshot: mockQuestions,
    durationSeconds: 7200,
    startedAt: new Date(Date.now() - 100000).toISOString(),
    deadlineAt: new Date(Date.now() + 7100000).toISOString(),
    submittedAt: null,
    timeTaken: null,
    warningCount: 0,
    isFlagged: false,
    flagReason: null,
    terminationReason: null,
    terminatedAt: null,
    violationHistory: []
  };

  const warnings = [];

  return {
    findUserById: async (id) => users[id] || null,

    startAttempt: async (studentId, examId, acceptedInstructions, retake) => {
      if (attemptState.status === 'TERMINATED') {
        if (retake) {
          const err = new Error('This examination attempt has been permanently terminated due to proctoring violations and cannot be restarted or resumed.');
          err.status = 403;
          err.code = 'ATTEMPT_TERMINATED';
          throw err;
        }
        return { ...attemptState };
      }
      return { ...attemptState };
    },

    saveAttempt: async (studentId, { attemptId, answers, marked }) => {
      if (attemptState.status === 'TERMINATED') {
        const err = new Error('This examination attempt has been terminated. No further answers can be saved.');
        err.status = 409;
        err.code = 'ATTEMPT_TERMINATED';
        throw err;
      }
      attemptState.answers = { ...attemptState.answers, ...answers };
      attemptState.marked = marked || attemptState.marked;
      return { ...attemptState };
    },

    recordProctoringWarning: async (studentId, { attemptId, category, message, evidenceMetadata = {}, currentAnswers = null }) => {
      if (attemptState.status === 'TERMINATED') {
        return {
          warningNumber: 3,
          warningCount: 3,
          isFlagged: true,
          isTerminated: true,
          status: 'TERMINATED',
          terminationReason: attemptState.terminationReason,
          terminatedAt: attemptState.terminatedAt,
          attempt: { ...attemptState },
          result: attemptState.result,
          violationHistory: attemptState.violationHistory,
          message: 'Examination has already been terminated due to maximum violations reached'
        };
      }

      attemptState.warningCount = Math.min(3, attemptState.warningCount + 1);
      const warnNum = attemptState.warningCount;
      const isTerminated = warnNum >= 3;

      const record = {
        warningNumber: warnNum,
        category,
        description: message,
        timestamp: new Date().toISOString(),
        metadata: evidenceMetadata
      };
      warnings.push(record);
      attemptState.violationHistory = [...warnings];

      if (currentAnswers) {
        attemptState.answers = { ...attemptState.answers, ...currentAnswers };
      }

      if (!isTerminated) {
        attemptState.isFlagged = warnNum >= 2;
        return {
          warningNumber: warnNum,
          warningCount: warnNum,
          isFlagged: attemptState.isFlagged,
          isTerminated: false,
          status: 'in_progress',
          message
        };
      }

      // 3rd VIOLATION: TERMINATION
      const result = evaluate(
        mockQuestions,
        attemptState.answers,
        { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } }
      );

      attemptState.status = 'TERMINATED';
      attemptState.terminationReason = 'MAX_VIOLATIONS_REACHED';
      attemptState.terminatedAt = new Date().toISOString();
      attemptState.submittedAt = attemptState.terminatedAt;
      attemptState.timeTaken = 300;
      attemptState.result = result;
      attemptState.isFlagged = true;
      attemptState.flagReason = 'Proctoring violation: 3/3 warnings reached (MAX_VIOLATIONS_REACHED)';

      return {
        warningNumber: 3,
        warningCount: 3,
        isFlagged: true,
        isTerminated: true,
        status: 'TERMINATED',
        terminationReason: 'MAX_VIOLATIONS_REACHED',
        terminatedAt: attemptState.terminatedAt,
        attempt: { ...attemptState },
        result,
        violationHistory: attemptState.violationHistory,
        message: 'Warning 3/3: Maximum violation limit reached. Exam automatically terminated.'
      };
    },

    studentDashboard: async (studentId) => ({
      registrations: [],
      attempts: [{ ...attemptState }],
      enrolledCourses: [],
      wallet: { balance: 0, availableBalance: 0, lockedBalance: 0, currency: 'INR' },
      rewards: []
    }),
  };
}

test('Camera AI Proctoring: 1. Incident 1 - First black screen registers violation 1', async () => {
  const service = createMockService();
  const app = createApp({ env, service, db: {} });
  const token = signToken(candidate);

  const res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Black, obscured, or unusable camera feed detected.',
      evidenceMetadata: {
        code: 'BLACK_SCREEN',
        meanLuminance: 2.1,
        stdDev: 0.8,
        consecutiveFailures: 2,
      },
      currentAnswers: { q1: 0 }
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.warningCount, 1);
  assert.equal(res.body.isTerminated, false);
});

test('Camera AI Proctoring: 2. Incident 2 - Second black screen registers violation 2', async () => {
  const service = createMockService();
  const app = createApp({ env, service, db: {} });
  const token = signToken(candidate);

  // First black screen incident
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Black, obscured, or unusable camera feed detected.',
      evidenceMetadata: { code: 'BLACK_SCREEN', meanLuminance: 3.0 },
      currentAnswers: { q1: 0 }
    });

  // Black screen resolves, then second separate black screen incident occurs
  const res2 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 2/3 (FINAL WARNING): Black, obscured, or unusable camera feed detected.',
      evidenceMetadata: { code: 'BLACK_SCREEN', meanLuminance: 1.5, consecutiveFailures: 2 },
      currentAnswers: { q1: 0 }
    });

  assert.equal(res2.status, 201);
  assert.equal(res2.body.warningCount, 2);
  assert.equal(res2.body.isTerminated, false);
});

test('Camera AI Proctoring: 3. Incident 3 - Third black screen automatically terminates exam', async () => {
  const service = createMockService();
  const app = createApp({ env, service, db: {} });
  const token = signToken(candidate);

  // Strike 1
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Black screen.',
      evidenceMetadata: { code: 'BLACK_SCREEN' },
      currentAnswers: { q1: 0 }
    });

  // Strike 2
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 2/3: Black screen.',
      evidenceMetadata: { code: 'BLACK_SCREEN' },
      currentAnswers: { q1: 0, q2: 2 }
    });

  // Strike 3: Automatic termination
  const termRes = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'exam_rule_violation',
      message: 'Warning 3/3 (MAXIMUM VIOLATIONS REACHED): Black, obscured, or unusable camera feed detected.',
      evidenceMetadata: { code: 'BLACK_SCREEN', finalViolation: true },
      currentAnswers: { q1: 0, q2: 2 }
    });

  assert.equal(termRes.status, 201);
  assert.equal(termRes.body.warningCount, 3);
  assert.equal(termRes.body.isTerminated, true);
  assert.equal(termRes.body.status, 'TERMINATED');
  assert.equal(termRes.body.terminationReason, 'MAX_VIOLATIONS_REACHED');
  assert.ok(termRes.body.result, 'Evaluated result must be returned');
  assert.equal(termRes.body.result.score, 8); // q1 correct (4) + q2 correct (4)
  assert.equal(termRes.body.result.correct, 2);
  assert.equal(termRes.body.violationHistory.length, 3);
});

test('Camera AI Proctoring: 4. Face absence (FACE_NOT_DETECTED) and multiple faces (MULTIPLE_FACES) logging', async () => {
  const service = createMockService();
  const app = createApp({ env, service, db: {} });
  const token = signToken(candidate);

  // Face not detected
  const res1 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'face_not_visible',
      message: 'Warning 1/3: Face not detected in camera frame.',
      evidenceMetadata: { code: 'FACE_NOT_DETECTED', faceCount: 0 },
      currentAnswers: {}
    });

  assert.equal(res1.status, 201);
  assert.equal(res1.body.warningCount, 1);

  // Multiple faces detected
  const res2 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-cam-proctor-1',
      category: 'multiple_faces_or_device',
      message: 'Warning 2/3 (FINAL WARNING): Multiple faces detected in camera view.',
      evidenceMetadata: { code: 'MULTIPLE_FACES', faceCount: 2 },
      currentAnswers: {}
    });

  assert.equal(res2.status, 201);
  assert.equal(res2.body.warningCount, 2);
});

test('Camera AI Proctoring: 5. Terminated exam state is persisted on refresh via studentDashboard', async () => {
  const service = createMockService();
  const app = createApp({ env, service, db: {} });
  const token = signToken(candidate);

  // Trigger 3 warnings to terminate
  for (let i = 1; i <= 3; i++) {
    await request(app)
      .post('/api/proctoring/warning')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attemptId: 'att-cam-proctor-1',
        category: 'exam_rule_violation',
        message: `Warning ${i}/3.`,
        evidenceMetadata: { code: 'BLACK_SCREEN' },
        currentAnswers: { q1: 0 }
      });
  }

  // Dashboard endpoint (used on browser refresh) returns terminated status and result
  const dashRes = await request(app)
    .get('/api/me/dashboard')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(dashRes.status, 200);
  const myAttempt = dashRes.body.attempts.find(a => a.id === 'att-cam-proctor-1');
  assert.ok(myAttempt);
  assert.equal(myAttempt.status, 'TERMINATED');
  assert.equal(myAttempt.terminationReason, 'MAX_VIOLATIONS_REACHED');
  assert.ok(myAttempt.result);
  assert.equal(myAttempt.violationHistory.length, 3);
});
