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

const student = { id: 'student-proc-1', name: 'Rohan Sharma', email: 'rohan@example.com', role: 'student' };
const admin = { id: 'admin-proc-1', name: 'Admin Finance', email: 'admin@example.com', role: 'admin' };
const superadmin = { id: 'super-proc-1', name: 'Super Admin', email: 'super@example.com', role: 'superadmin' };

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function mockPlatformService() {
  const users = { [student.id]: student, [admin.id]: admin, [superadmin.id]: superadmin };
  let masterWalletBalance = 75000;
  let payouts = [];
  let warnings = [];
  let events = [];
  let proctoringSession = null;
  let attemptFlagged = false;

  return {
    findUserById: async (id) => users[id] || null,
    getAdminFinanceOverview: async () => ({
      todayCollection: 4500,
      todaySuccessfulPayments: 3,
      todayStudentsPaid: 3,
      totalAmountCollectedAllTime: 125000,
      totalSuccessfulTransactions: 42,
      totalStudentWalletBalance: 24500,
      totalTeacherWalletBalance: 12500,
      totalPendingWithdrawals: 3000,
      totalRefunds: 1500,
      totalRewardsReserved: 15000,
      totalSettledAmount: 75000,
      availablePlatformBalance: masterWalletBalance,
      withdrawablePlatformBalance: Math.max(0, masterWalletBalance - 15000),
      summary: {
        todayCollection: 4500,
        availablePlatformBalance: masterWalletBalance,
        withdrawablePlatformBalance: Math.max(0, masterWalletBalance - 15000),
      },
      charts: {
        dailyCollections: [{ date: '2026-10-30', amount: 4500, count: 3 }],
        monthlyCollections: [{ month: '2026-10', amount: 45000, count: 20 }],
        paymentsTrend: [{ date: '2026-10-30', count: 3 }],
        refundsTrend: [{ date: '2026-10-30', amount: 0 }],
        revenueTrend: [{ date: '2026-10-30', platformRevenue: 1800 }],
        withdrawalTrend: [{ date: '2026-10-30', amount: 1200 }],
      }
    }),
    getMasterWalletOverview: async () => ({
      masterWalletName: 'MERITX PLATFORM MASTER WALLET',
      currency: 'INR',
      availablePlatformBalance: masterWalletBalance,
      withdrawablePlatformBalance: Math.max(0, masterWalletBalance - 15000),
      totalExamPayments: 35000,
      totalCourseSales: 90000,
      totalStudentDeposits: 50000,
      totalStudentCredits: 50000,
      totalTeacherCredits: 12500,
      studentWalletLiabilities: 24500,
      teacherWalletLiabilities: 12500,
      totalRefundsPaid: 1500,
      totalRewardLiabilities: 15000,
      totalPlatformRevenue: 36000,
      gatewayCharges: 1000,
      pendingSettlements: 4500,
      completedSettlements: 75000,
      beneficiaryAccount: {
        accountHolderName: 'MERITX ACADEMIC TECHNOLOGIES PVT LTD',
        bankName: 'HDFC Bank Ltd',
        accountNumberMasked: '••••••••6721',
        ifscCode: 'HDFC0000240',
        accountType: 'Current Account'
      },
      transactions: [
        { id: 'tx-01', transactionKey: 'PML-01', category: 'treasury', type: 'initial_balance', direction: 'credit', amount: 75000, balanceAfter: 75000, date: new Date().toISOString() }
      ],
      payouts
    }),
    listPlatformTransactions: async () => ({
      transactions: [
        { id: 'tx-01', transactionKey: 'PML-01', category: 'treasury', type: 'initial_balance', direction: 'credit', amount: 75000, balanceAfter: 75000, date: new Date().toISOString() }
      ]
    }),
    exportMasterWalletCsv: async () => 'Transaction ID,Key,Date,Amount\ntx-01,PML-01,2026-10-30,75000',
    requestAdminMasterWithdrawal: async (_actorId, { amount, password, purpose, idempotencyKey }) => {
      if (password !== 'Super@123' && password !== 'Admin@123') {
        const err = new Error('Invalid administrator password for withdrawal confirmation');
        err.status = 401;
        throw err;
      }
      const withdrawable = Math.max(0, masterWalletBalance - 15000);
      if (amount > withdrawable) {
        const err = new Error(`Withdrawal amount exceeds available platform balance`);
        err.status = 400;
        throw err;
      }
      const payout = {
        id: 'payout-' + Date.now(),
        amount,
        feeDeduction: 5,
        netAmount: amount - 5,
        bankName: 'HDFC Bank Ltd',
        accountHolderName: 'MERITX ACADEMIC TECHNOLOGIES PVT LTD',
        accountNumberMasked: '••••••••6721',
        ifscCode: 'HDFC0000240',
        purpose: purpose || 'Platform Revenue Withdrawal',
        status: 'completed',
        utrNumber: 'CMS-UTR-9928172948',
        idempotencyKey: idempotencyKey || 'test-key',
        createdAt: new Date().toISOString()
      };
      masterWalletBalance -= amount;
      payouts.push(payout);
      return { payout, newBalance: masterWalletBalance, utrNumber: payout.utrNumber };
    },
    listPlatformPayouts: async () => payouts,
    reviewPlatformPayout: async (_actorId, { id, action }) => {
      const p = payouts.find(x => x.id === id);
      if (!p) { const err = new Error('Not found'); err.status = 404; throw err; }
      p.status = action === 'approve' ? 'completed' : 'rejected';
      return p;
    },
    listTeacherWallets: async () => [
      { teacherId: 't-1', teacherName: 'Dr. Joshi', email: 'joshi@meritx.demo', designation: 'Senior Faculty', department: 'Physics', balance: 12500, totalCredits: 12500, assignedCourses: 2, totalStudents: 15 }
    ],
    listRefunds: async () => [
      { id: 'ref-1', userId: student.id, userName: student.name, amount: 999, status: 'successful', date: new Date().toISOString() }
    ],
    listPlatformPayments: async () => ({
      payments: [
        { id: 'pay-1', studentId: student.id, studentName: student.name, amount: 1499, purpose: 'course_purchase', status: 'captured', gateway: 'RAZORPAY' }
      ]
    }),
    initProctoringSession: async (studentId, { examId, verificationChecks }) => {
      proctoringSession = {
        sessionId: 'proc-sess-1',
        attemptId: 'att-proc-1',
        studentId,
        examId,
        cameraStatus: 'active',
        warningCount: 0,
        isFlagged: false,
        verificationChecks
      };
      events.push({ id: 'ev-1', eventType: 'verification_passed', severity: 'info' });
      return proctoringSession;
    },
    recordProctoringHeartbeat: async (_studentId, { cameraStatus }) => {
      if (proctoringSession) {
        proctoringSession.cameraStatus = cameraStatus;
      }
      return { ok: true, cameraStatus, warningCount: warnings.length, isFlagged: attemptFlagged };
    },
    recordProctoringWarning: async (_studentId, { category, message }) => {
      const warningNumber = Math.min(3, warnings.length + 1);
      const warn = {
        id: 'warn-' + warningNumber,
        warningNumber,
        category,
        message,
        timestamp: new Date().toISOString()
      };
      warnings.push(warn);
      events.push({ id: 'ev-' + Date.now(), eventType: 'warning_issued', severity: 'warning', details: warn });
      if (warningNumber >= 3) {
        attemptFlagged = true;
      }
      return {
        warningNumber,
        warningCount: warningNumber,
        isFlagged: attemptFlagged,
        message
      };
    },
    recordProctoringEvent: async (_studentId, { eventType, severity, details }) => {
      events.push({ id: 'ev-' + Date.now(), eventType, severity, details });
      return { recorded: true };
    },
    getProctoringOverview: async () => ({
      activeExamsCount: 1,
      activeAttemptsCount: 1,
      activeCamerasCount: proctoringSession?.cameraStatus === 'active' ? 1 : 0,
      interruptedCamerasCount: proctoringSession?.cameraStatus === 'interrupted' ? 1 : 0,
      studentsWithWarningsCount: warnings.length > 0 ? 1 : 0,
      flaggedAttemptsCount: attemptFlagged ? 1 : 0,
      completedAttemptsCount: 0
    }),
    listProctoringCandidates: async () => [
      {
        attemptId: 'att-proc-1',
        examId: 'exam-jee-01',
        examTitle: 'JEE Mock Exam 2026',
        studentId: student.id,
        studentName: student.name,
        attemptStatus: 'in_progress',
        cameraStatus: proctoringSession?.cameraStatus || 'active',
        warningCount: warnings.length,
        isFlagged: attemptFlagged
      }
    ],
    getProctoringAttemptTimeline: async () => ({
      attempt: {
        id: 'att-proc-1',
        studentName: student.name,
        examTitle: 'JEE Mock Exam 2026',
        isFlagged: attemptFlagged,
        warningCount: warnings.length
      },
      warnings,
      events
    })
  };
}

