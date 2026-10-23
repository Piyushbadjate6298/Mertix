import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '@stackline/xlsx';
import { extractQuestionFile, questionsFromText } from '../src/services/question-import.service.js';

function makeTextPdf(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 11 Tf 50 740 Td 13 TL (${escaped.replace(/\n/g, ') Tj T* (')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('extracts structured MCQs from an Excel question bank', async () => {
  const sheet = XLSX.utils.json_to_sheet([
    { Question: 'What is 2 + 2?', 'Option A': '3', 'Option B': '4', 'Option C': '5', 'Option D': '6', Answer: 'B', Explanation: 'Basic addition', Subject: 'Mathematics', Chapter: 'Arithmetic', Difficulty: 'Easy' },
    { Question: 'Answer is intentionally missing', 'Option A': 'Yes', 'Option B': 'No' },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Questions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'bank.xlsx', buffer }, { subject: 'Physics' });
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[0].correctOption, 1);
  assert.equal(result.questions[0].subject, 'Mathematics');
  assert.equal(result.questions[1].correctOption, null);
  assert.ok(result.questions[1].extractionErrors.includes('Answer Required'));
});

test('parses numbered PDF-style text without guessing a missing answer', () => {
  const questions = questionsFromText(`1. The SI unit of force is:\nA) Joule\nB) Newton\nC) Watt\nD) Pascal\nAnswer: B\nExplanation: Force is measured in newtons.\n\n2. Which is a noble gas?\nA) Oxygen\nB) Nitrogen\nC) Neon\nD) Hydrogen`);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].correctOption, 1);
  assert.equal(questions[1].correctOption, null);
});

test('extracts MCQs from a text-based PDF upload', async () => {
  const buffer = makeTextPdf('1. Water freezes at?\nA) 0 C\nB) 50 C\nC) 100 C\nD) -100 C\nAnswer: A');
  const result = await extractQuestionFile({ originalname: 'questions.pdf', buffer }, { subject: 'Chemistry' });
  assert.equal(result.sourceType, 'pdf');
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correctOption, 0);
});

test('rejects files whose signature does not match their extension', async () => {
  await assert.rejects(() => extractQuestionFile({ originalname: 'malicious.pdf', buffer: Buffer.from('not really a pdf') }), (error) => error.code === 'UNSUPPORTED_FILE');
});

test('imports CSV aliases, custom subjects, and multiple-correct answers', async () => {
  const csv = Buffer.from('Question ID,Exam,Subject,Question Text,Option A,Option B,Option C,Option D,Correct Answers,Question Type,Explanation\nQ-1,JEE Advanced,Physical Chemistry,Select primes,2,3,4,6,"A,B",Multiple Correct,Both 2 and 3 are prime');
  const result = await extractQuestionFile({ originalname: 'questions.csv', buffer: csv }, { subject: 'General' });
  assert.equal(result.sourceType, 'csv');
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].externalQuestionId, 'Q-1');
  assert.equal(result.questions[0].subject, 'Physical Chemistry');
  assert.equal(result.questions[0].questionType, 'multiple_correct');
  assert.deepEqual(result.questions[0].correctOptions, [0, 1]);
});

test('imports exactly thirty valid workbook questions without dropping rows', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ question_id: `JEE-${index + 1}`, exam: 'JEE Advanced', subject: ['Physics', 'Chemistry', 'Mathematics'][index % 3], question_text: `Question ${index + 1}`, option_a: 'A value', option_b: 'B value', option_c: 'C value', option_d: 'D value', correct_answers: index % 2 ? 'B' : 'A,C', question_type: index % 2 ? 'Single Correct' : 'Multiple Correct', explanation: `Explanation ${index + 1}` }));
  const sheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'JEE Questions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'jee-30.xlsx', buffer }, { subject: 'General' });
  assert.equal(result.questions.length, 30);
  assert.equal(result.questions.filter((question) => question.extractionErrors.length).length, 0);
  assert.equal(result.questions.filter((question) => question.questionType === 'multiple_correct').length, 15);
});

test('supports required answer headings and common answer value formats', async () => {
  const headings = ['Answer', 'Correct Answer', 'Correct Option', 'Answer Key', 'Right Answer', 'Correct_Answer', 'Ans', 'Key'];
  const values = ['A', 'Option B', 3, 'Delhi', ' a ', 'OPTION B', '3', 'Delhi'];
  const rows = headings.map((heading, index) => ({
    Question: `Alias ${index + 1}`, 'Option A': 'Mumbai', 'Option B': 'Chennai', 'Option C': 'Delhi', 'Option D': 'Pune', [heading]: values[index],
  }));
  const sheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Aliases');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'aliases.xlsx', buffer });
  assert.equal(result.questions.length, 8);
  assert.deepEqual(result.questions.map((question) => question.correctOption), [0, 1, 2, 2, 0, 1, 2, 2]);
  assert.ok(result.questions.every((question) => question.extractionErrors.length === 0));
});

test('maps option letters by their Excel labels when an option column is blank', async () => {
  const sheet = XLSX.utils.json_to_sheet([{ Question: 'Sparse options', 'Option A': 'Alpha', 'Option B': '', 'Option C': 'Gamma', 'Option D': 'Delta', Answer: 'C' }]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Questions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'sparse.xlsx', buffer });
  assert.deepEqual(result.questions[0].options, ['Alpha', 'Gamma', 'Delta']);
  assert.deepEqual(result.questions[0].correctOptions, [1]);
});

test('flags unmatched, partially matched, and ambiguous answer text for manual review', async () => {
  const sheet = XLSX.utils.json_to_sheet([
    { Question: 'Unknown', 'Option A': 'Yes', 'Option B': 'No', Answer: 'Maybe' },
    { Question: 'Partial multi', 'Option A': 'One', 'Option B': 'Two', 'Option C': 'Three', Answer: 'A,Z' },
    { Question: 'Duplicate text', 'Option A': 'Same', 'Option B': 'Same', Answer: 'Same' },
  ]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Questions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'invalid-answers.xlsx', buffer });
  assert.ok(result.questions[0].extractionErrors.some((error) => error.includes('Could not match answer')));
  assert.deepEqual(result.questions[1].correctOptions, [0]);
  assert.ok(result.questions[1].extractionErrors.some((error) => error.includes('Z')));
  assert.ok(result.questions[2].extractionErrors.some((error) => error.includes('more than one option')));
});

test('matches exact option text containing separators without splitting it', async () => {
  const sheet = XLSX.utils.json_to_sheet([{ Question: 'Location', 'Option A': 'Delhi, India', 'Option B': 'Paris, France', Answer: ' Delhi, India ' }]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Questions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await extractQuestionFile({ originalname: 'option-text.xlsx', buffer });
  assert.equal(result.questions[0].correctOption, 0);
  assert.deepEqual(result.questions[0].extractionErrors, []);
});
