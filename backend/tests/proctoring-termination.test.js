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

const student = {
  id: 'student-term-test-1',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  role: 'student',
  target: 'JEE Main'
};

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function mockProctoringService() {
  const users = { [student.id]: student };
  const mockQuestions = [
    {
      id: 'q1',
      text: 'What is the SI unit of electric current?',
      options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
      correctOption: 1,
      correctOptions: [1],
      questionType: 'single_correct',
      subject: 'Physics',
      maximumMarks: 4,
      scoringRule: { correct: 4, incorrect: -1, unanswered: 0 }
    },
    {
      id: 'q2',
      text: 'Which element has the atomic number 1?',
      options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'],
      correctOption: 1,
      correctOptions: [1],
      questionType: 'single_correct',
      subject: 'Chemistry',
      maximumMarks: 4,
      scoringRule: { correct: 4, incorrect: -1, unanswered: 0 }
    },
    {
      id: 'q3',
      text: 'What is the derivative of sin(x)?',
      options: ['-cos(x)', 'cos(x)', 'tan(x)', '-sin(x)'],
      correctOption: 1,
      correctOptions: [1],
      questionType: 'single_correct',
      subject: 'Mathematics',
      maximumMarks: 4,
      scoringRule: { correct: 4, incorrect: -1, unanswered: 0 }
    }
  ];

  const examConfig = {
    rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } },
    passingPercentage: 40
  };

  let attemptState = {
    id: 'att-proctor-term-1',
    studentId: student.id,
    examId: 'exam-jee-2026',
    examTitle: 'JEE Main Grand Mock 2026',
    status: 'in_progress',
    answers: {},
    marked: [],
    result: null,
    questions: mockQuestions,
    questionSnapshot: mockQuestions,
    durationSeconds: 10800,
    startedAt: new Date(Date.now() - 300000).toISOString(),
    deadlineAt: new Date(Date.now() + 10500000).toISOString(),
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
  let lastWarningTime = 0;

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
      if (attemptState.status === 'submitted') {
        if (retake) {
          attemptState.status = 'in_progress';
          attemptState.answers = {};
          attemptState.warningCount = 0;
          attemptState.isFlagged = false;
          attemptState.result = null;
          attemptState.terminationReason = null;
          attemptState.terminatedAt = null;
          attemptState.violationHistory = [];
          return { ...attemptState };
        }
        const err = new Error('Attempt already submitted');
        err.status = 409;
        err.code = 'ATTEMPT_SUBMITTED';
        throw err;
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
      if (attemptState.status !== 'in_progress') {
        const err = new Error('Active attempt not found');
        err.status = 404;
        err.code = 'ATTEMPT_NOT_FOUND';
        throw err;
      }
      attemptState.answers = { ...(attemptState.answers || {}), ...(answers || {}) };
      attemptState.marked = marked || [];
      attemptState.lastSavedAt = new Date().toISOString();
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
          terminationReason: attemptState.terminationReason || 'MAX_VIOLATIONS_REACHED',
          terminatedAt: attemptState.terminatedAt,
          attempt: { ...attemptState },
          result: attemptState.result,
          violationHistory: attemptState.violationHistory,
          message: 'Examination has already been terminated due to maximum violations reached'
        };
      }

      const now = Date.now();
      // Cooldown check (2.5s)
      if (warnings.length > 0 && now - lastWarningTime < 2500 && !evidenceMetadata.bypassCooldownForTest) {
        return {
          warningNumber: attemptState.warningCount,
          warningCount: attemptState.warningCount,
          isFlagged: attemptState.isFlagged,
          isTerminated: attemptState.warningCount >= 3,
          cooldownActive: true,
          message
        };
      }
      lastWarningTime = now;

      const newCount = Math.min(3, attemptState.warningCount + 1);
      const isFlagged = newCount >= 3;
      const isTerminated = newCount >= 3;
      attemptState.warningCount = newCount;
      attemptState.isFlagged = isFlagged;

      const record = {
        warningNumber: newCount,
        category,
        description: message,
        timestamp: new Date().toISOString(),
        metadata: evidenceMetadata
      };
      warnings.push(record);
      attemptState.violationHistory.push(record);

      if (!isTerminated) {
        attemptState.flagReason = null;
        return {
          warningNumber: newCount,
          warningCount: newCount,
          isFlagged: false,
          isTerminated: false,
          message
        };
      }

      // 3rd Violation: AUTOMATIC TERMINATION
      if (currentAnswers) {
        attemptState.answers = { ...attemptState.answers, ...currentAnswers };
      }
      const evaluated = evaluate(mockQuestions, attemptState.answers, examConfig);
      attemptState.status = 'TERMINATED';
      attemptState.terminationReason = 'MAX_VIOLATIONS_REACHED';
      attemptState.terminatedAt = new Date().toISOString();
      attemptState.submittedAt = attemptState.terminatedAt;
      attemptState.flagReason = 'Proctoring violation: 3/3 warnings reached (MAX_VIOLATIONS_REACHED)';
      attemptState.timeTaken = 300;
      attemptState.result = evaluated;

      return {
        warningNumber: 3,
        warningCount: 3,
        isFlagged: true,
        isTerminated: true,
        status: 'TERMINATED',
        terminationReason: 'MAX_VIOLATIONS_REACHED',
        terminatedAt: attemptState.terminatedAt,
        attempt: { ...attemptState },
        result: evaluated,
        violationHistory: [...attemptState.violationHistory],
        message: 'Warning 3/3: Maximum violation limit reached. Exam automatically terminated.'
      };
    },

    terminateAttempt: async (studentId, { attemptId, reason = 'MAX_VIOLATIONS_REACHED', answers = {} }) => {
      if (attemptState.status === 'TERMINATED') {
        return { ...attemptState };
      }
      attemptState.answers = { ...attemptState.answers, ...answers };
      const evaluated = evaluate(mockQuestions, attemptState.answers, examConfig);
      attemptState.status = 'TERMINATED';
      attemptState.terminationReason = reason;
      attemptState.terminatedAt = new Date().toISOString();
      attemptState.submittedAt = attemptState.terminatedAt;
      attemptState.warningCount = Math.max(attemptState.warningCount, 3);
      attemptState.isFlagged = true;
      attemptState.result = evaluated;
      return { ...attemptState };
    },

    submitAttempt: async (studentId, { attemptId, answers, isTermination = false, terminationReason }) => {
      if (attemptState.status === 'TERMINATED' || attemptState.status === 'submitted') {
        return { ...attemptState };
      }
      const merged = { ...attemptState.answers, ...answers };
      attemptState.answers = merged;
      const evaluated = evaluate(mockQuestions, merged, examConfig);
      if (isTermination) {
        attemptState.status = 'TERMINATED';
        attemptState.terminationReason = terminationReason || 'MAX_VIOLATIONS_REACHED';
        attemptState.terminatedAt = new Date().toISOString();
        attemptState.warningCount = Math.max(attemptState.warningCount, 3);
        attemptState.isFlagged = true;
      } else {
        attemptState.status = 'submitted';
      }
      attemptState.submittedAt = new Date().toISOString();
      attemptState.timeTaken = 300;
      attemptState.result = evaluated;
      return { ...attemptState };
    },

    studentDashboard: async () => ({
      registrations: [],
      attempts: [{ ...attemptState }],
      enrolledCourses: []
    })
  };
}

