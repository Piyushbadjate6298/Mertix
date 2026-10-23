import React, { useEffect, useState } from 'react';
import './QuestionRenderer.css';
import './MathRenderer.css';

function MathExpression({ latex, displayMode }) {
  const [markup, setMarkup] = useState('');
  useEffect(() => {
    let active = true;
    import('temml').then(({ default: temml }) => {
      if (active) setMarkup(temml.renderToString(latex, { displayMode, throwOnError: false, trust: false }));
    }).catch(() => {});
    return () => { active = false; };
  }, [latex, displayMode]);
  if (!markup) return <code>{latex}</code>;
  return <span className={displayMode ? 'math-expression block' : 'math-expression'} dangerouslySetInnerHTML={{ __html: markup }}/>;
}

function RichText({ children }) {
  const parts = String(children || '').split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return <span className="rich-question-text">{parts.map((part, index) => {
    const displayMode = part.startsWith('$$') && part.endsWith('$$');
    const inline = !displayMode && part.startsWith('$') && part.endsWith('$');
    if (!displayMode && !inline) return part;
    const latex = part.slice(displayMode ? 2 : 1, displayMode ? -2 : -1);
    return <MathExpression key={index} latex={latex} displayMode={displayMode}/>;
  })}</span>;
}

export default function QuestionRenderer({ question, selected, onSelect, disabled = false, showAnswer = false }) {
  const multiple = question.questionType === 'multiple_correct';
  const numerical = question.questionType === 'numerical' || question.questionType === 'linked_numerical';
  const selectedOptions = Array.isArray(selected) ? selected : Number.isInteger(selected) ? [selected] : [];
  return <div className="shared-question-renderer">
    {question.imageUrl && <img className="question-diagram" src={question.imageUrl} alt="Question diagram"/>}
    <h2><RichText>{question.text}</RichText></h2>
    <p className="choose-label">{numerical ? 'Enter the numerical answer:' : multiple ? 'Select all correct answers:' : 'Select the correct answer:'}</p>
    {numerical ? <div className="numerical-answer"><input aria-label="Numerical answer" type="text" inputMode="decimal" autoComplete="off" disabled={disabled} value={selected ?? ''} onChange={(event) => onSelect?.(event.target.value.replace(/[^0-9+-.]/g, ''))} placeholder="Enter answer"/><small>Use a decimal point where required. Your response is saved automatically.</small></div> : <div className="answer-options">
      {(question.options || []).map((option, index) => <button type="button" key={`${index}-${option}`} disabled={disabled} onClick={() => onSelect?.(index)} className={`answer-option ${selectedOptions.includes(index) ? 'selected' : ''} ${showAnswer && (question.correctOptions || [question.correctOption]).includes(index) ? 'correct-preview' : ''}`}>
        <span>{String.fromCharCode(65 + index)}</span><strong><RichText>{option}</RichText>{question.optionImageUrls?.[index] && <img className="option-diagram" src={question.optionImageUrls[index]} alt={`Option ${String.fromCharCode(65 + index)}`}/>}</strong><span className={`option-circle ${multiple ? 'multiple' : ''}`}>{selectedOptions.includes(index) ? '✓' : ''}</span>
      </button>)}
    </div>}
  </div>;
}
