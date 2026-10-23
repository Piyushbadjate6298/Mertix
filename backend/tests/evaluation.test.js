import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/utils/evaluation.js';

const questions = [{ id: 1, answer: 0, explanation: 'a' }, { id: 2, answer: 2, explanation: 'b' }, { id: 3, answer: 1, explanation: 'c' }];

test('evaluation scores correct, wrong and unanswered responses', () => {
  const result = evaluate(questions, { 1: 0, 2: 1 });
  assert.deepEqual({ correct: result.correct, incorrect: result.incorrect, unattempted: result.unattempted, score: result.score, accuracy: result.accuracy }, { correct: 1, incorrect: 1, unattempted: 1, score: 0, accuracy: 33.33 });
});

test('an empty attempt scores zero', () => {
  const result = evaluate(questions, {});
  assert.equal(result.score, 0);
  assert.equal(result.accuracy, 0);
});

test('evaluation applies a configured negative marking scheme', () => {
  const result = evaluate(questions, { 1: 0, 2: 0, 3: 0 }, 3, -2);
  assert.equal(result.correct, 1);
  assert.equal(result.incorrect, 2);
  assert.equal(result.score, -1);
  assert.equal(result.negativeMarks, 4);
});

test('multiple-correct answers require an exact set regardless of order', () => {
  const multi = [{ id: 'm1', subject: 'Physics', correctOptions: [0, 2], explanation: 'Both apply.' }];
  assert.equal(evaluate(multi, { m1: [2, 0] }).correct, 1);
  assert.equal(evaluate(multi, { m1: [0] }).incorrect, 1);
  assert.equal(evaluate(multi, { m1: [0, 1, 2] }).incorrect, 1);
});

test('JEE Advanced multiple-correct rules award only valid subset partial marks', () => {
  const questions = [{ id: 'm1', subject: 'Physics', questionType: 'multiple_correct', correctOptions: [0, 1, 3] }];
  const pattern = { maximumMarks: 4, rules: { multiple_correct: { correct: 4, incorrect: -1, unanswered: 0, partial: true } } };
  assert.equal(evaluate(questions, { m1: [0, 1, 3] }, pattern).score, 4);
  assert.equal(evaluate(questions, { m1: [0, 3] }, pattern).score, 2);
  assert.equal(evaluate(questions, { m1: [1] }, pattern).score, 1);
  assert.equal(evaluate(questions, { m1: [0, 2] }, pattern).score, -1);
});

test('MHT-CET applies mathematics subject weighting without negative marking', () => {
  const weighted = [{ id: 'p', subject: 'Physics', answer: 0 }, { id: 'm', subject: 'Mathematics', answer: 1 }];
  const pattern = { maximumMarks: 3, rules: { single_correct: { correct: 1, incorrect: 0, unanswered: 0 }, subjectOverrides: { Mathematics: { correct: 2, incorrect: 0 } } } };
  const result = evaluate(weighted, { p: 0, m: 1 }, pattern);
  assert.equal(result.score, 3);
  assert.equal(result.subjects.Mathematics.score, 2);
});

test('numerical questions use numeric tolerance and configured penalties', () => {
  const numerical = [{ id: 'n', subject: 'Mathematics', questionType: 'numerical', numericalAnswer: 2.5, numericalPrecision: 2 }];
  const pattern = { maximumMarks: 4, rules: { numerical: { correct: 4, incorrect: -1, unanswered: 0 } } };
  assert.equal(evaluate(numerical, { n: '2.50' }, pattern).score, 4);
  assert.equal(evaluate(numerical, { n: '2.6' }, pattern).score, -1);
  assert.equal(evaluate(numerical, {}, pattern).score, 0);
});
