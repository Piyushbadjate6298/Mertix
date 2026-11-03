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

const student = { id: 'student-exam-test', name: 'Rohan Sharma', email: 'rohan@example.com', role: 'student' };
const teacher = { id: 'teacher-exam-test', name: 'Dr. Joshi', email: 'joshi@example.com', role: 'teacher' };

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function mockExamService() {
  const users = { [student.id]: student, [teacher.id]: teacher };
  const exams = {
    'exam-jee-01': {
      id: 'exam-jee-01',
      title: 'JEE Main Grand Mock 01',
      status: 'published',
      duration: 180,
      fee: 0,
      startsAt: null,
      endsAt: null,
      schedule: { eligibleStudentIds: [] }
    },
    'exam-unpublished': {
      id: 'exam-unpublished',
      title: 'Unpublished Draft Exam',
      status: 'draft',
      duration: 180,
      fee: 0,
      schedule: { eligibleStudentIds: [] }
    },
    'exam-restricted': {
      id: 'exam-restricted',
      title: 'Restricted Batch Exam',
      status: 'published',
      duration: 180,
      fee: 0,
      schedule: { eligibleStudentIds: ['other-student-id'] }
    }
  };

  const attempts = new Map();
  const proctoringSessions = new Map();
  let warningsList = [];

  return {
    findUserById: async (id) => users[id] || null,
    startAttempt: async (studentId, examId, acceptedInstructions, retake) => {
      const exam = exams[examId];
      if (!exam) {
        const err = new Error('Exam unavailable');
        err.status = 404;
        err.code = 'EXAM_NOT_FOUND';
        throw err;
      }
      if (exam.schedule?.eligibleStudentIds?.length && !exam.schedule.eligibleStudentIds.includes(studentId)) {
        const err = new Error('You are not eligible for this examination');
        err.status = 403;
        err.code = 'EXAM_NOT_ELIGIBLE';
        throw err;
      }
      if (!acceptedInstructions) {
        const err = new Error('Accept the examination instructions before starting');
        err.status = 400;
        err.code = 'INSTRUCTIONS_REQUIRED';
        throw err;
      }
      if (exam.status !== 'published') {
        const err = new Error('This examination is not published');
        err.status = 409;
        err.code = 'EXAM_NOT_PUBLISHED';
        throw err;
      }

      const key = `${studentId}:${examId}`;
      let existing = attempts.get(key);

      if (existing) {
        if (existing.status === 'submitted') {
          if (retake) {
            existing = {
              ...existing,
              status: 'in_progress',
              answers: {},
              marked: [],
              startedAt: new Date().toISOString(),
              deadlineAt: new Date(Date.now() + exam.duration * 60 * 1000).toISOString(),
            };
            attempts.set(key, existing);
            return existing;
          }
          const err = new Error('Attempt already submitted');
          err.status = 409;
          err.code = 'ATTEMPT_SUBMITTED';
          throw err;
        }
        // In-progress attempt reuse (idempotent duplicate request)
        if (retake) {
          existing = {
            ...existing,
            answers: {},
            marked: [],
            startedAt: new Date().toISOString(),
            deadlineAt: new Date(Date.now() + exam.duration * 60 * 1000).toISOString(),
          };
          attempts.set(key, existing);
        }
        return existing;
      }

      const newAttempt = {
        id: 'attempt-' + Date.now(),
        studentId,
        examId,
        status: 'in_progress',
        durationSeconds: exam.duration * 60,
        deadlineAt: new Date(Date.now() + exam.duration * 60 * 1000).toISOString(),
        startedAt: new Date().toISOString(),
        acceptedInstructionsAt: new Date().toISOString(),
        answers: {},
        marked: []
      };
      attempts.set(key, newAttempt);
      return newAttempt;
    },
    initProctoringSession: async (studentId, { examId, attemptId, verificationChecks, browserData }) => {
      const session = {
        sessionId: 'proc-sess-' + Date.now(),
        attemptId: attemptId || 'att-default',
        examId,
        studentId,
        cameraStatus: 'active',
        warningCount: 0,
        isFlagged: false,
        verificationChecks,
        browserData
      };
      proctoringSessions.set(attemptId, session);
      return session;
    },
    recordProctoringWarning: async (studentId, { attemptId, category, message, evidenceMetadata }) => {
      const session = proctoringSessions.get(attemptId) || { warningCount: 0, isFlagged: false };
      const newCount = Math.min(3, session.warningCount + 1);
      const isFlagged = newCount >= 3;
      session.warningCount = newCount;
      session.isFlagged = isFlagged;
      warningsList.push({ attemptId, category, message, evidenceMetadata, count: newCount });
      return {
        warningNumber: newCount,
        warningCount: newCount,
        isFlagged,
        message
      };
    },
    recordProctoringHeartbeat: async (_studentId, { attemptId, cameraStatus, isFullscreen }) => {
      return { ok: true, attemptId, cameraStatus, isFullscreen, warningCount: warningsList.length, isFlagged: warningsList.length >= 3 };
    },
    saveAttempt: async (studentId, { attemptId, answers, marked }) => {
      for (const [key, att] of attempts.entries()) {
        if (att.id === attemptId && att.studentId === studentId) {
          att.answers = answers;
          att.marked = marked;
          att.lastSavedAt = new Date().toISOString();
          attempts.set(key, att);
          return att;
        }
      }
      const err = new Error('Active attempt not found');
      err.status = 404;
      throw err;
    },
    submitAttempt: async (studentId, { attemptId, answers }) => {
      for (const [key, att] of attempts.entries()) {
        if (att.id === attemptId && att.studentId === studentId) {
          att.answers = answers;
          att.status = 'submitted';
          att.submittedAt = new Date().toISOString();
          att.result = { total: 30, correct: 25, incorrect: 5, accuracy: 83.33, score: 95 };
          attempts.set(key, att);
          return att;
        }
      }
      const err = new Error('Active attempt not found');
      err.status = 404;
      throw err;
    }
  };
}

