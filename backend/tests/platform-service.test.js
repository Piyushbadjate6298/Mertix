import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformService } from '../src/services/platform.service.js';

function databaseWithExamOverride({ fee, discountPercent }) {
  const override = {
    exam_id: 'jee-main-01',
    status: null,
    title: null,
    exam_type: null,
    subject: null,
    exam_date: null,
    exam_date_text: null,
    duration_minutes: null,
    fee,
    discount_percent: discountPercent,
    image_url: null,
    description: null,
    tag: null,
    registration_open: null,
    is_deleted: false,
  };
  const course = {
    id: 'course-jee-main',
    exam_type: 'JEE Main',
    fee: 500,
    discount_percent: 0,
    status: 'published',
    is_visible: true,
    image_url: null,
    banner_image_url: null,
  };
  return {
    async query(sql) {
      if (sql.includes('FROM exam_overrides')) return { rows: [override] };
      if (sql.includes('FROM published_exams')) return { rows: [] };
      if (sql.includes('FROM courses')) return { rows: [course] };
      if (sql.includes('FROM registrations')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('exam catalog price overrides a linked course price', async () => {
  const service = createPlatformService(databaseWithExamOverride({ fee: 800, discountPercent: 25 }));
  const exam = (await service.listExams()).find((item) => item.id === 'jee-main-01');
  assert.equal(exam.courseId, 'course-jee-main');
  assert.equal(exam.fee, 600);
  assert.equal(exam.discountPercent, 0);
  assert.equal(exam.tag, 'Paid');
});

test('a zero exam catalog price makes a linked course exam free', async () => {
  const service = createPlatformService(databaseWithExamOverride({ fee: 0, discountPercent: 0 }));
  const exam = (await service.listExams()).find((item) => item.id === 'jee-main-01');
  assert.equal(exam.fee, 0);
  assert.equal(exam.tag, 'Free');
});
