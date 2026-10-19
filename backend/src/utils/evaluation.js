export function evaluate(questions, answers, positive = 4, negative = -1) {
  let correct = 0; let incorrect = 0;
  const details = questions.map((question) => {
    const selected = answers[String(question.id)];
    const attempted = Number.isInteger(selected);
    const isCorrect = attempted && selected === question.answer;
    if (attempted) isCorrect ? correct++ : incorrect++;
    return { id: question.id, attempted, isCorrect, selected: attempted ? selected : null, correctOption: question.answer, explanation: question.explanation };
  });
  const unattempted = questions.length - correct - incorrect;
  return { correct, incorrect, unattempted, positiveMarks: correct * positive, negativeMarks: incorrect * Math.abs(negative), score: correct * positive - incorrect * Math.abs(negative), accuracy: correct + incorrect ? Number((correct / (correct + incorrect) * 100).toFixed(2)) : 0, details };
}