test('1. Successful exam initialization: start attempt, session init, and authoritative timer', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // Start Attempt
  const res = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true, retake: false })
    .expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.attempt.status, 'in_progress');
  assert.ok(res.body.attempt.id);
  assert.ok(res.body.attempt.deadlineAt);
  assert.equal(res.body.attempt.durationSeconds, 10800);

  // Authoritative timer check: deadlineAt must be in the future
  const deadlineMs = new Date(res.body.attempt.deadlineAt).getTime();
  const diffSec = Math.floor((deadlineMs - Date.now()) / 1000);
  assert.ok(diffSec > 10700 && diffSec <= 10800, 'Authoritative timer correctly initialized');
});

test('2. Missing acknowledgement: rejected with 400 Bad Request', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // Missing acceptedInstructions
  const res = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01' })
    .expect(400);

  assert.equal(res.body.success, false);
});

test('3. Non-boolean retake parameter (e.g. event object) is strictly rejected', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // Object passed as retake
  const res = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true, retake: { type: 'click', target: {} } })
    .expect(400);

  assert.equal(res.body.success, false);
});

test('4. Unauthorized student: missing token returns 401', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });

  const res = await request(app)
    .post('/api/attempts/start')
    .send({ examId: 'exam-jee-01', acceptedInstructions: true })
    .expect(401);

  assert.equal(res.body.success, false);
});

test('5. Non-student role (e.g. teacher): forbidden with 403', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const teacherToken = signToken(teacher);

  const res = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true })
    .expect(403);

  assert.equal(res.body.success, false);
});