test('1. Exam starts with 0 violations and in_progress status', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  const res = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ examId: 'exam-jee-2026', acceptedInstructions: true })
    .expect(200);

  assert.equal(res.body.attempt.warningCount, 0, 'Initial violations counter must be 0');
  assert.equal(res.body.attempt.status, 'in_progress');
  assert.equal(res.body.attempt.isFlagged, false);
});

test('2. First violation displays warning and count becomes 1', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  const res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Switching browser tabs or minimizing the exam window is prohibited.',
      evidenceMetadata: { code: 'tab_switch', bypassCooldownForTest: true }
    })
    .expect(201);

  assert.equal(res.body.warningCount, 1, 'Warning count should be 1');
  assert.equal(res.body.warningNumber, 1);
  assert.equal(res.body.isFlagged, false, 'First violation must not flag session');
  assert.equal(res.body.isTerminated, false, 'First violation must not terminate exam');
});

test('3. Second violation displays final warning and count becomes 2', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // 1st violation
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Switching browser tabs.',
      evidenceMetadata: { code: 'tab_switch', bypassCooldownForTest: true }
    })
    .expect(201);

  // 2nd violation (Final Warning)
  const res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 2/3 (FINAL WARNING): Window blur or navigation away detected.',
      evidenceMetadata: { code: 'window_blur', bypassCooldownForTest: true }
    })
    .expect(201);

  assert.equal(res.body.warningCount, 2, 'Warning count should be 2');
  assert.equal(res.body.warningNumber, 2);
  assert.equal(res.body.isFlagged, false);
  assert.equal(res.body.isTerminated, false);
});

