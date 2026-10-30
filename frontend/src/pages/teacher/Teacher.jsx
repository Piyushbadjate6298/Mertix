import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Plus,
  Send,
  UploadCloud,
  FileSpreadsheet,
  Eye,
  Save,
  Trash2,
  AlertTriangle,
  X,
  Users,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  User,
  Settings,
} from 'lucide-react';
import { Shell, Stat, Loading, Empty } from '../../components/Layouts';
import QuestionRenderer from '../../components/QuestionRenderer';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './Teacher.css';

const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const blankQuestion = (subject = 'Physics') => ({ text: '', options: ['', '', '', ''], questionType: 'single_correct', correctOptions: [], correctOption: null, explanation: '', subject, chapter: '', topic: '', difficulty: 'Medium', imageUrl: null, extractionErrors: [] });
const answerError = (value) => /answer required|could not match answer|answer text matches|option .* is not available/i.test(value);
const duplicateError = (value) => /duplicate/i.test(value);
function questionValidationIssues(question) {
  const options = question.options || []; const selected = question.correctOptions || [];
  const issues = [];
  if (!question.text?.trim()) issues.push('Question text is missing');
  if (['numerical', 'linked_numerical'].includes(question.questionType)) {
    if (!Number.isFinite(Number(question.numericalAnswer))) issues.push('Numerical answer is required');
    if (question.questionType === 'linked_numerical' && !question.questionStemId?.trim()) issues.push('Linked stem ID is required');
    return issues;
  }
  if (options.filter((option) => option?.trim()).length < 2) issues.push('At least two answer choices are required');
  if (!selected.length || selected.some((index) => index < 0 || index >= options.length || !options[index]?.trim())) issues.push('Answer Required');
  return issues;
}
function compactQuestion(question, fallbackSubject) {
  const keptIndexes = question.options.map((option, index) => option.trim() ? index : null).filter(Number.isInteger);
  const indexMap = new Map(keptIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const correctOptions = (question.correctOptions?.length ? question.correctOptions : Number.isInteger(question.correctOption) ? [question.correctOption] : [])
    .map((index) => indexMap.get(index)).filter(Number.isInteger);
  return { ...question, options: keptIndexes.map((index) => question.options[index]), correctOptions: correctOptions.length ? correctOptions : undefined, correctOption: correctOptions.length === 1 ? correctOptions[0] : null, subject: question.subject || fallbackSubject, optionImageUrls: keptIndexes.map((index) => question.optionImageUrls?.[index] || null) };
}

export function useTeacher() {
  const { token } = useAuth();
  const [papers, setPapers] = useState(null);
  const refresh = () => api('/teacher/papers', { token }).then((data) => setPapers(data.papers)).catch(() => setPapers([]));
  useEffect(() => { refresh(); }, [token]);
  return { papers, refresh, token };
}

function useBanks() {
  const { token } = useAuth();
  const [banks, setBanks] = useState(null);
  const refresh = () => api('/teacher/question-banks', { token }).then((data) => setBanks(data.banks)).catch(() => setBanks([]));
  useEffect(() => { refresh(); }, [token]);
  return { banks, refresh, token };
}

export function useTeacherDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    return api('/teacher/dashboard', { token })
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (token) refresh();
  }, [token]);
  return { data, error, loading, refresh, token };
}