test('6. Examination unavailable: not found returns 404, unpublished returns 409, ineligible returns 403', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // Non-existent exam
  const res404 = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'non-existent-exam', acceptedInstructions: true })
    .expect(404);
  assert.equal(res404.body.success, false);

  // Unpublished exam
  const res409 = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-unpublished', acceptedInstructions: true })
    .expect(409);
  assert.equal(res409.body.success, false);

  // Ineligible student
  const res403 = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-restricted', acceptedInstructions: true })
    .expect(403);
  assert.equal(res403.body.success, false);
});

test('7. Duplicate exam-start request: returns existing active attempt idempotently', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // First start
  const first = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true, retake: false })
    .expect(200);

  const attemptId = first.body.attempt.id;

  // Second start (immediate rapid duplicate click)
  const second = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true, retake: false })
    .expect(200);

  assert.equal(second.body.attempt.id, attemptId, 'Reuses the same active attempt without creating duplicates');
});

test('8. Successful proctoring session initialization and verification checks', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  const res = await request(app)
    .post('/api/proctoring/session/init')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      examId: 'exam-jee-01',
      attemptId: 'att-12345',
      browserData: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        screenResolution: '1920x1080'
      },
      verificationChecks: {
        cameraAvailable: true,
        permissionGranted: true,
        faceDetected: true,
        internetOk: true,
        browserCompatible: true,
        fullscreenAvailable: true,
        instructionsAccepted: true,
        consentGiven: true
      }
    })
    .expect(201);

  assert.equal(res.body.success, true);
  assert.equal(res.body.session.cameraStatus, 'active');
  assert.equal(res.body.session.warningCount, 0);
  assert.equal(res.body.session.isFlagged, false);
});

test('9. Proctoring warnings and 3-warning enforcement logic', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // Init session first
  await request(app)
    .post('/api/proctoring/session/init')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', attemptId: 'att-proc-test' })
    .expect(201);

  // Warning 1: face_not_visible
  const w1 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-test',
      category: 'face_not_visible',
      message: 'Warning 1/3: Face not detected. Please align with the camera.',
      evidenceMetadata: { code: 'face_not_visible' }
    })
    .expect(201);
  assert.equal(w1.body.warningCount, 1);
  assert.equal(w1.body.isFlagged, false);

  // Warning 2: multiple_faces_or_device
  const w2 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-test',
      category: 'multiple_faces_or_device',
      message: 'Warning 2/3: Multiple persons detected.',
      evidenceMetadata: { code: 'multiple_faces' }
    })
    .expect(201);
  assert.equal(w2.body.warningCount, 2);
  assert.equal(w2.body.isFlagged, false);

  // Warning 3: exam_rule_violation (exiting fullscreen or tab switch)
  const w3 = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-test',
      category: 'exam_rule_violation',
      message: 'Warning 3/3: Fullscreen mode was exited.',
      evidenceMetadata: { code: 'fullscreen_exit' }
    })
    .expect(201);
  assert.equal(w3.body.warningCount, 3);
  assert.equal(w3.body.isFlagged, true, '3rd warning automatically flags attempt');
});

test('10. Answer auto-save and submission after exam start', async () => {
  const service = mockExamService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);

  // 1. Start exam
  const startRes = await request(app)
    .post('/api/attempts/start')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ examId: 'exam-jee-01', acceptedInstructions: true })
    .expect(200);
  const attemptId = startRes.body.attempt.id;

  // 2. Auto-save answers
  const saveRes = await request(app)
    .post('/api/attempts/save')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId,
      answers: { 1: 2, 2: 0, 3: [1, 2] },
      marked: [2]
    })
    .expect(200);
  assert.equal(saveRes.body.success, true);
  assert.deepEqual(saveRes.body.attempt.answers, { 1: 2, 2: 0, 3: [1, 2] });

  // 3. Submit attempt
  const submitRes = await request(app)
    .post('/api/attempts/submit')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId,
      answers: { 1: 2, 2: 0, 3: [1, 2] }
    })
    .expect(200);
  assert.equal(submitRes.body.success, true);
  assert.equal(submitRes.body.attempt.status, 'submitted');
  assert.ok(submitRes.body.attempt.result);
});
