import crypto from 'node:crypto';
import * as XLSX from '@stackline/xlsx';
import { PDFParse } from 'pdf-parse';
import { AppError } from '../utils/errors.js';

const normal = (value) => String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
const answerIndex = (value, options, optionLabels = []) => {
  const raw = normal(value);
  if (!raw) return { index: null, reason: 'missing' };
  const matches = options.map((option, index) => normal(option).toLowerCase() === raw.toLowerCase() ? index : -1).filter((index) => index >= 0);
  const letter = raw.match(/^(?:option\s*)?([A-H])(?:[).:\s]|$)/i);
  if (letter) {
    const label = letter[1].toUpperCase();
    const index = optionLabels.length ? optionLabels.indexOf(label) : label.charCodeAt(0) - 65;
    if (matches.length > 1 || (matches.length === 1 && matches[0] !== index)) return { index: null, reason: 'answer is ambiguous between an option label and option text' };
    return index >= 0 && index < options.length ? { index } : { index: null, reason: `option ${label} is not available` };
  }
  const numeric = Number(raw);
  if (Number.isInteger(numeric)) {
    if (matches.length > 1 || (matches.length === 1 && matches[0] !== numeric - 1)) return { index: null, reason: 'answer is ambiguous between an option position and option text' };
    return numeric >= 1 && numeric <= options.length
      ? { index: numeric - 1 }
      : { index: null, reason: `option position ${numeric} is not available` };
  }
  if (matches.length === 1) return { index: matches[0] };
  if (matches.length > 1) return { index: null, reason: `answer text matches more than one option` };
  return { index: null, reason: 'no option has this label or text' };
};

const headerAliases = {
  questionId: ['questionid', 'qid', 'id', 'questionnumber', 'questionno'],
  exam: ['exam', 'examname', 'examination'],
  subject: ['subject', 'subjectname'], chapter: ['chapter', 'chaptername'], topic: ['topic', 'unit'],
  difficulty: ['difficulty', 'level'], questionType: ['questiontype', 'type', 'mcqtype'],
  paperNumber: ['papernumber', 'paper'], sectionNumber: ['sectionnumber', 'section'],
  text: ['question', 'questiontext', 'mcq', 'text', 'questionstatement'],
  answer: ['answer', 'correctanswer', 'correctanswers', 'correctoption', 'answerkey', 'rightanswer', 'ans', 'key'],
  numericalAnswer: ['numericalanswer', 'numericanswer'], numericalPrecision: ['numericalprecision', 'numericprecision', 'precision'],
  stemId: ['questionstemid', 'stemid', 'passageid'], matchingData: ['matchinglistdata', 'matchingdata'],
  explanation: ['explanation', 'solution', 'rationale'], imageUrl: ['imageurl', 'questionimage', 'questionimageurl', 'diagramurl', 'image'],
  reference: ['reference', 'source', 'citation'],
};
const normalizedKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const pick = (row, name) => headerAliases[name].map((key) => row[key]).find((value) => value !== undefined && normal(value)) ?? '';

function answerIndexes(value, options, optionLabels = []) {
  const raw = normal(value);
  if (!raw) return { indexes: [], errors: [] };
  const wholeTextMatches = options.map((option, index) => normal(option).toLowerCase() === raw.toLowerCase() ? index : -1).filter((index) => index >= 0);
  if (wholeTextMatches.length === 1 && !/^(?:option\s*)?[A-H](?:[).:\s]|$)/i.test(raw) && !/^\d+$/.test(raw)) return { indexes: wholeTextMatches, errors: [] };
  const wholeValueMatch = answerIndex(raw, options, optionLabels);
  if (wholeValueMatch.index !== null && !/[,;|/+]|\b(?:and)\b/i.test(raw)) return { indexes: [wholeValueMatch.index], errors: [] };
  const tokens = raw.replace(/\band\b/gi, ',').split(/[,;|/+]+/).map((part) => part.trim()).filter(Boolean);
  const results = tokens.map((token) => ({ token, ...answerIndex(token, options, optionLabels) }));
  const indexes = [...new Set(results.map((result) => result.index).filter(Number.isInteger))].sort((a, b) => a - b);
  const errors = results.filter((result) => result.index === null).map((result) => `Could not match answer "${result.token}": ${result.reason}`);
  return { indexes, errors };
}

export const questionHash = (text) => crypto.createHash('sha256').update(normal(text).toLowerCase()).digest('hex');

