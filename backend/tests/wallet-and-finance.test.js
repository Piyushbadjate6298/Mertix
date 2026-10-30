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

const student = { id: 'student-test-1', name: 'Student Aarav', email: 'aarav@example.com', role: 'student' };
const teacher = { id: 'teacher-test-1', name: 'Dr. Joshi', email: 'joshi@example.com', role: 'teacher' };
const admin = { id: 'admin-test-1', name: 'Admin Finance', email: 'admin@example.com', role: 'admin' };

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: '1h' });
}

function mockPlatformService() {
  const users = { [student.id]: student, [teacher.id]: teacher, [admin.id]: admin };
  let wallet = { balance: 1500, lockedBalance: 0, availableBalance: 1500, currency: 'INR', totalDeposited: 1500, totalSpent: 0, totalWithdrawn: 0, pendingWithdrawals: 0, pendingDeposits: 0, transactions: [] };
  const enrollments = [];
  const withdrawals = [];
  const courses = [
    { id: 'course-jee', name: 'JEE Masterclass', fee: 1000, discountPercent: 10, effectivePrice: 900, status: 'published', is_visible: true, teacherId: teacher.id, teacherName: teacher.name, feeVisible: true },
    { id: 'course-neet', name: 'NEET Foundation', fee: 2000, discountPercent: 0, effectivePrice: 2000, status: 'published', is_visible: true, teacherId: teacher.id, teacherName: teacher.name, feeVisible: true }
  ];

  return {
    findUserById: async (id) => users[id] || null,
    listCourses: async ({ publicOnly, authenticated = true } = {}) => {
      return courses.map(c => authenticated ? { ...c, feeVisible: true } : { ...c, fee: null, discountPercent: null, effectivePrice: null, feeVisible: false });
    },
    listExams: async (_client, { authenticated = true } = {}) => {
      const exam = { id: 'exam-jee-01', title: 'JEE Mock 1', fee: 500, status: 'published' };
      return [authenticated ? { ...exam, feeVisible: true } : { ...exam, fee: null, tag: 'Login to view price', feeVisible: false }];
    },
    getExam: async (id, _client, { authenticated = true } = {}) => {
      return authenticated ? { id, title: 'JEE Mock 1', fee: 500, feeVisible: true } : { id, title: 'JEE Mock 1', fee: null, feeVisible: false };
    },
    getStudentWallet: async (_studentId) => ({ ...wallet, availableBalance: wallet.balance - wallet.lockedBalance }),
    createDepositOrder: async (_studentId, { amount, paymentMethod }) => {
      if (amount < 10) throw new Error('Minimum deposit is ₹10');
      return { orderId: 'ord-test-123', amount, currency: 'INR', paymentMethod, isDemo: true, mode: 'DEMO MODE', keyId: 'rzp_test_public' };
    },
    verifyDepositOrder: async (_studentId, { orderId }) => {
      wallet.balance += 500;
      wallet.totalDeposited += 500;
      wallet.transactions.push({ id: 'tx-dep', type: 'deposit', amount: 500, status: 'successful', referenceId: orderId });
      return { verified: true, amount: 500, balance: wallet.balance, isDemo: true };
    },
    enrollCourse: async (studentId, courseId) => {
      const c = courses.find(item => item.id === courseId);
      if (!c) throw new Error('Course not found');
      if (enrollments.some(e => e.courseId === courseId && e.studentId === studentId)) {
        const err = new Error('You are already enrolled in this course');
        err.status = 409;
        throw err;
      }
      const price = c.effectivePrice;
      const available = wallet.balance - wallet.lockedBalance;
      if (available < price) {
        const err = new Error(`Insufficient wallet balance. Course fee is ₹${price}, available balance is ₹${available}.`);
        err.status = 400;
        throw err;
      }
      wallet.balance -= price;
      wallet.totalSpent += price;
      const enrollment = { id: 'enr-' + Date.now(), studentId, courseId, feePaid: price, status: 'active' };
      enrollments.push(enrollment);
      wallet.transactions.push({ id: 'tx-' + Date.now(), type: 'course_purchase', amount: price, status: 'successful' });
      return { enrollment, course: { id: c.id, name: c.name, fee: price }, walletBalance: wallet.balance, feePaid: price };
    },
    requestWithdrawal: async (studentId, { amount, payoutMethod, payoutDetails }) => {
      const available = wallet.balance - wallet.lockedBalance;
      if (amount > available) {
        const err = new Error(`Insufficient eligible balance`);
        err.status = 400;
        throw err;
      }
      wallet.lockedBalance += amount;
      const wd = { id: 'wd-' + Date.now(), studentId, amount, payoutMethod, payoutDetails, status: 'pending', referenceNumber: 'WD-TEST-01' };
      withdrawals.push(wd);
      return { withdrawal: wd, availableBalance: wallet.balance - wallet.lockedBalance, lockedBalance: wallet.lockedBalance };
    },
    listStudentWithdrawals: async () => withdrawals,
    reviewWithdrawal: async (_actorId, { id, action, rejectionReason }) => {
      const req = withdrawals.find(w => w.id === id);
      if (!req) { const err = new Error('Not found'); err.status = 404; throw err; }
      if (action === 'approve') {
        wallet.balance -= req.amount;
        wallet.lockedBalance -= req.amount;
        wallet.totalWithdrawn += req.amount;
        req.status = 'completed';
      } else {
        wallet.lockedBalance -= req.amount;
        req.status = 'rejected';
        req.rejectionReason = rejectionReason || 'Declined';
      }
      return req;
    },
    getTeacherDashboard: async (_teacherId) => ({
      teacher: { id: teacher.id, name: teacher.name, department: 'Physics' },
      courses: courses.map(c => ({ ...c, studentCount: enrollments.filter(e => e.courseId === c.id).length })),
      enrolledStudents: enrollments.map(e => ({ studentId: e.studentId, courseId: e.courseId, status: 'active' }))
    }),
    getAdminFinanceOverview: async () => ({
      totalStudents: 1,
      totalTeachers: 1,
      totalActiveCourses: 2,
      totalCourseEnrollments: enrollments.length,
      totalSuccessfulDeposits: wallet.totalDeposited,
      totalSuccessfulWithdrawals: wallet.totalWithdrawn,
      totalCourseRevenue: wallet.totalSpent,
      totalWalletLiabilities: wallet.balance,
      pendingWithdrawalCount: withdrawals.filter(w => w.status === 'pending').length,
      reconciliation: {
        totalCollectedDeposits: wallet.totalDeposited,
        totalEarnedCourseRevenue: wallet.totalSpent,
        totalCompletedWithdrawals: wallet.totalWithdrawn,
        totalOutstandingWalletLiabilities: wallet.balance,
        settlementMode: 'DEMO MODE - SIMULATED SETTLEMENT'
      }
    }),
    listStudentWallets: async () => [
      { studentId: student.id, studentName: student.name, email: student.email, balance: wallet.balance, totalDeposits: wallet.totalDeposited, totalSpent: wallet.totalSpent, enrolledCourses: enrollments.length }
    ],
    getStudentWalletDetails: async () => ({
      student,
      wallet,
      transactions: wallet.transactions,
      enrollments,
      withdrawals
    }),
    listAdminWithdrawals: async () => withdrawals,
    getFinancialReports: async () => ({
      transactions: wallet.transactions,
      courseSales: [{ courseId: 'course-jee', courseName: 'JEE Masterclass', salesCount: enrollments.length, revenue: wallet.totalSpent }],
      studentPayments: [{ studentId: student.id, studentName: student.name, coursesEnrolled: enrollments.length, totalSpent: wallet.totalSpent }]
    }),
    exportFinancialCsv: async () => 'Transaction ID,Type,Amount\ntx-1,deposit,1500.00'
  };
}

