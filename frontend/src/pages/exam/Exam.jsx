import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Clock3,
  Flag,
  ShieldCheck,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import Brand from "../../components/Brand";
import { Loading } from "../../components/Layouts";
import QuestionRenderer from "../../components/QuestionRenderer";
import "./Exam.css";
const format = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export default function Exam() {
  const { id } = useParams(),
    nav = useNavigate(),
    { user, token } = useAuth();
  const [exam, setExam] = useState(null),
    [questions, setQuestions] = useState([]),
    [attempt, setAttempt] = useState(null),
    [answers, setAnswers] = useState({}),
    [marked, setMarked] = useState([]),
    [visited, setVisited] = useState([]),
    [idx, setIdx] = useState(0),
    [seconds, setSeconds] = useState(720),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [result, setResult] = useState(null),
    [saving, setSaving] = useState("Saved"),
    [tabSwitches, setTabSwitches] = useState(0),
    [instructionsAccepted, setInstructionsAccepted] = useState(false),
    [starting, setStarting] = useState(false);
  const dataRef = useRef({ answers, marked });
  dataRef.current = { answers, marked };
  const submittedRef = useRef(false);
  const currentAttempt = useRef(null);
  useEffect(() => {
    if (!token) return;
    Promise.all([api("/exams", { token }), api("/questions?examId=" + id, { token })])
      .then(([es, qs]) => {
        setExam(es.exams.find((x) => x.id === id));
        setQuestions(qs.questions);
      })
      .catch((e) => setError(e.message));
  }, [id, token]);
  async function startExam() {
    if (!instructionsAccepted || starting) return;
    setStarting(true); setError("");
    try {
      const data = await api("/attempts/start", { method: "POST", token, body: { examId: id, acceptedInstructions: true } });
      const next = data.attempt;
      setAttempt(next); currentAttempt.current = next;
      setAnswers(next.answers || {}); setMarked(next.marked || []);
      setSeconds(Math.max(0, Math.floor((new Date(next.deadlineAt).getTime() - Date.now()) / 1000)));
    } catch (issue) { setError(issue.message); }
    finally { setStarting(false); }
  }
  const submit = useCallback(async () => {
    if (submittedRef.current || !currentAttempt.current) return;
    submittedRef.current = true;
    try {
      const d = await api("/attempts/submit", {
        method: "POST",
        token,
        body: {
          attemptId: currentAttempt.current.id,
          answers: dataRef.current.answers,
        },
      });
      setResult(d.attempt);
      setConfirm(false);
    } catch (e) {
      submittedRef.current = false;
      setError(e.message);
    }
  }, [token]);
  useEffect(() => {
    if (!attempt || result) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(attempt.deadlineAt).getTime() - Date.now()) / 1000));
      setSeconds(left);
      if (!left) {
        clearInterval(t);
        submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [attempt, result, submit]);
  useEffect(() => {
    if (!attempt || result) return;
    const onVisibility = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [attempt, result]);
  useEffect(() => {
    if (!attempt || result) return;
    const t = setTimeout(async () => {
      setSaving("Saving...");
      try {
        await api("/attempts/save", {
          method: "POST",
          token,
          body: { attemptId: attempt.id, answers, marked },
        });
        setSaving("Saved");
      } catch (e) {
        setSaving("Save failed · " + e.message);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [answers, marked, attempt, result, token]);
  useEffect(() => {
    if (questions.length)
      setVisited((p) =>
        p.includes(questions[idx].id) ? p : [...p, questions[idx].id],
      );
  }, [idx, questions]);
  useEffect(() => {
    const segments = exam?.configuration?.segments || [];
    if (!attempt || !segments.length || !questions.length) return;
    const elapsed = Math.max(0, attempt.durationSeconds - seconds);
    let boundary = 0;
    let active = segments.at(-1);
    for (const segment of segments) { boundary += segment.durationMinutes * 60; if (elapsed < boundary) { active = segment; break; } }
    if (!active.subjects.includes(questions[idx]?.subject)) {
      const first = questions.findIndex((item) => active.subjects.includes(item.subject));
      if (first >= 0) setIdx(first);
    }
  }, [attempt, exam, seconds, questions, idx]);
  const answer = (option) => setAnswers((current) => {
    const question = questions[idx];
    if (question.questionType !== 'multiple_correct') return { ...current, [question.id]: option };
    const selected = Array.isArray(current[question.id]) ? current[question.id] : [];
    const next = selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option];
    const updated = { ...current }; if (next.length) updated[question.id] = next; else delete updated[question.id]; return updated;
  });
  const clear = () =>
    setAnswers((p) => {
      const n = { ...p };
      delete n[questions[idx].id];
      return n;
    });
  const toggleMark = () =>
    setMarked((p) =>
      p.includes(questions[idx].id)
        ? p.filter((x) => x !== questions[idx].id)
        : [...p, questions[idx].id],
    );
  const hasAnswer = (value) => Number.isInteger(value) || (Array.isArray(value) && value.length > 0) || (typeof value === 'string' && value.trim() !== '');
  const count = questions.filter((q) => hasAnswer(answers[q.id])).length;
  if (error && (!exam || !questions.length))
    return (
      <div className="exam-error">
        <AlertCircle size={36} />
        <h2>Unable to open the exam</h2>
        <p>{error}</p>
        <Link className="btn btn-primary" to={"/exams/" + id}>
          Back to exam
        </Link>
      </div>
    );
  if (!exam || !questions.length)
    return (
      <div className="exam-error">
        {error ? (
          <div className="instruction-card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
            <AlertCircle size={36} color="#d9534f" style={{ margin: '0 auto 12px' }} />
            <h2>Unable to load examination</h2>
            <p className="muted">{error}</p>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary small" onClick={() => window.location.reload()}>Try Again</button>
              <Link className="btn btn-outline small" to="/student">My Dashboard</Link>
            </div>
          </div>
        ) : (
          <Loading />
        )}
      </div>
    );
  if (!attempt) {
    const config = exam.configuration || {};
    const instructions = config.instructions || [
      'The timer starts only after you accept these instructions and select Start examination.',
      'Responses are saved automatically. Use Save & Next to move through the paper.',
      'Do not refresh or close this page during an active attempt.',
      'Submission is final; the attempt is also submitted automatically when time expires.',
    ];
    return <div className="exam-instructions"><div className="instruction-card"><Brand/><span className="eyebrow">CANDIDATE INSTRUCTIONS</span><h1>{exam.title}</h1><p>{exam.description}</p><div className="instruction-facts"><strong>{questions.length} questions</strong><strong>{exam.duration} minutes</strong><strong>{exam.marks} marks</strong></div><h3>Read carefully before you begin</h3><ol>{instructions.map((item) => <li key={item}>{item}</li>)}</ol>{config.segments?.length > 0 && <div className="alert"><strong>Section timing:</strong> {config.segments.map((segment) => `${segment.name} — ${segment.durationMinutes} minutes`).join(' · ')}</div>}<label className="instruction-consent"><input type="checkbox" checked={instructionsAccepted} onChange={(event) => setInstructionsAccepted(event.target.checked)}/> I have read and understood the instructions. I am ready to begin.</label>{error && <div className="alert error">{error}</div>}<div className="instruction-actions"><Link className="btn btn-outline" to={`/exams/${id}`}><ArrowLeft size={15}/> Back</Link><button className="btn btn-primary" disabled={!instructionsAccepted || starting} onClick={startExam}>{starting ? 'Starting…' : 'Start examination'} <ArrowRight size={15}/></button></div></div></div>;
  }
  if (result) {
    const r = result.result;
    return (
      <div className="exam-results">
        <div className="result-complete">
          <div className="result-check">
            <CheckCircle2 size={39} />
          </div>
          <span className="eyebrow">EXAM COMPLETED</span>
          <h1>Well done, {user.name.split(" ")[0]}!</h1>
          <p>One more step towards a stronger you. Here's how you performed.</p>
          <div className="result-score"><small>ACCURACY ACROSS ALL QUESTIONS</small><strong>{r.accuracy}% <span>· {r.correct}/{r.total}</span></strong></div>
          <div className="result-numbers">
            <div>
              <strong>{r.correct}</strong>
              <small>Correct</small>
            </div>
            <div>
              <strong>{r.incorrect}</strong>
              <small>Incorrect</small>
            </div>
            <div>
              <strong>{r.unattempted}</strong>
              <small>Unattempted</small>
            </div>
            <div>
              <strong>{r.accuracy}%</strong>
              <small>Accuracy</small>
            </div>
          </div>
          <Link className="btn btn-primary" to="/student/results">
            View My Results <ArrowRight size={16} />
          </Link>
          <div className="review-section">
            <h3>Answer explanations</h3>
            {questions.map((q, i) => {
              const d = r.details.find((d) => d.id === q.id);
              return (
                <div key={q.id} className="review-item">
                  <strong>
                    Q{i + 1}. {q.text}
                  </strong>
                  <p>
                    Your answer:{" "}
                    {d.attempted ? (d.selectedOptions?.length ? d.selectedOptions.map((value) => `${String.fromCharCode(65 + value)}. ${q.options[value]}`).join(', ') : d.selectedValue) : "Not attempted"} ·
                    Correct: {d.correctOptions?.length ? d.correctOptions.map((value) => `${String.fromCharCode(65 + value)}. ${q.options[value]}`).join(', ') : d.correctValue}
                  </p>
                  <small>{d.explanation}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  const q = questions[idx];
  const segments = exam.configuration?.segments || [];
  const elapsed = Math.max(0, attempt.durationSeconds - seconds);
  let activeSegment = segments.at(-1);
  if (segments.length) { let boundary = 0; for (const segment of segments) { boundary += segment.durationMinutes * 60; if (elapsed < boundary) { activeSegment = segment; break; } } }
  const activeSubjects = new Set(activeSegment?.subjects || exam.subjects || []);
  const permittedIndexes = questions.map((item, index) => activeSubjects.has(item.subject) ? index : -1).filter((index) => index >= 0);
  const positionInSegment = permittedIndexes.indexOf(idx);
  return (
    <div className="exam-screen">
      <header className="exam-header">
        <div className="exam-head-brand">
          <Brand compact />
          <div>
            <strong>{exam.title}</strong>
            <small>
              Official-style practice simulation · {questions.length} sample
              questions
            </small>
          </div>
        </div>
        <div className="exam-header-actions">
          <span className="save-indicator">
            <Wifi size={14} />
            {saving}
          </span>
          <div className={"exam-timer " + (seconds < 120 ? "urgent" : "")}>
            <Clock3 size={18} />
            <div>
              <small>TIME REMAINING</small>
              <strong>{format(seconds)}</strong>
            </div>
          </div>
          <button
            className="btn btn-primary small"
            onClick={() => setConfirm(true)}
          >
            Submit Exam <Send size={14} />
          </button>
        </div>
      </header>
      <div className="exam-body">
        <main className="question-area">
          <div className="question-meta">
            <span>
              QUESTION {idx + 1} OF {questions.length}
            </span>
            <span className="tag">
              {q.subject} · {q.chapter}
            </span>
            <span className="tag green">{q.questionType === 'multiple_correct' ? 'Multiple correct' : 'Single correct'}</span>
          </div>
          <div className="question-progress">
            <i style={{ width: ((idx + 1) / questions.length) * 100 + "%" }} />
          </div>
          <div className="question-content">
            <div className="question-heading">
              <span className="question-no">
                Q{String(idx + 1).padStart(2, "0")}
              </span>
              <span className="question-difficulty">
                {q.difficulty} difficulty
              </span>
            </div>
            <QuestionRenderer
              question={q}
              selected={answers[q.id]}
              onSelect={answer}
              disabled={segments.length > 0 && !activeSubjects.has(q.subject)}
            />
          </div>
          <div className="question-controls">
            <div className="question-left-actions">
              <button className="btn btn-outline small" onClick={clear}>
                Clear Response
              </button>
              <button
                className={
                  "btn small " +
                  (marked.includes(q.id) ? "btn-primary" : "btn-soft")
                }
                onClick={toggleMark}
              >
                <Bookmark size={15} />{" "}
                {marked.includes(q.id) ? "Marked" : "Mark for Review"}
              </button>
            </div>
            <div className="question-navigation">
              <button
                className="btn btn-outline small"
                disabled={positionInSegment <= 0}
                onClick={() => setIdx(permittedIndexes[positionInSegment - 1])}
              >
                <ArrowLeft size={15} /> Previous
              </button>
              <button
                className="btn btn-primary small"
                onClick={() =>
                  positionInSegment < permittedIndexes.length - 1
                    ? setIdx(permittedIndexes[positionInSegment + 1])
                    : setConfirm(true)
                }
              >
                {positionInSegment === permittedIndexes.length - 1
                  ? "Finish & Submit"
                  : "Save & Next"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </main>
        <aside className="question-sidebar">
          <div className="student-session">
            <div className="avatar">{user.name[0]}</div>
            <div>
              <strong>{user.name}</strong>
              <small>Candidate · Mock exam</small>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="palette-head">
            <h3>Question Palette</h3>
            <span>
              {count}/{questions.length} answered
            </span>
          </div>
          <div className="palette-key">
            <span>
              <i className="key-answered" />
              Answered
            </span>
            <span>
              <i className="key-unanswered" />
              Not answered
            </span>
            <span>
              <i className="key-marked" />
              Marked
            </span>
            <span>
              <i className="key-unvisited" />
              Not visited
            </span>
          </div>
          <div className="question-palette">
            {questions.map((item, i) => (
              <button
                title={"Question " + (i + 1)}
                key={item.id}
                disabled={segments.length > 0 && !activeSubjects.has(item.subject)}
                onClick={() => setIdx(i)}
                className={
                  (hasAnswer(answers[item.id])
                    ? "answered"
                    : marked.includes(item.id)
                      ? "marked"
                      : visited.includes(item.id)
                        ? "visited"
                        : "") + (idx === i ? " current" : "")
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="exam-summary">
            <h4>Exam summary</h4>
            <div>
              <span>Answered</span>
              <strong>{count}</strong>
            </div>
            <div>
              <span>Not answered</span>
              <strong>{questions.length - count}</strong>
            </div>
            <div>
              <span>Marked for review</span>
              <strong>{marked.length}</strong>
            </div>
            <div>
              <span>Tab exits detected</span>
              <strong>{tabSwitches}</strong>
            </div>
          </div>
          <div className="exam-sidebar-note">
            <ShieldCheck size={16} />
            <span>
              Activity indicators are informational only; no webcam or screen
              capture is active.
            </span>
          </div>
        </aside>
      </div>
      {confirm && (
        <div className="modal-cover">
          <div className="confirm-modal">
            <div className="modal-icon">
              <Flag />
            </div>
            <h2>Submit your examination?</h2>
            <p>
              This action is final. You won't be able to change your answers
              after submission.
            </p>
            <div className="modal-counts">
              <span>
                <strong>{count}</strong>Answered
              </span>
              <span>
                <strong>{questions.length - count}</strong>Unanswered
              </span>
              <span>
                <strong>{marked.length}</strong>Marked
              </span>
            </div>
            {error && <p style={{ color: "#db536b" }}>{error}</p>}
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setConfirm(false)}
              >
                Continue Exam
              </button>
              <button className="btn btn-primary" onClick={submit}>
                Yes, Submit <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
