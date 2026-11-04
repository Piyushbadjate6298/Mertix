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
  id: 'cand-audio-proc-1',
  name: 'Aryan Verma',
  email: 'aryan.verma@example.com',
  role: 'student',
  target: 'JEE Main'
};

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function createMockAudioService() {
  const users = { [candidate.id]: candidate };
  const mockQuestions = [
    {
      id: 'q1',
      text: 'Which law states that induced EMF is proportional to rate of change of magnetic flux?',
      options: ['Faraday Law', 'Ohm Law', 'Ampere Law', 'Coulomb Law'],
      correctOption: 0,
      correctOptions: [0],
      questionType: 'single_correct',
      subject: 'Physics',
      maximumMarks: 4,
    },
    {
      id: 'q2',
      text: 'What is the conjugate base of HCl?',
      options: ['Cl-', 'OH-', 'H2O', 'H+'],
      correctOption: 0,
      correctOptions: [0],
      questionType: 'single_correct',
      subject: 'Chemistry',
      maximumMarks: 4,
    },
    {
      id: 'q3',
      text: 'Find derivative of sin(2x) with respect to x:',
      options: ['2 cos(2x)', '-2 cos(2x)', 'cos(2x)', '2 sin(x)'],
      correctOption: 0,
      correctOptions: [0],
      questionType: 'single_correct',
      subject: 'Mathematics',
      maximumMarks: 4,
    }
  ];

  let attemptState = {
    id: 'att-audio-proc-1',
    studentId: candidate.id,
    examId: 'jee-main-mock-01',
    examTitle: 'JEE Main Engineering Mock 2026',
    status: 'in_progress',
    answers: {},
    marked: [],
    result: null,
    questions: mockQuestions,
    questionSnapshot: mockQuestions,
    durationSeconds: 10800,
    startedAt: new Date(Date.now() - 50000).toISOString(),
    deadlineAt: new Date(Date.now() + 10750000).toISOString(),
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
          const err = new Error('This examination attempt has been permanently terminated due to proctoring violations.');
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
      if (marked) attemptState.marked = marked;
      return { success: true, savedAt: new Date().toISOString() };
    },

    recordProctoringWarning: async (studentId, { attemptId, category, message, evidenceMetadata, currentAnswers }) => {
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

      attemptState.warningCount += 1;
      const warnNum = attemptState.warningCount;

      const violationRecord = {
        warningNumber: warnNum,
        category,
        description: message,
        timestamp: new Date().toISOString(),
        metadata: evidenceMetadata || {}
      };
      attemptState.violationHistory.push(violationRecord);
      warnings.push(violationRecord);

      if (warnNum >= 3) {
        attemptState.status = 'TERMINATED';
        attemptState.isFlagged = true;
        attemptState.terminationReason = 'MAX_VIOLATIONS_REACHED';
        attemptState.terminatedAt = new Date().toISOString();
        if (currentAnswers) {
          attemptState.answers = { ...attemptState.answers, ...currentAnswers };
        }

        const evalResult = evaluate(
          attemptState.questions,
          attemptState.answers,
          { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } }
        );
        attemptState.result = evalResult;

        return {
          warningNumber: 3,
          warningCount: 3,
          isFlagged: true,
          isTerminated: true,
          status: 'TERMINATED',
          terminationReason: 'MAX_VIOLATIONS_REACHED',
          terminatedAt: attemptState.terminatedAt,
          attempt: { ...attemptState },
          result: evalResult,
          violationHistory: attemptState.violationHistory,
          message
        };
      }

      return {
        warningNumber: warnNum,
        warningCount: warnNum,
        isFlagged: false,
        isTerminated: false,
        message
      };
    },

    terminateAttempt: async (studentId, { attemptId, reason = 'MAX_VIOLATIONS_REACHED', answers = {} }) => {
      attemptState.status = 'TERMINATED';
      attemptState.isFlagged = true;
      attemptState.terminationReason = reason;
      attemptState.terminatedAt = new Date().toISOString();
      attemptState.answers = { ...attemptState.answers, ...answers };

      const evalResult = evaluate(
        attemptState.questions,
        attemptState.answers,
        { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } }
      );
      attemptState.result = evalResult;

      return {
        attempt: { ...attemptState },
        result: evalResult
      };
    },

    getStudentDashboard: async (studentId) => {
      return {
        student: candidate,
        attempts: [{ ...attemptState }],
        activeExams: []
      };
    }
  };
}

