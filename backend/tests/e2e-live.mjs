import assert from 'node:assert/strict';
import * as XLSX from '@stackline/xlsx';

const base = process.env.MERITX_E2E_URL || 'http://127.0.0.1:5000/api';
async function call(path, { token, body, method = 'GET' } = {}) {
  const form = body instanceof FormData;
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : form ? body : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${payload.error?.message || JSON.stringify(payload)}`);
  return payload;
}
const login = async (email, password) => (await call('/auth/login', { method: 'POST', body: { email, password } })).token;

const teacher = await login('teacher@meritx.demo', 'Teacher@123');
const admin = await login('admin@meritx.demo', 'Admin@123');
const student = await login('student@meritx.demo', 'Student@123');
const runId = Date.now();
const rows = Array.from({ length: 30 }, (_, index) => ({
  question_id: `E2E-${runId}-${index + 1}`, exam: 'JEE Advanced', subject: ['Physics', 'Chemistry', 'Mathematics'][index % 3], chapter: `Chapter ${index % 5 + 1}`,
  difficulty: ['Easy', 'Moderate', 'Hard'][index % 3], question_type: index % 2 ? 'Single Correct' : 'Multiple Correct', question_text: `E2E ${runId} Question ${index + 1}`,
  option_a: 'Alpha', option_b: 'Beta', option_c: 'Gamma', option_d: 'Delta', correct_answers: index % 2 ? 'B' : 'A,C', explanation: `Verified explanation ${index + 1}`,
}));
const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'JEE Advanced');
const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
const form = new FormData(); form.append('title', `JEE Advanced E2E ${runId}`); form.append('subject', 'Physics'); form.append('file', new Blob([bytes]), 'jee-advanced-30.xlsx');
const imported = (await call('/teacher/question-banks/import', { method: 'POST', token: teacher, body: form })).bank;
assert.equal(imported.questions.length, 30); assert.equal(imported.incompleteCount, 0);
const submitted = (await call('/teacher/question-banks/submit', { method: 'POST', token: teacher, body: { id: imported.id } })).bank;
assert.equal(submitted.status, 'submitted');
const approved = (await call('/admin/question-banks/approve', { method: 'POST', token: admin, body: { id: imported.id } })).bank;
assert.equal(approved.status, 'approved');
const patterns = (await call('/exam-patterns', { token: admin })).patterns;
const patternId = patterns.find((item) => item.code === 'jee-advanced-2026').id;
const published = await call('/admin/question-banks/publish', { method: 'POST', token: admin, body: { id: imported.id, patternId, durationMinutes: 180, isFree: true, importMode: 'compatible_practice' } });
assert.equal(published.bank.status, 'published');
await call('/exams/register', { method: 'POST', token: student, body: { examId: published.examId } });
const publicQuestions = (await call(`/questions?examId=${published.examId}`, { token: student })).questions;
assert.equal(publicQuestions.length, 30); assert.ok(publicQuestions.every((question) => question.correctOptions === undefined && question.answer === undefined && question.numericalAnswer === undefined && question.matchingListData === undefined && question.explanation === undefined));
const attempt = (await call('/attempts/start', { method: 'POST', token: student, body: { examId: published.examId, acceptedInstructions: true } })).attempt;
const answers = {};
publicQuestions.forEach((question, index) => { if (index < 22) answers[question.id] = index % 2 ? 1 : [2, 0]; else if (index < 28) answers[question.id] = index % 2 ? 3 : [3]; });
await call('/attempts/save', { method: 'POST', token: student, body: { attemptId: attempt.id, answers, marked: [publicQuestions[0].id] } });
const completed = (await call('/attempts/submit', { method: 'POST', token: student, body: { attemptId: attempt.id, answers } })).attempt;
assert.deepEqual({ total: completed.result.total, correct: completed.result.correct, incorrect: completed.result.incorrect, unanswered: completed.result.unanswered, accuracy: completed.result.accuracy }, { total: 30, correct: 22, incorrect: 6, unanswered: 2, accuracy: 73.33 });
console.log(JSON.stringify({ bankId: imported.id, examId: published.examId, attemptId: attempt.id, imported: imported.questions.length, submitted: submitted.questions.length, approved: approved.questions.length, published: published.bank.questions.length, displayed: publicQuestions.length, result: completed.result }, null, 2));