export function TeacherDashboard() {
  const { papers } = useTeacher();
  const { banks } = useBanks();
  const { data: dashData } = useTeacherDashboard();
  const [selectedCourseRoster, setSelectedCourseRoster] = useState(null);

  const assignedCourses = dashData?.assignedCourses || [];
  const totalStudents = dashData?.totalStudents || 0;

  return (
    <Shell
      title={`Faculty workspace · ${dashData?.teacher?.name || 'Instructor'}`}
      kicker="TEACHER DASHBOARD"
      description="Design better questions. Monitor course enrollments and build assessments."
      action={
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/teacher/courses" className="btn btn-outline small">
            <GraduationCap size={15} /> My Courses
          </Link>
          <Link to="/teacher/import" className="btn btn-primary small">
            Import Question Bank <UploadCloud size={16} />
          </Link>
        </div>
      }
    >
      <div className="grid-4">
        <Stat
          icon={GraduationCap}
          label="Assigned Courses"
          value={assignedCourses.length}
          delta="Authorized curriculum"
        />
        <Stat
          icon={Users}
          label="Enrolled Students"
          value={totalStudents}
          tone="green"
          delta="Active learners"
        />
        <Stat
          icon={BookOpen}
          label="Question Banks"
          value={banks?.length || 0}
          delta="Imported & authored"
        />
        <Stat
          icon={ClipboardList}
          label="Papers Submitted"
          value={papers?.length || 0}
          tone="cyan"
          delta="Awaiting review"
        />
      </div>

      {/* Privacy Isolation Notice */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color="#2563eb" />
          <h4 style={{ margin: 0 }}>Faculty Privacy & Data Isolation</h4>
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
          Faculty accounts are strictly scoped to assigned courses, question creation, and enrolled student rosters.
          Private student wallet balances, deposit records, withdrawal details, and administrative financial dashboards
          are completely isolated from teacher views.
        </p>
      </div>

      {/* Assigned Courses Section with Student Roster View */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h3>My Assigned Courses</h3>
            <p className="muted">Live student enrollment counts and class rosters.</p>
          </div>
          <Link to="/teacher/courses" className="action-link">
            Full course view →
          </Link>
        </div>
        {assignedCourses.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Category / Exam</th>
                  <th>Enrolled Students</th>
                  <th>Mock Exams</th>
                  <th>Status</th>
                  <th>Student Roster</th>
                </tr>
              </thead>
              <tbody>
                {assignedCourses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.shortDescription || '—'}</div>
                    </td>
                    <td>
                      {c.category} · {c.examType}
                    </td>
                    <td>
                      <strong style={{ color: '#2563eb' }}>{c.enrolledStudentCount || 0}</strong> students
                    </td>
                    <td>{c.publishedExamCount || 0} exams</td>
                    <td>
                      <span className={`tag ${c.status === 'published' ? 'green' : 'orange'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-soft small"
                        onClick={() => setSelectedCourseRoster(c)}
                      >
                        <Users size={14} /> View Roster ({c.enrolledStudents?.length || 0})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No courses assigned"
            text="Contact the administrator to be assigned as lead faculty for active courses."
          />
        )}
      </div>

      {/* Student Roster Modal */}
      {selectedCourseRoster && (
        <div className="checkout-modal-backdrop" onClick={() => setSelectedCourseRoster(null)}>
          <div className="checkout-modal-card" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <div>
                <span className="demo-pill">STUDENT ROSTER</span>
                <h3>{selectedCourseRoster.name}</h3>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {selectedCourseRoster.enrolledStudents?.length || 0} enrolled students (Wallet/Financial data excluded)
                </p>
              </div>
              <button
                className="btn-icon-close"
                onClick={() => setSelectedCourseRoster(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {selectedCourseRoster.enrolledStudents?.length ? (
              <div className="table-scroll" style={{ maxHeight: 350, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Enrollment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCourseRoster.enrolledStudents.map((s, idx) => (
                      <tr key={s.studentId || idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.email}</td>
                        <td>{new Date(s.enrolledAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No students enrolled yet" text="When students enroll via their wallet, they will appear here." />
            )}
            <div style={{ textAlign: 'right', marginTop: 18 }}>
              <button className="btn btn-outline small" onClick={() => setSelectedCourseRoster(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Banks */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <h3>Recent question banks</h3>
          <Link className="action-link" to="/teacher/import">
            Import new →
          </Link>
        </div>
        {!banks ? (
          <Loading />
        ) : banks.length ? (
          <BankTable banks={banks} />
        ) : (
          <Empty title="No question banks" text="Upload a PDF or Excel question bank to begin." />
        )}
      </div>
    </Shell>
  );
}

export function TeacherCourses() {
  const { data, loading, refresh } = useTeacherDashboard();
  const [selectedCourseRoster, setSelectedCourseRoster] = useState(null);
  const assignedCourses = data?.assignedCourses || [];

  return (
    <Shell
      title="My Assigned Courses"
      kicker="CURRICULUM MANAGEMENT"
      description="View assigned courses, syllabus delivery, and authorized student enrollment rosters."
    >
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Assigned Courses ({assignedCourses.length})</h3>
            <p className="muted">Students enrolled via wallet balance appear in the roster below.</p>
          </div>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {assignedCourses.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Category</th>
                  <th>Exam Type</th>
                  <th>Enrolled Students</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedCourses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.category}</td>
                    <td>{c.examType}</td>
                    <td>
                      <strong style={{ color: '#2563eb' }}>{c.enrolledStudentCount || 0}</strong> students
                    </td>
                    <td>{c.durationDays || 180} days</td>
                    <td>
                      <span className={`tag ${c.status === 'published' ? 'green' : 'orange'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-soft small"
                        onClick={() => setSelectedCourseRoster(c)}
                      >
                        <Users size={14} /> Student Roster ({c.enrolledStudents?.length || 0})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No assigned courses"
            text="You have not been assigned to any courses yet. Administrators assign faculty to courses."
          />
        )}
      </div>

      {selectedCourseRoster && (
        <div className="checkout-modal-backdrop" onClick={() => setSelectedCourseRoster(null)}>
          <div className="checkout-modal-card" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <div>
                <span className="demo-pill">STUDENT ROSTER</span>
                <h3>{selectedCourseRoster.name}</h3>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {selectedCourseRoster.enrolledStudents?.length || 0} students enrolled
                </p>
              </div>
              <button
                className="btn-icon-close"
                onClick={() => setSelectedCourseRoster(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {selectedCourseRoster.enrolledStudents?.length ? (
              <div className="table-scroll" style={{ maxHeight: 350, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Enrollment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCourseRoster.enrolledStudents.map((s, idx) => (
                      <tr key={s.studentId || idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.email}</td>
                        <td>{new Date(s.enrolledAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No students enrolled yet" text="When students enroll, they will be listed here." />
            )}
            <div style={{ textAlign: 'right', marginTop: 18 }}>
              <button className="btn btn-outline small" onClick={() => setSelectedCourseRoster(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

export function TeacherProfile() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState({
    designation: '',
    department: '',
    specialization: '',
    experienceYears: 5,
    bio: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (token) {
      api('/teacher/profile', { token })
        .then((res) => {
          if (res.profile) {
            setProfile({
              designation: res.profile.designation || '',
              department: res.profile.department || '',
              specialization: res.profile.specialization || '',
              experienceYears: res.profile.experienceYears || 5,
              bio: res.profile.bio || '',
              phone: res.profile.phone || '',
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      await api('/teacher/profile', {
        method: 'PUT',
        token,
        body: {
          ...profile,
          experienceYears: Number(profile.experienceYears),
        },
      });
      setMsg('Teacher profile updated successfully.');
    } catch (e) {
      setErr(e.message || 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Faculty Profile"
      kicker="PROFILE & CREDENTIALS"
      description="Update your academic credentials, teaching subject, and faculty biography."
    >
      <div className="panel" style={{ maxWidth: 650, margin: '0 auto' }}>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}

        {loading ? (
          <Loading />
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div className="field">
                <label>Faculty Name</label>
                <input type="text" disabled value={user?.name || ''} />
              </div>
              <div className="field">
                <label>Email Address</label>
                <input type="email" disabled value={user?.email || ''} />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Physics Faculty"
                  value={profile.designation}
                  onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Department</label>
                <input
                  type="text"
                  placeholder="e.g. Physical Sciences"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Specialization</label>
                <input
                  type="text"
                  placeholder="e.g. Mechanics & Electromagnetism"
                  value={profile.specialization}
                  onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Teaching Experience (Years)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={profile.experienceYears}
                  onChange={(e) => setProfile({ ...profile, experienceYears: e.target.value })}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Faculty Bio</label>
              <textarea
                rows="4"
                placeholder="Briefly describe your teaching philosophy and academic accomplishments..."
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              disabled={busy}
            >
              {busy ? 'Saving...' : 'Save Faculty Profile'}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}

function BankTable({ banks, onOpen }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Question bank</th><th>Subject</th><th>Questions</th><th>Review</th><th>Status</th>{onOpen && <th>Action</th>}</tr></thead><tbody>{banks.map((bank) => <tr key={bank.id}><td>{bank.title}<small className="table-subtitle">{bank.sourceFilename}</small></td><td>{bank.subject}</td><td>{bank.questionCount}</td><td>{bank.incompleteCount ? `${bank.incompleteCount} incomplete` : 'Ready'}</td><td><span className={`tag ${bank.status === 'approved' ? 'green' : bank.status === 'submitted' ? 'orange' : ''}`}>{bank.status}</span></td>{onOpen && <td><button className="btn btn-soft small" onClick={() => onOpen(bank.id)}>Open</button></td>}</tr>)}</tbody></table></div>;
}

function PaperTable({ papers, approve }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Paper</th><th>Subject</th><th>Questions</th><th>Status</th>{approve && <th>Action</th>}</tr></thead><tbody>{papers.map((paper) => <tr key={paper.id}><td>{paper.title}</td><td>{paper.subject}</td><td>{paper.questions}</td><td><span className={`tag ${paper.status === 'approved' ? 'green' : 'orange'}`}>{paper.status}</span></td>{approve && <td>{paper.status === 'submitted' ? <button className="btn btn-soft small" onClick={() => approve(paper.id)}>Approve</button> : '—'}</td>}</tr>)}</tbody></table></div>;
}
export { PaperTable, BankTable };

export function PaperBuilder() {
  const { token, papers, refresh } = useTeacher();
  const [title, setTitle] = useState(''); const [subject, setSubject] = useState('Physics'); const [questions, setQuestions] = useState(30); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function create(event) { event.preventDefault(); setBusy(true); setMsg(''); try { await api('/teacher/papers', { method: 'POST', token, body: { title, subject, questions } }); setMsg('Paper submitted successfully for independent admin review.'); setTitle(''); refresh(); } catch (error) { setMsg(error.message); } finally { setBusy(false); } }
  return <Shell title="Create & manage papers" kicker="EXAM AUTHORING" description="Manage legacy paper configurations or use the new question-bank importer."><div className="grid-2"><div className="panel"><div className="panel-head"><h3>New paper submission</h3></div><form onSubmit={create}><div className="field"><label>Paper title</label><input required value={title} onChange={(e) => setTitle(e.target.value)}/></div><div className="field"><label>Subject</label><select value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>Number of questions</label><input type="number" min="1" max="180" value={questions} onChange={(e) => setQuestions(Number(e.target.value))}/></div><button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : <>Submit for Review <Send size={15}/></>}</button>{msg && <div className="alert" role="status">{msg}</div>}</form></div><div className="panel"><h3>Document question banks</h3><p className="muted">Import PDF or Excel MCQs, review every extracted answer, and preview the exact student renderer.</p><Link to="/teacher/import" className="btn btn-primary">Open Import Question Bank <UploadCloud size={16}/></Link></div></div><div className="panel" style={{ marginTop: 22 }}><h3>Submitted papers</h3>{papers?.length ? <PaperTable papers={papers}/> : <Empty title="No papers yet"/>}</div></Shell>;
}

export function QuestionBank() {
  const { banks } = useBanks();
  return <Shell title="Question Bank" kicker="ACADEMIC CONTENT" description="Draft, submitted, and approved question banks."><div className="panel">{!banks ? <Loading/> : banks.length ? <BankTable banks={banks}/> : <Empty title="No question banks yet" text="Use Import Question Bank to upload PDF or Excel MCQs."/>}</div></Shell>;
}

export function ImportQuestionBank() {
  const { banks, refresh, token } = useBanks(); const inputRef = useRef(null);
  const submittingRef = useRef(false);
  const [file, setFile] = useState(null); const [title, setTitle] = useState(''); const [subject, setSubject] = useState('Physics');
  const [importMode, setImportMode] = useState('compatible_practice'); const [patternCode, setPatternCode] = useState(''); const [patterns, setPatterns] = useState([]);
  const [bank, setBank] = useState(null); const [progress, setProgress] = useState(0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [preview, setPreview] = useState(false); const [reviewReady, setReviewReady] = useState(false); const [previewIndex, setPreviewIndex] = useState(0);
  const questions = bank?.questions || [];
  const summary = useMemo(() => ({ valid: questions.filter((q) => !questionValidationIssues(q).length && !(q.extractionErrors || []).length && !q.duplicate).length, incomplete: questions.filter((q) => questionValidationIssues(q).length || q.extractionErrors?.some((error) => !duplicateError(error))).length, duplicates: questions.filter((q) => q.duplicate || q.extractionErrors?.some(duplicateError)).length, single: questions.filter((q) => q.questionType !== 'multiple_correct').length, multiple: questions.filter((q) => q.questionType === 'multiple_correct').length, subjects: [...new Set(questions.map((q) => q.subject).filter(Boolean))] }), [questions]);

  useEffect(() => { api('/exam-patterns', { token }).then((data) => setPatterns(data.patterns.filter((item) => item.status === 'active'))).catch(() => {}); }, [token]);
  function choose(selected) { if (!selected) return; if (!/\.(pdf|xlsx|xls|csv)$/i.test(selected.name)) { setMessage('Only PDF, XLSX, XLS, and CSV files are supported.'); return; } if (selected.size > 12 * 1024 * 1024) { setMessage('The file exceeds the 12 MB limit.'); return; } setFile(selected); setTitle(selected.name.replace(/\.[^.]+$/, '')); setMessage(''); }
  async function upload() { if (!file || busy) return; setBusy(true); setProgress(15); setMessage('Uploading securely…'); const timer = setInterval(() => setProgress((value) => Math.min(85, value + 8)), 350); try { const form = new FormData(); form.append('file', file); form.append('title', title); form.append('subject', subject); form.append('importMode', importMode); if (patternCode) form.append('patternCode', patternCode); const data = await api('/teacher/question-banks/import', { method: 'POST', token, body: form }); setBank(data.bank); setReviewReady(false); setProgress(100); setMessage(data.bank.questions.length ? `Imported ${data.bank.importSummary?.imported ?? data.bank.questions.length} question(s); ${data.bank.importSummary?.rejected ?? 0} row(s) rejected. Review warnings before submission.` : 'No questions were recognized. Try the documented Excel columns or a text-based PDF.'); refresh(); } catch (error) { setProgress(0); setMessage(error.message); } finally { clearInterval(timer); setBusy(false); } }
  async function openBank(id) { setBusy(true); try { const data = await api(`/teacher/question-banks/${id}`, { token }); setBank(data.bank); setTitle(data.bank.title); setSubject(data.bank.subject); setReviewReady(false); setMessage('Draft reopened.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  function updateQuestion(index, changes) { setReviewReady(false); setBank((current) => ({ ...current, questions: current.questions.map((question, i) => { if (i !== index) return question; const updated = { ...question, ...changes }; const stillInvalid = questionValidationIssues(updated); const extractionErrors = (updated.extractionErrors || []).filter((error) => {
    if (answerError(error) && !stillInvalid.includes('Answer Required')) return false;
    if (error === 'Question text is missing' && !stillInvalid.includes(error)) return false;
    if (error === 'At least two answer choices are required' && !stillInvalid.includes(error)) return false;
    return true;
  }); return { ...updated, extractionErrors }; }) })); }
  function updateOption(qIndex, oIndex, value) { const options = [...questions[qIndex].options]; options[oIndex] = value; updateQuestion(qIndex, { options }); }
  async function saveDraft() { if (!bank || busy) return null; setBusy(true); try { const data = await api(`/teacher/question-banks/${bank.id}`, { method: 'PUT', token, body: { title, subject, questions: questions.map((question) => compactQuestion(question, subject)) } }); setBank(data.bank); setMessage('Draft saved.'); refresh(); return data.bank; } catch (error) { setMessage(error.message); return null; } finally { setBusy(false); } }
  async function continueToSubmission() { if (summary.incomplete || summary.duplicates) { setMessage(`Resolve ${summary.incomplete} incomplete and ${summary.duplicates} duplicate question(s) before continuing.`); return; } const saved = await saveDraft(); if (saved) { setReviewReady(true); setMessage('Review complete. Your answers are saved and ready to submit.'); } }
  async function submit() { if (busy || submittingRef.current || !reviewReady) return; if (summary.incomplete || summary.duplicates) { setReviewReady(false); setMessage('The question bank changed. Resolve validation issues and continue again.'); return; } submittingRef.current = true; setBusy(true); try { const data = await api('/teacher/question-banks/submit', { method: 'POST', token, body: { id: bank.id } }); setBank(data.bank); setReviewReady(false); setMessage('Question bank submitted successfully for independent admin approval.'); refresh(); } catch (error) { setMessage(`Submission failed: ${error.message}. Your reviewed draft is preserved; you can retry safely.`); } finally { submittingRef.current = false; setBusy(false); } }

  return <Shell title="Import Question Bank" kicker="PDF & EXCEL TO MCQ" description="Upload → extract → review → preview → submit for approval.">
    {!bank && <div className="grid-2"><div className="panel"><div className={`drop-zone ${file ? 'has-file' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}><UploadCloud size={38}/><h3>Drop a PDF, Excel, or CSV file here</h3><p>Text PDFs, .xlsx, .xls, and .csv up to 12 MB</p><button className="btn btn-soft" type="button" onClick={() => inputRef.current?.click()}>Choose File</button><input ref={inputRef} hidden type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => choose(e.target.files[0])}/>{file && <div className="selected-file"><FileSpreadsheet size={18}/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB</span></div>}</div><div className="field"><label>Examination name</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy}/></div><div className="field"><label>Default or custom subject</label><input list="meritx-subjects" value={subject} maxLength="80" onChange={(e) => setSubject(e.target.value)}/><datalist id="meritx-subjects">{subjects.map((item) => <option key={item} value={item}/>)}</datalist></div><div className="field"><label>Target exam pattern</label><select value={patternCode} onChange={(e) => setPatternCode(e.target.value)}><option value="">Select later</option>{patterns.map((item) => <option value={item.code} key={item.id}>{item.name} · v{item.version}</option>)}</select></div><div className="field"><label>Import mode</label><select value={importMode} onChange={(e) => setImportMode(e.target.value)}><option value="compatible_practice">Compatible practice — preserve valid legacy questions and report limitations</option><option value="strict_standard">Strict standard — reject duplicates and incomplete native metadata</option></select></div>{progress > 0 && <div className="upload-progress"><i style={{ width: `${progress}%` }}/><span>{progress}%</span></div>}<button className="btn btn-primary" disabled={!file || !title || !subject.trim() || busy} onClick={upload}>{busy ? 'Extracting questions…' : 'Upload & Extract'}</button>{message && <div className="alert" role="status">{message}</div>}</div><div className="panel"><h3>Expected Excel columns</h3><p className="muted">Question ID, Exam, Subject, Chapter, Difficulty, Question Type, Question Text, Option A–D, Correct Answers, Explanation. Strict numerical and multi-paper formats additionally use Paper Number, Section Number, Numerical Answer, Precision, and Stem ID.</p><h3>PDF format</h3><p className="muted">Number each question, label options A–D, then include “Answer: B” and optionally “Explanation: …”. Scanned PDFs show an OCR warning instead of guessing content.</p>{banks?.length > 0 && <><h3>Reopen a draft</h3><BankTable banks={banks.filter((item) => !['approved', 'published'].includes(item.status))} onOpen={openBank}/></>}</div></div>}
    {bank && <><div className="review-toolbar"><div><strong>{title}</strong><span>{questions.length} questions · {summary.single} single · {summary.multiple} multiple · {summary.incomplete} incomplete · {summary.duplicates} duplicates · {summary.subjects.join(', ')}</span></div><div><button className="btn btn-outline small" onClick={() => setPreview(true)} disabled={!questions.length}><Eye size={15}/> Preview as Student</button><button className="btn btn-soft small" onClick={saveDraft} disabled={busy || !['draft', 'rejected'].includes(bank.status)}><Save size={15}/> Save Draft</button>{reviewReady ? <button className="btn btn-primary small" onClick={submit} disabled={busy || !['draft', 'rejected'].includes(bank.status)}><Send size={15}/> {busy ? 'Submitting…' : 'Submit for Approval'}</button> : <button className="btn btn-primary small" onClick={continueToSubmission} disabled={busy || !['draft', 'rejected'].includes(bank.status)}>Continue</button>}</div></div>{reviewReady && <div className="alert success" role="status"><CheckCircle2 size={16}/> All {summary.valid} questions and their correct answers are saved. Submit once to send this bank for admin approval.</div>}{bank.rejectionReason && <div className="alert error">Rejected: {bank.rejectionReason}</div>}{bank.warnings?.map((warning) => <div className="alert warning" key={warning}><AlertTriangle size={16}/>{warning}</div>)}<div className="question-editor-list">{questions.map((question, qIndex) => { const validationIssues = questionValidationIssues(question); const needsReview = validationIssues.length || (question.extractionErrors || []).length || question.duplicate; return <article className={`question-editor ${needsReview ? 'needs-review' : ''}`} key={question.id || qIndex}><header><strong>Question {qIndex + 1}</strong><span>{question.questionType === 'multiple_correct' ? 'Multiple correct' : 'Single correct'} · <b className={`validation-status ${needsReview ? 'review' : 'valid'}`}>{needsReview ? 'Manual review' : 'Answer validated'}</b></span><button aria-label={`Delete question ${qIndex + 1}`} onClick={() => { setReviewReady(false); setBank((current) => ({ ...current, questions: current.questions.filter((_, index) => index !== qIndex) })); }}><Trash2 size={16}/></button></header>{[...(question.extractionErrors || []), ...validationIssues].filter((error, index, items) => items.indexOf(error) === index).map((error) => <div className="inline-error" key={error}>{error}</div>)}{question.duplicate && <div className="inline-error">This question matches a submitted or approved question.</div>}<div className="field"><label>Question text</label><textarea rows="3" value={question.text} onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}/></div><div className="field"><label>Question type</label><select value={question.questionType || 'single_correct'} onChange={(e) => updateQuestion(qIndex, { questionType: e.target.value, correctOptions: e.target.value === 'single_correct' ? (question.correctOptions || []).slice(0, 1) : (question.correctOptions || []) })}><option value="single_correct">Single Correct</option><option value="multiple_correct">Multiple Correct</option></select></div><div className="option-editor">{question.options.map((option, oIndex) => { const checked = (question.correctOptions || []).includes(oIndex); return <div key={oIndex}><input type={question.questionType === 'multiple_correct' ? 'checkbox' : 'radio'} name={`answer-${qIndex}`} aria-label={`Correct option ${oIndex + 1}`} checked={checked} onChange={() => { const correctOptions = question.questionType === 'multiple_correct' ? (checked ? question.correctOptions.filter((value) => value !== oIndex) : [...(question.correctOptions || []), oIndex]) : [oIndex]; updateQuestion(qIndex, { correctOptions, correctOption: correctOptions.length === 1 ? correctOptions[0] : null }); }}/><span>{String.fromCharCode(65 + oIndex)}</span><input value={option} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}/><button aria-label="Delete option" onClick={() => { const options = question.options.filter((_, index) => index !== oIndex); const correctOptions = (question.correctOptions || []).filter((value) => value !== oIndex).map((value) => value > oIndex ? value - 1 : value); updateQuestion(qIndex, { options, correctOptions, correctOption: correctOptions.length === 1 ? correctOptions[0] : null }); }}><X size={15}/></button></div>; })}</div><button className="btn btn-soft small" onClick={() => updateQuestion(qIndex, { options: [...question.options, ''] })} disabled={question.options.length >= 8}><Plus size={14}/> Add option</button><div className="editor-metadata"><div className="field"><label>Subject</label><input list="meritx-subjects" value={question.subject || subject} onChange={(e) => updateQuestion(qIndex, { subject: e.target.value })}/></div><div className="field"><label>Chapter</label><input value={question.chapter} onChange={(e) => updateQuestion(qIndex, { chapter: e.target.value })}/></div><div className="field"><label>Topic</label><input value={question.topic} onChange={(e) => updateQuestion(qIndex, { topic: e.target.value })}/></div><div className="field"><label>Difficulty</label><select value={question.difficulty} onChange={(e) => updateQuestion(qIndex, { difficulty: e.target.value })}>{['Easy', 'Medium', 'Hard'].map((item) => <option key={item}>{item}</option>)}</select></div></div><div className="field"><label>Explanation</label><textarea rows="2" value={question.explanation} onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}/></div></article>; })}</div><button className="btn btn-soft" onClick={() => { setReviewReady(false); setBank((current) => ({ ...current, questions: [...current.questions, blankQuestion(subject)] })); }}><Plus size={16}/> Add Question</button>{message && <div className="alert" role="status">{message}</div>}</>}
    {preview && questions.length > 0 && <div className="modal-cover"><div className="student-preview-modal"><button className="preview-close" onClick={() => setPreview(false)} aria-label="Close preview"><X/></button><span className="eyebrow">STUDENT PREVIEW · QUESTION {previewIndex + 1} OF {questions.length}</span><QuestionRenderer question={questions[previewIndex]} disabled/><div className="preview-nav"><button className="btn btn-outline" disabled={previewIndex === 0} onClick={() => setPreviewIndex((index) => index - 1)}>Previous</button><button className="btn btn-primary" disabled={previewIndex === questions.length - 1} onClick={() => setPreviewIndex((index) => index + 1)}>Next</button></div></div></div>}
  </Shell>;
}
