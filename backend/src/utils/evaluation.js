const normalizedSelection = (value) => {
  const values = Array.isArray(value) ? value : Number.isInteger(value) ? [value] : [];
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);
};

const sameSelection = (selected, correct) => selected.length === correct.length && selected.every((value, index) => value === correct[index]);

function scoringRule(question, configuration, legacyPositive, legacyNegative) {
  if (!configuration) return { correct: legacyPositive, incorrect: legacyNegative, unanswered: 0 };
  const type = question.questionType || 'single_correct';
  const base = configuration.rules?.[type] || configuration.rules?.single_correct || { correct: 0, incorrect: 0, unanswered: 0 };
  const subject = configuration.rules?.subjectOverrides?.[question.subject] || {};
  return { ...base, ...subject, ...(question.scoringRule || {}) };
}

function scoreQuestion(question, response, rule) {
  const type = question.questionType || 'single_correct';
  if (type === 'numerical' || type === 'linked_numerical') {
    const raw = response === null || response === undefined ? '' : String(response).trim();
    const attempted = raw !== '';
    const expected = Number(question.numericalAnswer);
    const entered = Number(raw);
    const precision = Number.isInteger(question.numericalPrecision) ? question.numericalPrecision : 2;
    const tolerance = 0.5 * (10 ** -precision);
    const isCorrect = attempted && Number.isFinite(expected) && Number.isFinite(entered) && Math.abs(entered - expected) < tolerance;
    return { attempted, isCorrect, selectedOptions: [], correctOptions: [], selectedValue: attempted ? entered : null, correctValue: expected, marksAwarded: attempted ? (isCorrect ? rule.correct : rule.incorrect) : rule.unanswered };
  }
  const selectedOptions = normalizedSelection(response);
  const correctOptions = normalizedSelection(question.correctOptions?.length ? question.correctOptions : question.answer);
  const attempted = selectedOptions.length > 0;
  const isCorrect = attempted && sameSelection(selectedOptions, correctOptions);
  let marksAwarded = attempted ? (isCorrect ? rule.correct : rule.incorrect) : rule.unanswered;
  if (attempted && !isCorrect && type === 'multiple_correct' && rule.partial) {
    const hasWrongOption = selectedOptions.some((value) => !correctOptions.includes(value));
    if (!hasWrongOption) {
      if (correctOptions.length === 4 && selectedOptions.length === 3) marksAwarded = 3;
      else if (correctOptions.length >= 3 && selectedOptions.length === 2) marksAwarded = 2;
      else if (correctOptions.length >= 2 && selectedOptions.length === 1) marksAwarded = 1;
    }
  }
  return { attempted, isCorrect, selectedOptions, correctOptions, selectedValue: null, correctValue: null, marksAwarded };
}

export function evaluate(questions, answers, configurationOrPositive = 0, legacyNegative = 0) {
  const configuration = configurationOrPositive && typeof configurationOrPositive === 'object' ? configurationOrPositive : null;
  const legacyPositive = configuration ? 0 : configurationOrPositive;
  let correct = 0; let incorrect = 0; let score = 0; let positiveMarks = 0; let negativeMarks = 0;
  const subjects = {}; const sections = {};
  const details = questions.map((question) => {
    const rule = scoringRule(question, configuration, legacyPositive, legacyNegative);
    const scored = scoreQuestion(question, answers[String(question.id)], rule);
    if (scored.attempted) scored.isCorrect ? correct++ : incorrect++;
    score += scored.marksAwarded;
    if (scored.marksAwarded > 0) positiveMarks += scored.marksAwarded;
    if (scored.marksAwarded < 0) negativeMarks += Math.abs(scored.marksAwarded);
    const subject = question.subject || 'General'; const section = question.sectionNumber ? `Paper ${question.paperNumber || 1} · Section ${question.sectionNumber}` : subject;
    for (const bucket of [subjects[subject] ||= { total: 0, attempted: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0 }, sections[section] ||= { total: 0, attempted: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0 }]) {
      bucket.total++; bucket.score += scored.marksAwarded;
      if (!scored.attempted) bucket.unanswered++;
      else { bucket.attempted++; scored.isCorrect ? bucket.correct++ : bucket.incorrect++; }
    }
    return { id: question.id, ...scored, selected: scored.selectedOptions.length === 1 ? scored.selectedOptions[0] : null, correctOption: scored.correctOptions.length === 1 ? scored.correctOptions[0] : null, explanation: question.explanation, subject, chapter: question.chapter || '', questionType: question.questionType || 'single_correct', maximumMarks: rule.correct };
  });
  const unattempted = questions.length - correct - incorrect;
  for (const group of [subjects, sections]) for (const value of Object.values(group)) { value.score = Number(value.score.toFixed(2)); value.accuracy = value.total ? Number((value.correct / value.total * 100).toFixed(2)) : 0; }
  return { total: questions.length, attempted: correct + incorrect, correct, incorrect, wrong: incorrect, unattempted, unanswered: unattempted, positiveMarks: Number(positiveMarks.toFixed(2)), negativeMarks: Number(negativeMarks.toFixed(2)), score: Number(score.toFixed(2)), maximumMarks: Number(details.reduce((sum, item) => sum + Math.max(0, item.maximumMarks), 0)), accuracy: questions.length ? Number((correct / questions.length * 100).toFixed(2)) : 0, subjects, sections, details };
}