test('public visitors cannot see course prices until authenticated', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });

  // Unauthenticated request
  const unauthRes = await request(app).get('/api/courses');
  assert.equal(unauthRes.status, 200);
  assert.equal(unauthRes.body.courses[0].fee, null);
  assert.equal(unauthRes.body.courses[0].effectivePrice, null);
  assert.equal(unauthRes.body.courses[0].feeVisible, false);

  // Authenticated student request
  const token = signToken(student);
  const authRes = await request(app).get('/api/courses').set('Authorization', `Bearer ${token}`);
  assert.equal(authRes.status, 200);
  assert.equal(authRes.body.courses[0].fee, 1000);
  assert.equal(authRes.body.courses[0].effectivePrice, 900);
  assert.equal(authRes.body.courses[0].feeVisible, true);
});

test('student wallet deposit flow (DEMO MODE) generates order and credits balance', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });
  const token = signToken(student);

  // 1. Create deposit order
  const orderRes = await request(app)
    .post('/api/wallet/deposit/order')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 500, paymentMethod: 'upi_phonepe' });
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.body.amount, 500);
  assert.equal(orderRes.body.isDemo, true);

  // 2. Verify deposit order (Simulated Demo Sandbox)
  const verifyRes = await request(app)
    .post('/api/wallet/deposit/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ orderId: orderRes.body.orderId, isDemoSimulated: true });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.verified, true);
  assert.equal(verifyRes.body.balance, 2000); // 1500 + 500
});