test('Audio AI Proctoring: 1. Background voice detection registers Warning 1', async () => {
  const service = createMockAudioService();
  const app = createApp({ service, env });
  const token = signToken(candidate);

  const res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Background voice detected. Please maintain examination silence.',
      evidenceMetadata: {
        code: 'BACKGROUND_SPEECH',
        audioCategory: 'voice',
        rms: 0.18,
        voiceEnergyRatio: 0.52
      }
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.warningCount, 1);
  assert.equal(res.body.isTerminated, false);
});

test('Audio AI Proctoring: 2. Repeated voice detection registers Warning 2 (Final Warning)', async () => {
  const service = createMockAudioService();
  const app = createApp({ service, env });
  const token = signToken(candidate);

  // Warning 1
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Background voice detected. Please maintain examination silence.',
      evidenceMetadata: { code: 'BACKGROUND_SPEECH', rms: 0.15 }
    });

  // Warning 2
  const res2 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Repeated background voice detected. This is your final warning.',
      evidenceMetadata: { code: 'BACKGROUND_SPEECH', rms: 0.22 }
    });

  assert.equal(res2.status, 201);
  assert.equal(res2.body.warningCount, 2);
  assert.equal(res2.body.isTerminated, false);
});

test('Audio AI Proctoring: 3. 3rd violation (Audio / Camera / Tab) automatically terminates exam', async () => {
  const service = createMockAudioService();
  const app = createApp({ service, env });
  const token = signToken(candidate);

  // Warning 1: Voice
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Background voice detected. Please maintain examination silence.',
      evidenceMetadata: { code: 'BACKGROUND_SPEECH' }
    });

  // Warning 2: Excessive Noise
  await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Excessive ambient noise detected. Please ensure a quiet examination environment.',
      evidenceMetadata: { code: 'EXCESSIVE_NOISE', rms: 0.75 }
    });

  // Candidate answers q1 correctly before violation 3
  await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      answers: { q1: 0 }
    });

  // Warning 3: Third violation
  const res3 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      category: 'exam_rule_violation',
      message: 'Warning 3/3 (MAXIMUM VIOLATIONS REACHED): Exam automatically terminated.',
      evidenceMetadata: { code: 'BACKGROUND_SPEECH' },
      currentAnswers: { q1: 0, q2: 0 } // q1 correct (4 marks), q2 correct (4 marks) = 8 marks
    });

  assert.equal(res3.status, 201);
  assert.equal(res3.body.isTerminated, true);
  assert.equal(res3.body.status, 'TERMINATED');
  assert.equal(res3.body.warningCount, 3);
  assert.equal(res3.body.terminationReason, 'MAX_VIOLATIONS_REACHED');

  // Verify evaluated score
  assert.ok(res3.body.result);
  assert.equal(res3.body.result.score, 8);
  assert.equal(res3.body.result.correct, 2);
  assert.equal(res3.body.result.attempted, 2);
  assert.equal(res3.body.result.unattempted, 1);

  // Verify all 3 violation events are captured in history
  assert.equal(res3.body.violationHistory.length, 3);
  assert.equal(res3.body.violationHistory[0].warningNumber, 1);
  assert.equal(res3.body.violationHistory[1].warningNumber, 2);
  assert.equal(res3.body.violationHistory[2].warningNumber, 3);
});

test('Audio AI Proctoring: 4. Terminated attempt cannot be resumed or restarted', async () => {
  const service = createMockAudioService();
  const app = createApp({ service, env });
  const token = signToken(candidate);

  // Direct terminate
  await service.terminateAttempt(candidate.id, {
    attemptId: 'att-audio-proc-1',
    reason: 'MAX_VIOLATIONS_REACHED'
  });

  // Attempting to save answers on terminated attempt returns 409
  const saveRes = await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${token}`)
    .send({
      attemptId: 'att-audio-proc-1',
      answers: { q3: 0 }
    });
  assert.equal(saveRes.status, 409);

  // Attempting to retake returns 403
  const retakeRes = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${token}`)
    .send({
      examId: 'jee-main-mock-01',
      acceptedInstructions: true,
      retake: true
    });
  assert.equal(retakeRes.status, 403);
});
