import test from 'node:test';import assert from 'node:assert/strict';import {evaluate,canTakeExam} from '../src/engine.js';
const qs=[{id:1,answer:0,explanation:'a'},{id:2,answer:2,explanation:'b'},{id:3,answer:1,explanation:'c'}];
test('correct, wrong and unanswered marking',()=>{const r=evaluate(qs,{'1':0,'2':1});assert.equal(r.correct,1);assert.equal(r.incorrect,1);assert.equal(r.unattempted,1);assert.equal(r.score,3);assert.equal(r.accuracy,50);});
test('empty attempts score zero',()=>{const r=evaluate(qs,{});assert.equal(r.score,0);assert.equal(r.accuracy,0);});
test('only registered students may start',()=>{assert.equal(canTakeExam(true,'student'),true);assert.equal(canTakeExam(false,'student'),false);assert.equal(canTakeExam(true,'teacher'),false);});