test('course enrollment with wallet debit and prevention of double enrollment', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });
  const token = signToken(student);

  // 1. Enroll in course (price ₹900, initial balance ₹1500)
  const enrollRes = await request(app)
    .post('/api/courses/course-jee/enroll')
    .set('Authorization', `Bearer ${token}`)
    .send({ courseId: 'course-jee' });
  assert.equal(enrollRes.status, 201);
  assert.equal(enrollRes.body.walletBalance, 600); // 1500 - 900
  assert.equal(enrollRes.body.feePaid, 900);

  // 2. Prevent duplicate enrollment
  const duplicateRes = await request(app)
    .post('/api/courses/course-jee/enroll')
    .set('Authorization', `Bearer ${token}`)
    .send({ courseId: 'course-jee' });
  assert.equal(duplicateRes.status, 409);

  // 3. Insufficient balance for course-neet (₹2000, wallet has ₹600)
  const insufficientRes = await request(app)
    .post('/api/courses/course-neet/enroll')
    .set('Authorization', `Bearer ${token}`)
    .send({ courseId: 'course-neet' });
  assert.equal(insufficientRes.status, 400);
});

test('withdrawal request reserves funds safely and admin approval/rejection releases them', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });
  const studentToken = signToken(student);
  const adminToken = signToken(admin);

  // 1. Student requests withdrawal of ₹500 (balance ₹1500)
  const wdRes = await request(app)
    .post('/api/wallet/withdraw')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      amount: 500,
      payoutMethod: 'upi',
      payoutDetails: { upiId: 'aarav@okaxis' }
    });
  assert.equal(wdRes.status, 201);
  assert.equal(wdRes.body.availableBalance, 1000); // 1500 - 500 reserved
  assert.equal(wdRes.body.lockedBalance, 500);

  // 2. Student cannot withdraw more than available balance (requested ₹1200 > available ₹1000)
  const excessRes = await request(app)
    .post('/api/wallet/withdraw')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      amount: 1200,
      payoutMethod: 'upi',
      payoutDetails: { upiId: 'aarav@okaxis' }
    });
  assert.equal(excessRes.status, 400);

  // 3. Admin rejects the withdrawal -> funds released back to available balance!
  const rejectRes = await request(app)
    .post(`/api/admin/withdrawals/${wdRes.body.withdrawal.id}/review`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      id: wdRes.body.withdrawal.id,
      action: 'reject',
      rejectionReason: 'Invalid UPI handle'
    });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.withdrawal.status, 'rejected');

  // Available balance should now be restored to full 1500
  const walletRes = await request(app)
    .get('/api/me/wallet')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(walletRes.body.availableBalance, 1500);
  assert.equal(walletRes.body.lockedBalance, 0);
});

test('teacher dashboard is strictly isolated from student wallets and financial totals', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });
  const teacherToken = signToken(teacher);

  // 1. Teacher can access teacher dashboard
  const teacherDash = await request(app)
    .get('/api/teacher/dashboard')
    .set('Authorization', `Bearer ${teacherToken}`);
  assert.equal(teacherDash.status, 200);
  assert.equal(teacherDash.body.teacher.name, 'Dr. Joshi');

  // Verify NO private student wallet balance or financial totals are exposed in teacher endpoint
  assert.equal(teacherDash.body.teacher.wallet, undefined);
  assert.equal(teacherDash.body.totalWalletLiabilities, undefined);
  assert.equal(teacherDash.body.reconciliation, undefined);

  // 2. Teacher cannot access admin finance dashboard
  const adminFinanceAttempt = await request(app)
    .get('/api/admin/finance/overview')
    .set('Authorization', `Bearer ${teacherToken}`);
  assert.equal(adminFinanceAttempt.status, 403);

  // 3. Teacher cannot access student wallets list
  const adminWalletsAttempt = await request(app)
    .get('/api/admin/wallets')
    .set('Authorization', `Bearer ${teacherToken}`);
  assert.equal(adminWalletsAttempt.status, 403);
});

test('admin finance overview returns real aggregate summary and reconciliation', async () => {
  const service = mockPlatformService();
  const app = createApp({ service, env, emailService: {} });
  const adminToken = signToken(admin);

  const res = await request(app)
    .get('/api/admin/finance/overview')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.totalStudents, 1);
  assert.equal(res.body.totalTeachers, 1);
  assert.equal(res.body.totalActiveCourses, 2);
  assert.equal(res.body.totalWalletLiabilities, 1500);
  assert.ok(res.body.reconciliation);
  assert.equal(res.body.reconciliation.totalOutstandingWalletLiabilities, 1500);

  // CSV export
  const csvRes = await request(app)
    .get('/api/admin/finance/reports/export-csv')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(csvRes.status, 200);
  assert.equal(csvRes.headers['content-type'], 'text/csv; charset=utf-8');
});