test('4. Third violation automatically terminates exam immediately', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Save 1 correct answer before termination
  await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      answers: { q1: 1 }, // Correct answer (Ampere)
      marked: []
    })
    .expect(200);

  // Violation 1
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 1/3: Tab switch detected.',
      evidenceMetadata: { code: 'tab_switch', bypassCooldownForTest: true }
    });

  // Violation 2
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 2/3 (FINAL WARNING): Fullscreen exited.',
      evidenceMetadata: { code: 'fullscreen_exit', bypassCooldownForTest: true }
    });

  // Violation 3: Immediate Automatic Termination
  const termRes = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Warning 3/3: Maximum violation limit reached. Exam terminated.',
      evidenceMetadata: { code: 'tab_switch', bypassCooldownForTest: true },
      currentAnswers: { q2: 1 } // Another correct answer saved right during termination
    })
    .expect(201);

  assert.equal(termRes.body.warningCount, 3);
  assert.equal(termRes.body.isFlagged, true);
  assert.equal(termRes.body.isTerminated, true);
  assert.equal(termRes.body.status, 'TERMINATED');
  assert.equal(termRes.body.terminationReason, 'MAX_VIOLATIONS_REACHED');
  assert.ok(termRes.body.terminatedAt, 'Must record termination timestamp');
});

test('5. Timer stops immediately and elapsed time is recorded', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Direct terminate call
  const res = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      reason: 'MAX_VIOLATIONS_REACHED',
      answers: { q1: 1 }
    })
    .expect(200);

  assert.equal(res.body.attempt.status, 'TERMINATED');
  assert.ok(res.body.attempt.terminatedAt);
  assert.ok(res.body.attempt.submittedAt);
  assert.ok(res.body.attempt.timeTaken >= 0);
});

test('6. Answers are preserved and saved before submission upon termination', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Pre-save answer for q1
  await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', answers: { q1: 1 }, marked: [] })
    .expect(200);

  // Terminate with additional answer for q2
  const termRes = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      reason: 'MAX_VIOLATIONS_REACHED',
      answers: { q2: 1 }
    })
    .expect(200);

  assert.equal(termRes.body.attempt.answers['q1'], 1, 'Previous answer q1 must be retained');
  assert.equal(termRes.body.attempt.answers['q2'], 1, 'New answer q2 must be saved');
});

test('7. Result is calculated and displayed with official scoring rules', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Terminate with 2 correct answers (q1: 1, q2: 1) and 1 unattempted (q3)
  const termRes = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      reason: 'MAX_VIOLATIONS_REACHED',
      answers: { q1: 1, q2: 1 }
    })
    .expect(200);

  const result = termRes.body.attempt.result;
  assert.ok(result, 'Result object must be present');
  assert.equal(result.total, 3, 'Total questions should be 3');
  assert.equal(result.attempted, 2, 'Attempted questions should be 2');
  assert.equal(result.correct, 2, 'Correct questions should be 2');
  assert.equal(result.incorrect, 0, 'Incorrect questions should be 0');
  assert.equal(result.unattempted, 1, 'Unanswered questions should be 1');
  assert.equal(result.score, 8, '2 correct * 4 marks = 8 marks');
  assert.equal(result.maximumMarks, 12, '3 questions * 4 marks = 12 marks');
});