function finalize(question, defaults = {}) {
  const options = (question.options || []).map(normal).filter(Boolean).slice(0, 8);
  const answerResult = Array.isArray(question.correctOptions)
    ? { indexes: [...new Set(question.correctOptions.filter((item) => Number.isInteger(item) && item >= 0 && item < options.length))].sort((a, b) => a - b), errors: [] }
    : answerIndexes(question.answer ?? question.correctOption, options, question.optionLabels);
  const correctOptions = answerResult.indexes;
  const typeText = normal(question.questionType).toLowerCase();
  const explicitType = typeText.replace(/[\s-]+/g, '_');
  const questionType = ['numerical', 'matching_list', 'linked_numerical'].includes(explicitType)
    ? explicitType
    : correctOptions.length > 1 || /multiple|multi|more than one/.test(typeText) ? 'multiple_correct' : 'single_correct';
  const correctOption = questionType === 'single_correct' && correctOptions.length === 1 ? correctOptions[0] : null;
  const errors = [...answerResult.errors];
  if (!normal(question.text)) errors.push('Question text is missing');
  if (!['numerical', 'linked_numerical'].includes(questionType) && options.length < 2) errors.push('At least two answer choices are required');
  const numericalAnswer = normal(question.numericalAnswer);
  if (['numerical', 'linked_numerical'].includes(questionType) ? !numericalAnswer || !Number.isFinite(Number(numericalAnswer)) : !correctOptions.length) errors.push('Answer Required');
  if (questionType === 'single_correct' && correctOptions.length > 1) errors.push('Single-correct question has multiple answers');
  return {
    externalQuestionId: normal(question.questionId) || null, exam: normal(question.exam) || null, sourceRow: question.sourceRow || null,
    text: normal(question.text), options, questionType, correctOptions, correctOption, explanation: normal(question.explanation),
    subject: normal(question.subject) || defaults.subject || 'General', chapter: normal(question.chapter),
    topic: normal(question.topic), difficulty: ['easy', 'moderate', 'medium', 'hard'].includes(normal(question.difficulty).toLowerCase()) ? (normal(question.difficulty).toLowerCase() === 'moderate' ? 'Medium' : normal(question.difficulty)[0].toUpperCase() + normal(question.difficulty).slice(1).toLowerCase()) : 'Medium',
    imageUrl: normal(question.imageUrl) || null, extractionConfidence: errors.length ? 0.65 : 0.95,
    optionImageUrls: (question.optionImageUrls || []).map((value) => normal(value) || null).slice(0, options.length),
    reference: normal(question.reference) || null, sourcePage: question.sourcePage || null,
    paperNumber: Number(normal(question.paperNumber)) || null, sectionNumber: Number(normal(question.sectionNumber)) || null,
    sourceQuestionType: typeText || null, numericalAnswer: numericalAnswer ? Number(numericalAnswer) : null,
    numericalPrecision: Number.isInteger(Number(question.numericalPrecision)) ? Number(question.numericalPrecision) : null,
    questionStemId: normal(question.stemId) || null, matchingListData: normal(question.matchingData) || null,
    extractionErrors: errors, contentHash: questionHash(question.text),
  };
}

function rowsFromWorkbook(buffer, defaults) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });
  const questions = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    for (const [rowIndex, row] of rows.entries()) {
      const byName = {};
      for (const [key, value] of Object.entries(row)) {
        const normalized = normalizedKey(key);
        if (byName[normalized] === undefined || (!normal(byName[normalized]) && normal(value))) byName[normalized] = value;
      }
      if (!Object.values(byName).some((value) => normal(value))) continue;
      const optionValues = []; const optionLabels = [];
      for (const letter of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const value = byName[`option${letter}`] !== undefined ? byName[`option${letter}`] : byName[letter];
        if (value !== undefined && normal(value)) { optionValues.push(value); optionLabels.push(letter.toUpperCase()); }
      }
      questions.push(finalize({
        questionId: pick(byName, 'questionId'), exam: pick(byName, 'exam'), text: pick(byName, 'text'), sourceRow: rowIndex + 2,
        options: optionValues, optionLabels, answer: pick(byName, 'answer'), questionType: pick(byName, 'questionType'),
        explanation: pick(byName, 'explanation'), subject: pick(byName, 'subject'),
        chapter: pick(byName, 'chapter'), topic: pick(byName, 'topic'), difficulty: pick(byName, 'difficulty'),
        imageUrl: pick(byName, 'imageUrl'), reference: pick(byName, 'reference'), paperNumber: pick(byName, 'paperNumber'), sectionNumber: pick(byName, 'sectionNumber'),
        numericalAnswer: pick(byName, 'numericalAnswer'), numericalPrecision: pick(byName, 'numericalPrecision'), stemId: pick(byName, 'stemId'), matchingData: pick(byName, 'matchingData'),
        optionImageUrls: ['a','b','c','d','e','f','g','h'].map((letter) => byName[`option${letter}imageurl`] || byName[`option${letter}image`] || null),
      }, defaults));
    }
  }
  return questions;
}