test('Admin Finance Overview returns real aggregates and 13 metric cards', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(admin);

  const res = await request(app)
    .get('/api/admin/finance/overview?range=today')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.todayCollection, 4500);
  assert.equal(res.body.todaySuccessfulPayments, 3);
  assert.equal(res.body.todayStudentsPaid, 3);
  assert.equal(res.body.totalStudentWalletBalance, 24500);
  assert.equal(res.body.totalTeacherWalletBalance, 12500);
  assert.equal(res.body.availablePlatformBalance, 75000);
  assert.equal(res.body.withdrawablePlatformBalance, 60000);
  assert.ok(Array.isArray(res.body.charts.dailyCollections));
  assert.ok(Array.isArray(res.body.charts.monthlyCollections));
});

test('Platform Master Wallet provides treasury breakdown and separates user liabilities', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(superadmin);

  const res = await request(app)
    .get('/api/admin/finance/master-wallet')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.masterWalletName, 'MERITX PLATFORM MASTER WALLET');
  assert.equal(res.body.currency, 'INR');
  assert.equal(res.body.availablePlatformBalance, 75000);
  assert.equal(res.body.studentWalletLiabilities, 24500);
  assert.equal(res.body.teacherWalletLiabilities, 12500);
  assert.equal(res.body.totalRewardLiabilities, 15000);
  assert.equal(res.body.beneficiaryAccount.bankName, 'HDFC Bank Ltd');
});