test('8. Refreshing browser keeps exam TERMINATED and prevents retaking or resuming', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Terminate attempt
  await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', reason: 'MAX_VIOLATIONS_REACHED' })
    .expect(200);

  // 1. Candidate refreshes browser and client queries dashboard / attempts
  const dashboard = await service.studentDashboard();
  const candidateAttempt = dashboard.attempts.find((a) => a.id === 'att-proctor-term-1');
  assert.equal(candidateAttempt.status, 'TERMINATED');
  assert.equal(candidateAttempt.terminationReason, 'MAX_VIOLATIONS_REACHED');

  // 2. Candidate attempts to start / resume without retake flag -> returns TERMINATED attempt
  const startAgain = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ examId: 'exam-jee-2026', acceptedInstructions: true })
    .expect(200);
  assert.equal(startAgain.body.attempt.status, 'TERMINATED');

  // 3. Candidate attempts to force a retake -> strictly forbidden with 403
  await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ examId: 'exam-jee-2026', acceptedInstructions: true, retake: true })
    .expect(403);

  // 4. Candidate attempts to submit more answers after termination -> rejected with 409
  await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', answers: { q3: 1 }, marked: [] })
    .expect(409);
});

test('9. Multiple violation events and duplicate submissions are idempotent', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Terminate once
  const first = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', reason: 'MAX_VIOLATIONS_REACHED', answers: { q1: 1 } })
    .expect(200);

  // Repeat termination call (idempotent)
  const second = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', reason: 'MAX_VIOLATIONS_REACHED', answers: { q1: 1 } })
    .expect(200);

  assert.equal(first.body.attempt.status, 'TERMINATED');
  assert.equal(second.body.attempt.status, 'TERMINATED');

  // Submitting via /attempts/submit on terminated attempt returns safely without error
  const submitCall = await request(app)
    .post('/api/attempts/submit')
    .set('Authorization', `Bearer ${token}`)
    .send({ attemptId: 'att-proctor-term-1', answers: {} })
    .expect(200);
  assert.equal(submitCall.body.attempt.status, 'TERMINATED');
});

test('10. Violation history contains all 3 violation descriptions and timestamps', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Violation 1
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Violation 1: Tab switch detected.',
      evidenceMetadata: { code: 'tab_switch', bypassCooldownForTest: true }
    });

  // Violation 2
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'face_not_visible',
      message: 'Violation 2: Candidate face obscured.',
      evidenceMetadata: { code: 'face_not_visible', bypassCooldownForTest: true }
    });

  // Violation 3
  const finalRes = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      category: 'exam_rule_violation',
      message: 'Violation 3: Fullscreen exit detected.',
      evidenceMetadata: { code: 'fullscreen_exit', bypassCooldownForTest: true }
    });

  const history = finalRes.body.violationHistory;
  assert.equal(history.length, 3, 'Must contain all 3 violations');
  assert.equal(history[0].warningNumber, 1);
  assert.ok(history[0].timestamp);
  assert.equal(history[1].warningNumber, 2);
  assert.ok(history[1].timestamp);
  assert.equal(history[2].warningNumber, 3);
  assert.ok(history[2].timestamp);
});

test('11. Normal exam submission without violations continues working seamlessly', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  const res = await request(app)
    .post('/api/attempts/submit')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      answers: { q1: 1, q2: 1, q3: 1 }
    })
    .expect(200);

  assert.equal(res.body.attempt.status, 'submitted');
  assert.equal(res.body.attempt.result.correct, 3);
  assert.equal(res.body.attempt.result.score, 12);
  assert.equal(res.body.attempt.warningCount, 0);
  assert.equal(res.body.attempt.isFlagged, false);
});

test('12. Network failure during submission does not lose saved answers', async () => {
  const service = mockProctoringService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(student);

  // Candidate answers q1 and q2, which auto-save to server
  await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      answers: { q1: 1, q2: 1 },
      marked: []
    })
    .expect(200);

  // Now, if termination happens even with empty answers in the termination request:
  const termRes = await request(app)
    .post('/api/attempts/terminate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-proctor-term-1',
      answers: {} // simulating network payload without latest transient answers
    })
    .expect(200);

  assert.equal(termRes.body.attempt.answers['q1'], 1);
  assert.equal(termRes.body.attempt.answers['q2'], 1);
  assert.equal(termRes.body.attempt.result.score, 8, 'Preserves all previously saved answers');
});
