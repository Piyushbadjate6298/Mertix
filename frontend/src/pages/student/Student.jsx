import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Target,
  Trophy,
  TrendingUp,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Wallet,
  LifeBuoy,
  BookOpen,
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money, friendlyDate } from "../../lib/api";
import QuestionRenderer from "../../components/QuestionRenderer";
import "./Student.css";
export function useStudent() {
  const { token } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = () =>
    api("/me/dashboard", { token })
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [token]);
  return { data, error, refresh, token };
}
export function StudentDashboard() {
  const { user } = useAuth();
  const { data, error } = useStudent();
  const [exams, setExams] = useState([]);
  useEffect(() => {
    api("/exams").then((d) => setExams(d.exams));
  }, []);
  if (!data)
    return (
      <Shell title="Student dashboard">
        {error ? (
          <div className="alert error" style={{ margin: '20px 0' }}>
            {error}
          </div>
        ) : (
          <Loading />
        )}
      </Shell>
    );
  const attempts = data.attempts.filter((a) => a.status === "submitted");
  const avg = attempts.length
    ? Math.round(
        attempts.reduce((s, a) => s + a.result.correct, 0) / attempts.length,
      )
    : 0;
  const acc = attempts.length
    ? Math.round(
        attempts.reduce((s, a) => s + a.result.accuracy, 0) / attempts.length,
      )
    : 0;
  return (
    <Shell
      title={`Hello, ${user.name.split(" ")[0]} 👋`}
      kicker="YOUR LEARNING HUB"
      description="Your ambition deserves a smarter preparation journey."
      action={
        <Link to="/exams" className="btn btn-primary small">
          Explore Exams <ArrowUpRight size={16} />
        </Link>
      }
    >
      <div className="grid-4">
        <Stat
          icon={Target}
          label="Average Correct"
          value={avg}
          delta="Sample mock exams"
        />
        <Stat
          icon={Trophy}
          label="Tests Completed"
          value={attempts.length}
          tone="purple"
          delta="Keep it going"
        />
        <Stat
          icon={TrendingUp}
          label="Average Accuracy"
          value={acc + "%"}
          tone="green"
          delta="Improve with practice"
        />
        <Stat
          icon={ClipboardList}
          label="Registrations"
          value={data.registrations.length}
          tone="cyan"
          delta="Your exam journey"
        />
      </div>
      <div className="grid-2 student-panels">
        <section className="panel">
          <div className="panel-head">
            <h3>Your registered exams</h3>
            <Link className="action-link" to="/exams">
              Explore all <ArrowUpRight size={14} />
            </Link>
          </div>
          {data.registrations.length ? (
            data.registrations.map((r) => {
              const e = exams.find((x) => x.id === r.examId);
              const a = data.attempts.find((a) => a.examId === r.examId);
              return (
                <div className="dashboard-exam" key={r.id}>
                  <div className="mini-exam-icon">∑</div>
                  <div>
                    <strong>{e?.title || r.examId}</strong>
                    <small>
                      {e ? friendlyDate(e.date) : "Mock test"} ·{" "}
                      {e ? `Current fee: ${e.fee ? money(e.fee) : "FREE"}` : "Fee unavailable"} ·{" "}
                      {a?.status === "submitted"
                        ? "Completed"
                        : "Ready to attempt"}
                    </small>
                  </div>
                  <Link
                    className="btn btn-soft small"
                    to={
                      a?.status === "submitted"
                        ? "/student/results"
                        : "/take/" + r.examId
                    }
                  >
                    {a?.status === "submitted" ? "Result" : "Attempt"}{" "}
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              );
            })
          ) : (
            <Empty
              title="No registered exams"
              text="Browse our demo tests and start preparing."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>Recent performance</h3>
            <Link className="action-link" to="/student/results">
              All results <ArrowUpRight size={14} />
            </Link>
          </div>
          {attempts.length ? (
            attempts
              .slice(-4)
              .reverse()
              .map((a) => (
                <div className="result-mini" key={a.id}>
                  <div>
                    <strong>
                      {exams.find((e) => e.id === a.examId)?.title ||
                        "Mock Exam"}
                    </strong>
                    <small>
                      {new Date(a.submittedAt).toLocaleDateString("en-IN")}
                    </small>
                  </div>
                  <span>{a.result.correct}/{a.result.total}</span>
                </div>
              ))
          ) : (
            <Empty
              title="Your progress starts here"
              text="Complete your first exam to unlock performance insights."
            />
          )}
        </section>
      </div>
      <div className="student-banner">
        <div>
          <span>LEVEL UP YOUR PREPARATION</span>
          <h2>
            Every attempt is progress.
            <br />
            Make your next one count.
          </h2>
          <Link className="btn btn-white small" to="/exams">
            Find a mock test <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="banner-illustration">✦</div>
      </div>
    </Shell>
  );
}
export function Results() {
  const { data } = useStudent();
  const [exams, setExams] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  useEffect(() => {
    api("/exams").then((d) => setExams(d.exams));
  }, []);
  return (
    <Shell
      title="My Results"
      kicker="PROGRESS & ANALYTICS"
      description="Review every attempt and discover where you can improve."
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="panel">
          {data.attempts.filter((a) => a.status === "submitted").length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Total</th>
                    <th>Attempted</th>
                    <th>Correct</th>
                    <th>Incorrect</th>
                    <th>Unanswered</th>
                    <th>Accuracy</th>
                    <th>Completed</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts
                    .filter((a) => a.status === "submitted")
                    .map((a) => (
                      <tr key={a.id}>
                        <td>
                          {exams.find((e) => e.id === a.examId)?.title ||
                            a.examId}
                        </td>
                        <td>{a.result.total}</td>
                        <td>{a.result.attempted}</td>
                        <td>{a.result.correct}</td>
                        <td>{a.result.incorrect}</td>
                        <td>{a.result.unanswered ?? a.result.unattempted}</td>
                        <td>{a.result.accuracy}%</td>
                        <td>
                          {new Date(a.submittedAt).toLocaleDateString("en-IN")}
                        </td>
                        <td><button className="btn btn-soft small" onClick={() => setReviewId(reviewId === a.id ? null : a.id)}>{reviewId === a.id ? 'Hide' : 'Review'}</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No results yet"
              text="Submit a demo exam to see an evaluated result."
            />
          )}
          {data.attempts.filter((attempt) => attempt.id === reviewId).map((attempt) => <div className="review-section" key={attempt.id}><h3>Detailed answer review</h3>{(attempt.questions || []).map((question, index) => { const detail = attempt.result.details.find((item) => item.id === question.id); return <article className="review-item" key={question.id}><strong>Question {index + 1} · {question.subject} · {question.chapter}</strong><QuestionRenderer question={question} selected={detail?.selectedOptions || []} disabled showAnswer/><p><b>Status:</b> {!detail?.attempted ? 'Unanswered' : detail.isCorrect ? 'Correct' : 'Incorrect'}</p><p><b>Your answer:</b> {detail?.attempted ? detail.selectedOptions.map((value) => String.fromCharCode(65 + value)).join(', ') : 'Not answered'} · <b>Correct:</b> {(detail?.correctOptions || []).map((value) => String.fromCharCode(65 + value)).join(', ')}</p>{question.explanation && <p><b>Explanation:</b> {question.explanation}</p>}</article>; })}</div>)}
        </div>
      )}
    </Shell>
  );
}
export function Rewards() {
  const { data } = useStudent();
  return (
    <Shell
      title="Rewards & Wallet"
      kicker="ACHIEVEMENTS"
      description="A preview of student achievements and wallet management."
    >
      <div className="grid-3">
        <Stat
          icon={Wallet}
          label="Available balance"
          value="₹0"
          tone="green"
          delta="Demo wallet inactive"
        />
        <Stat
          icon={Trophy}
          label="Rewards earned"
          value="₹0"
          tone="purple"
          delta="Prize distribution disabled"
        />
        <Stat
          icon={Target}
          label="Achievements"
          value="0"
          delta="Complete more tests"
        />
      </div>
      <div className="panel" style={{ marginTop: 22 }}>
        <h3>Demo wallet notice</h3>
        <p className="muted" style={{ lineHeight: 1.9, fontSize: 13 }}>
          Financial rewards, paid entry fees, withdrawals and KYC are
          intentionally disabled. Activation requires legal review, verified
          payment/payout providers and a compliant ledger. This interface is for
          product demonstration only.
        </p>
      </div>
    </Shell>
  );
}
export function Support() {
  const { token } = useAuth();
  const [subject, setSubject] = useState("Exam issue"),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setFeedback("");
    try {
      await api("/support", {
        method: "POST",
        token,
        body: { subject, message },
      });
      setFeedback("Your support ticket has been saved.");
      setMessage("");
    } catch (e) {
      setFailed(true);
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      title="Help & Support"
      kicker="WE'RE HERE FOR YOU"
      description="Something not working? Reach the support team."
    >
      <div className="panel" style={{ maxWidth: 650 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Issue category</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
            >
              {[
                "Exam issue",
                "Payment issue",
                "Registration",
                "Result & ranking",
                "Technical issue",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>What happened?</label>
            <textarea
              rows={6}
              required
              minLength={10}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue..."
              disabled={busy}
            />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting..." : "Submit Ticket"}
          </button>
          {feedback && (
            <div
              className={"alert " + (failed ? "error" : "success")}
              role="status"
            >
              {feedback}
            </div>
          )}
        </form>
      </div>
    </Shell>
  );
}