export function questionsFromText(text, defaults = {}) {
  const clean = String(text || '').replace(/\u0000/g, '').replace(/\r/g, '');
  const starts = [...clean.matchAll(/(?:^|\n)\s*(\d{1,4})[.)]\s+/g)];
  const blocks = starts.length ? starts.map((match, index) => clean.slice(match.index, starts[index + 1]?.index ?? clean.length)) : [clean];
  return blocks.map((block) => {
    const lines = block.split('\n').map(normal).filter(Boolean);
    if (!lines.length) return null;
    lines[0] = lines[0].replace(/^\d{1,4}[.)]\s*/, '');
    const options = [];
    const prompt = [];
    let answer = ''; let explanation = ''; let readingOptions = false;
    for (const line of lines) {
      const option = line.match(/^(?:\(?([A-H])\)?[).:]|([1-8])[).])\s*(.+)$/i);
      const answerLine = line.match(/^(?:answer|correct\s*answer)\s*[:\-]\s*(.+)$/i);
      const explanationLine = line.match(/^(?:explanation|solution)\s*[:\-]\s*(.+)$/i);
      if (answerLine) answer = answerLine[1];
      else if (explanationLine) explanation = explanationLine[1];
      else if (option) { readingOptions = true; options.push(option[3]); }
      else if (!readingOptions) prompt.push(line);
      else if (options.length) options[options.length - 1] += ` ${line}`;
    }
    return finalize({ text: prompt.join(' '), options, answer, explanation }, defaults);
  }).filter((question) => question?.text);
}

export async function extractQuestionFile(file, defaults = {}) {
  if (!file) throw new AppError(400, 'Choose a PDF or Excel file to upload', 'FILE_REQUIRED');
  const name = String(file.originalname || '').toLowerCase();
  const isPdf = name.endsWith('.pdf') && file.buffer.subarray(0, 5).toString() === '%PDF-';
  const isCsv = name.endsWith('.csv') && !file.buffer.includes(0) && /[,;\t]/.test(file.buffer.subarray(0, 4096).toString('utf8'));
  const isExcel = /\.(xlsx|xls)$/.test(name) && (file.buffer.subarray(0, 2).toString('hex') === '504b' || file.buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1');
  if (!isPdf && !isExcel && !isCsv) throw new AppError(415, 'The file content does not match a supported PDF, Excel, or CSV format', 'UNSUPPORTED_FILE');
  let questions; const warnings = [];
  if (isExcel || isCsv) questions = rowsFromWorkbook(file.buffer, defaults);
  else {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      if (normal(result.text).length < 30) {
        warnings.push('Little or no selectable text was found. This may be a scanned PDF; OCR is not configured, so please use an OCR-generated PDF or Excel file.');
      }
      questions = questionsFromText(result.text, defaults);
    } finally { await parser.destroy(); }
  }
  if (!questions.length) warnings.push('No recognizable MCQs were extracted. Check the documented column or question format.');
  const seen = new Set(); const seenIds = new Set(); const duplicateRows = []; const duplicateIdRows = [];
  questions = questions.map((question) => {
    const duplicateContent = seen.has(question.contentHash);
    const duplicateId = question.externalQuestionId && seenIds.has(question.externalQuestionId.toLowerCase());
    seen.add(question.contentHash); if (question.externalQuestionId) seenIds.add(question.externalQuestionId.toLowerCase());
    if (duplicateContent) duplicateRows.push(question.sourceRow);
    if (duplicateId) duplicateIdRows.push(question.sourceRow);
    if (duplicateId || (duplicateContent && defaults.importMode === 'strict_standard')) return { ...question, extractionErrors: [...question.extractionErrors, duplicateId ? 'Duplicate question ID within this upload' : 'Duplicate question text within this strict-standard upload'] };
    return question;
  });
  const adapted = questions.filter((question) => /\b(?:numerical-value|matching-list) practice\b/i.test(question.text)).length;
  if (adapted) warnings.push(`${adapted} adapted practice question(s) use option-based answers and are not genuine numerical-entry or matching-list records.`);
  if (duplicateRows.length && defaults.importMode !== 'strict_standard') warnings.push(`${duplicateRows.length} repeated question text(s) were preserved in compatible practice mode (source rows: ${duplicateRows.join(', ')}).`);
  if (duplicateIdRows.length) warnings.push(`Duplicate question IDs require correction at source rows: ${duplicateIdRows.join(', ')}.`);
  const invalid = questions.filter((question) => question.extractionErrors.length);
  return { questions, warnings, sourceType: isPdf ? 'pdf' : isCsv ? 'csv' : 'excel', summary: { totalRows: questions.length, imported: questions.length - invalid.length, rejected: invalid.length, subjects: [...new Set(questions.map((question) => question.subject).filter(Boolean))], answersMapped: questions.filter((question) => question.correctOptions.length || question.numericalAnswer !== null).length, imageCount: questions.filter((question) => question.imageUrl || question.optionImageUrls.some(Boolean)).length } };
}