test('Admin Master Withdrawal requires valid re-authentication password and prevents exceeding funds', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, emailService: {}, env });
  const token = signToken(superadmin);

  // 1. Invalid password rejected
  const failRes = await request(app)
    .post('/api/admin/finance/master-wallet/withdraw')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 5000, password: 'WrongPassword!', purpose: 'Revenue Payout' })
    .expect(401);
  assert.equal(failRes.body.success, false);

  // 2. Withdrawal exceeding available funds (withdrawable is ₹60,000, request ₹1,00,000)
  const excessRes = await request(app)
    .post('/api/admin/finance/master-wallet/withdraw')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 100000, password: 'Super@123', purpose: 'Revenue Payout' })
    .expect(400);
  assert.equal(excessRes.body.success, false);

  // 3. Valid withdrawal within available treasury
  const okRes = await request(app)
    .post('/api/admin/finance/master-wallet/withdraw')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 25000, password: 'Super@123', purpose: 'Quarterly Operating Profit Withdrawal' })
    .expect(201);
  assert.equal(okRes.body.success, true);
  assert.equal(okRes.body.payout.amount, 25000);
  assert.equal(okRes.body.newBalance, 50000);
  assert.ok(okRes.body.utrNumber.startsWith('CMS-UTR-'));
});

test('Live Examination Proctoring: verification screen, heartbeat, three-level warnings, and flag status', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, emailService: {}, env });
  const studentToken = signToken(student);
  const adminToken = signToken(admin);

  // 1. Pre-Examination Verification Session Init
  const initRes = await request(app)
    .post('/api/proctoring/session/init')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      examId: 'exam-jee-01',
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

  assert.equal(initRes.body.success, true);
  assert.equal(initRes.body.session.cameraStatus, 'active');
  assert.equal(initRes.body.session.warningCount, 0);

  // 2. Heartbeat monitoring camera status
  const hbRes = await request(app)
    .post('/api/proctoring/heartbeat')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ attemptId: 'att-proc-1', cameraStatus: 'active', isFullscreen: true })
    .expect(200);
  assert.equal(hbRes.body.success, true);

  // 3. Trigger Warning 1 (Face Not Visible)
  const warn1Res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-1',
      category: 'face_not_visible',
      message: 'Warning 1/3: Your face is not visible. Please sit properly in front of your camera.',
      evidenceMetadata: { confidence: 0.95 }
    })
    .expect(201);
  assert.equal(warn1Res.body.warningNumber, 1);
  assert.equal(warn1Res.body.isFlagged, false);

  // 4. Trigger Warning 2 (Multiple Faces / Suspected Device)
  const warn2Res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-1',
      category: 'multiple_faces_or_device',
      message: 'Warning 2/3: Suspicious activity detected. Please ensure that you are alone and no prohibited devices are present.',
      evidenceMetadata: { faceCount: 2 }
    })
    .expect(201);
  assert.equal(warn2Res.body.warningNumber, 2);
  assert.equal(warn2Res.body.isFlagged, false);

  // 5. Trigger Warning 3 (Rule Violation / Tab Switch / Fullscreen exit) -> Flags Session
  const warn3Res = await request(app)
    .post('/api/proctoring/warning')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      attemptId: 'att-proc-1',
      category: 'exam_rule_violation',
      message: 'Warning 3/3: Final warning. Your examination session has been flagged for review.',
      evidenceMetadata: { tabSwitch: true }
    })
    .expect(201);
  assert.equal(warn3Res.body.warningNumber, 3);
  assert.equal(warn3Res.body.isFlagged, true);

  // 6. Admin Live Proctoring Monitoring verifies flagged attempt and timeline
  const overviewRes = await request(app)
    .get('/api/admin/proctoring/overview')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(overviewRes.body.flaggedAttemptsCount, 1);
  assert.equal(overviewRes.body.studentsWithWarningsCount, 1);

  const candidatesRes = await request(app)
    .get('/api/admin/proctoring/candidates')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(candidatesRes.body.candidates.length, 1);
  assert.equal(candidatesRes.body.candidates[0].isFlagged, true);
  assert.equal(candidatesRes.body.candidates[0].warningCount, 3);

  const timelineRes = await request(app)
    .get('/api/admin/proctoring/attempts/att-proc-1/timeline')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(timelineRes.body.warnings.length, 3);
});
