import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/utils/evaluation.js';

const questions = [{ id: 1, answer: 0, explanation: 'a' }, { id: 2, answer: 2, explanation: 'b' }, { id: 3, answer: 1, explanation: 'c' }];

test('evaluation scores correct, wrong and unanswered responses', () => {
  const result = evaluate(questions, { 1: 0, 2: 1 });
  assert.deepEqual({ correct: result.correct, incorrect: result.incorrect, unattempted: result.unattempted, score: result.score, accuracy: result.accuracy }, { correct: 1, incorrect: 1, unattempted: 1, score: 3, accuracy: 50 });
});

test('an empty attempt scores zero', () => {
  const result = evaluate(questions, {});
  assert.equal(result.score, 0);
  assert.equal(result.accuracy, 0);
});
