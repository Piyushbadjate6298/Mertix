import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  ClipboardList,
  Wallet,
  BookOpen,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
  Check,
  LifeBuoy,
  RefreshCw,
  ImagePlus,
  ListChecks,
  UploadCloud,
  X,
  Trash2,
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money, friendlyDate } from "../../lib/api";
import { PaperTable, BankTable } from "../teacher/Teacher";
import QuestionRenderer from "../../components/QuestionRenderer";
import "./Admin.css";
export function useOverview() {
  const { token } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = () =>
    api("/admin/overview", { token })
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [token]);
  return { data, error, refresh, token };
}
export function AdminDashboard() {
  const { data, error } = useOverview();
  return (
    <Shell
      title="Operations overview"
      kicker="ADMIN CONTROL CENTER"
      description="A clear view of exams, users, participation and performance."
      action={
        <Link to="/admin/exams" className="btn btn-primary small">
          Manage Exams <ArrowUpRight size={15} />
        </Link>
      }
    >
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid-4">
            <Stat
              icon={Users}
              label="Total Students"
              value={data.students}
              delta="Registered accounts"
            />
            <Stat
              icon={ClipboardList}
              label="Exam Registrations"
              value={data.registrations}
              tone="cyan"
              delta="Demo enrollments"
            />
            <Stat
              icon={BookOpen}
              label="Papers Submitted"
              value={data.papers.length}
              tone="purple"
              delta="Academic workflow"
            />
            <Stat
              icon={TrendingUp}
              label="Completed Attempts"
              value={data.attempts}
              tone="green"
              delta="Evaluated exams"
            />
          </div>
          <div className="grid-2" style={{ marginTop: 22 }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Examination schedule</h3>
                <Link className="action-link" to="/admin/exams">
                  See all →
                </Link>
              </div>
              {data.exams.map((e) => (
                <div className="admin-row" key={e.id}>
                  <div className="admin-row-icon">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {friendlyDate(e.date)} · {e.type}
                    </small>
                  </div>
                  <span className="tag">{e.status}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Latest system activity</h3>
              {data.audit.length ? (
                data.audit.slice(0, 6).map((a) => (
                  <div className="admin-row" key={a.id}>
                    <div className="admin-row-icon">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <strong>{a.action.replaceAll("_", " ")}</strong>
                      <small>
                        {a.detail} · {new Date(a.date).toLocaleString("en-IN")}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="No recent activity" />
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

const MAX_ARTWORK_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_ARTWORK_DATA_LENGTH = 1_800_000;

async function optimizeArtwork(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > MAX_ARTWORK_SOURCE_BYTES) throw new Error('The original image must be smaller than 8 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image could not be read.'));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / image.naturalWidth, 900 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const result = canvas.toDataURL('image/webp', quality);
      if (result.length <= MAX_ARTWORK_DATA_LENGTH) return result;
    }
    throw new Error('The optimized image is still too large. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ManageExams() {
  const { data, refresh, token } = useOverview();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  function edit(exam) {
    setEditing(exam.id);
    setForm({ title: exam.title, type: exam.type, subject: exam.subject, date: exam.date, duration: exam.duration, fee: exam.fee || 0, discountPercent: exam.discountPercent || 0, imageUrl: exam.imageUrl || null, description: exam.description || '', tag: exam.tag || '', status: exam.status, registrationOpen: exam.registrationOpen !== false });
    setMsg('');
  }
  async function chooseImage(file) {
    setImageBusy(true);
    try { field('imageUrl', await optimizeArtwork(file)); setMsg('Artwork ready. Save the examination to publish it.'); }
    catch (error) { setMsg(error.message); }
    finally { setImageBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMsg('');
    try {
      await api(`/admin/exams/${editing}`, { method: 'PUT', token, body: { ...form, duration: Number(form.duration), fee: Number(form.fee), discountPercent: Number(form.discountPercent) } });
      setMsg('Examination card and pricing updated.'); setEditing(null); setForm(null); refresh();
    } catch (error) { setMsg(error.message); }
    finally { setBusy(false); }
  }
  return (
    <Shell
      title="Examination management"
      kicker="EXAM OPERATIONS"
      description="Review exam inventory and control publication status."
    >
      {msg && <div className="alert">{msg}</div>}
      {!data ? <Loading /> : <div className="admin-catalog-layout">
        <div className="panel admin-catalog-list"><div className="panel-head"><div><h3>Examination catalog</h3><p className="muted">Edit every public card, including its image, price, date, and availability.</p></div><Link className="btn btn-soft small" to="/admin/import"><UploadCloud size={15}/> Import MCQs</Link></div>
          {data.exams.map((exam) => <div className={`admin-exam-row ${editing === exam.id ? 'selected' : ''}`} key={exam.id}>{exam.imageUrl ? <img src={exam.imageUrl} alt=""/> : <div className="admin-image-placeholder"><BookOpen size={20}/></div>}<div><strong>{exam.title}</strong><small>{exam.type} · {exam.questions} questions · {exam.fee ? money(exam.fee) : 'Free'} · {exam.status}</small></div><button className="btn btn-soft small" onClick={() => edit(exam)}>Edit</button></div>)}
        </div>
        {form ? <form className="panel admin-course-form admin-sticky-editor" onSubmit={save}><div className="panel-head"><h3>Edit examination</h3><button type="button" className="icon-button" aria-label="Close editor" onClick={() => { setEditing(null); setForm(null); }}><X size={18}/></button></div><ArtworkField label="Examination card image" value={form.imageUrl} busy={imageBusy} onChoose={chooseImage} onRemove={() => field('imageUrl', null)}/><label>Title<input required value={form.title} onChange={(e) => field('title', e.target.value)}/></label><div className="admin-form-grid"><label>Exam type<input required value={form.type} onChange={(e) => field('type', e.target.value)}/></label><label>Subjects<input required value={form.subject} onChange={(e) => field('subject', e.target.value)}/></label><label>Date<input required type="date" value={form.date} onChange={(e) => field('date', e.target.value)}/></label><label>Duration (minutes)<input required type="number" min="1" max="720" value={form.duration} onChange={(e) => field('duration', e.target.value)}/></label><label>Price (₹)<input type="number" min="0" step="0.01" value={form.fee} onChange={(e) => field('fee', e.target.value)}/></label><label>Discount %<input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => field('discountPercent', e.target.value)}/></label><label>Badge<input value={form.tag} onChange={(e) => field('tag', e.target.value)}/></label><label>Status<select value={form.status} onChange={(e) => field('status', e.target.value)}><option value="upcoming">Upcoming</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label></div><label>Description<textarea rows="4" value={form.description} onChange={(e) => field('description', e.target.value)}/></label><label className="admin-check"><input type="checkbox" checked={form.registrationOpen} onChange={(e) => field('registrationOpen', e.target.checked)}/> Registration open</label><div className="instruction-actions"><Link className="btn btn-outline" to="/admin/question-banks"><ListChecks size={16}/> Manage MCQs</Link><button className="btn btn-primary" disabled={busy || imageBusy}>{busy ? 'Saving…' : 'Save examination'}</button></div></form> : <div className="panel admin-editor-empty"><ImagePlus size={30}/><h3>Select an examination</h3><p>Choose Edit to update its public artwork, title, subjects, price, discount, schedule, and status.</p><Link className="btn btn-outline" to="/admin/question-banks">Review question banks</Link></div>}
      </div>}
    </Shell>
  );
}
export function ManageStudents() {
  const { data } = useOverview();
  return (
    <Shell
      title="Student directory"
      kicker="PEOPLE & PARTICIPATION"
      description="An overview of the registered demo student profiles."
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Target</th>
                  <th>City</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.users
                  .filter((u) => u.role === "student")
                  .map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.target || "—"}</td>
                      <td>{u.city || "—"}</td>
                      <td>
                        <span className="tag green">Active</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
export function ManagePapers() {
  const { data, refresh, token } = useOverview();
  const [msg, setMsg] = useState("");
  async function approve(id) {
    try {
      await api("/admin/papers/approve", {
        method: "POST",
        token,
        body: { id },
      });
      setMsg("Paper approved");
      refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }
  return (
    <Shell
      title="Paper review queue"
      kicker="QUALITY ASSURANCE"
      description="Independent review keeps examination content consistent."
    >
      {msg && <div className="alert">{msg}</div>}
      {!data ? (
        <Loading />
      ) : (
        <div className="panel">
          {data.papers.length ? (
            <PaperTable papers={data.papers} approve={approve} />
          ) : (
            <Empty
              title="Review queue is clear"
              text="Teachers can submit demo papers for review."
            />
          )}
        </div>
      )}
    </Shell>
  );
}

export function ManageQuestionBanks() {
  const { token } = useAuth();
  const [banks, setBanks] = useState(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [publishOptions, setPublishOptions] = useState({ patternId: '', courseId: '', importMode: 'compatible_practice', isFree: true, price: 0 });
  const refresh = () => api("/teacher/question-banks", { token }).then((data) => setBanks(data.banks)).catch((error) => setMessage(error.message));
  useEffect(() => { refresh(); Promise.all([api('/exam-patterns', { token }), api('/admin/courses', { token })]).then(([patternData, courseData]) => { setPatterns(patternData.patterns); setCourses(courseData.courses); setPublishOptions((current) => ({ ...current, patternId: current.patternId || patternData.patterns.find((item) => item.status === 'active')?.id || '' })); }).catch((error) => setMessage(error.message)); }, [token]);
  async function preview(id) { setBusy(true); try { const data = await api(`/teacher/question-banks/${id}`, { token }); setSelected(data.bank); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  async function approve(id) {
    setBusy(true);
    try { await api("/admin/question-banks/approve", { method: "POST", token, body: { id } }); setMessage("Question bank approved. It is ready for publication."); setSelected(null); refresh(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function reject(id) { const reason = window.prompt('Enter the rejection reason for the teacher:'); if (!reason?.trim()) return; setBusy(true); try { await api('/admin/question-banks/reject', { method: 'POST', token, body: { id, reason } }); setMessage('Paper rejected with a reason.'); setSelected(null); refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  async function publish(id) { if (!publishOptions.patternId) { setMessage('Select an examination pattern before publishing.'); return; } setBusy(true); try { const data = await api('/admin/question-banks/publish', { method: 'POST', token, body: { id, ...publishOptions, courseId: publishOptions.courseId || null, price: publishOptions.isFree ? 0 : Number(publishOptions.price) } }); setMessage(`Examination published with ID ${data.examId}.`); setSelected(null); refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <Shell title="Question paper approval" kicker="CONTENT APPROVAL" description="Preview every imported question, approve or reject it, then publish the approved paper as a student examination.">{message && <div className="alert" role="status">{message}</div>}<div className="panel" style={{ marginBottom: 18 }}><h3>Publication configuration</h3><div className="admin-form-grid"><label>Exam pattern<select value={publishOptions.patternId} onChange={(event) => setPublishOptions({ ...publishOptions, patternId: event.target.value })}><option value="">Select pattern</option>{patterns.filter((item) => item.status === 'active').map((item) => <option value={item.id} key={item.id}>{item.name} · v{item.version}</option>)}</select></label><label>Course<select value={publishOptions.courseId} onChange={(event) => setPublishOptions({ ...publishOptions, courseId: event.target.value })}><option value="">No course</option>{courses.filter((item) => item.status !== 'archived').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Validation mode<select value={publishOptions.importMode} onChange={(event) => setPublishOptions({ ...publishOptions, importMode: event.target.value })}><option value="compatible_practice">Compatible practice</option><option value="strict_standard">Strict standard</option></select></label><label>Access<select value={publishOptions.isFree ? 'free' : 'paid'} onChange={(event) => setPublishOptions({ ...publishOptions, isFree: event.target.value === 'free' })}><option value="free">Free</option><option value="paid">Paid (requires payment provider)</option></select></label></div><p className="muted">Strict mode blocks publication unless question counts, native types, subjects, and paper metadata exactly match the selected pattern.</p></div>{!banks ? <Loading/> : <div className="panel">{banks.filter((bank) => ['submitted', 'approved'].includes(bank.status)).length ? banks.filter((bank) => ['submitted', 'approved'].includes(bank.status)).map((bank) => <div className="bank-approval-row" key={bank.id}><div><strong>{bank.title}</strong><small>{bank.questionCount} questions · {bank.subject} · {bank.importMode?.replaceAll('_', ' ')} · submitted by {bank.teacherName || bank.createdBy} · {bank.status}</small></div><button className="btn btn-soft small" disabled={busy} onClick={() => preview(bank.id)}>Preview Paper</button>{bank.status === 'submitted' ? <><button className="btn btn-primary small" disabled={busy} onClick={() => approve(bank.id)}>Approve</button><button className="btn btn-outline small" disabled={busy} onClick={() => reject(bank.id)}>Reject</button></> : <button className="btn btn-primary small" disabled={busy} onClick={() => publish(bank.id)}>Publish Examination</button>}</div>) : <Empty title="Review queue is clear" text="Submitted question papers will appear here."/>}<h3 style={{ marginTop: 28 }}>All question banks</h3><BankTable banks={banks}/></div>}{selected && <div className="modal-cover"><div className="student-preview-modal"><button className="preview-close" onClick={() => setSelected(null)} aria-label="Close preview">×</button><span className="eyebrow">ADMIN REVIEW · {selected.questions.length} QUESTIONS</span><h2>{selected.title}</h2><p className="muted">Teacher: {selected.teacherName || selected.createdBy} · Subjects: {[...new Set(selected.questions.map((q) => q.subject))].join(', ')}</p>{selected.sourceLimitations?.length > 0 && <div className="alert">{selected.sourceLimitations.join(' ')}</div>}{selected.questions.map((question, index) => <article className="question-editor" key={question.id}><strong>Question {index + 1} · {question.questionType.replaceAll('_', ' ')}</strong><QuestionRenderer question={question} selected={question.questionType.includes('numerical') ? question.numericalAnswer : question.correctOptions} disabled showAnswer/><p><b>Correct answer:</b> {question.questionType.includes('numerical') ? question.numericalAnswer : question.correctOptions.map((value) => String.fromCharCode(65 + value)).join(', ')}</p>{question.explanation && <p><b>Explanation:</b> {question.explanation}</p>}</article>)}</div></div>}</Shell>;
}
export function ManageSupport() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState(null);
  useEffect(() => {
    api("/admin/tickets", { token })
      .then((d) => setTickets(d.tickets))
      .catch(() => setTickets([]));
  }, [token]);
  return (
    <Shell
      title="Support tickets"
      kicker="CUSTOMER EXPERIENCE"
      description="Review support queries from registered users."
    >
      {!tickets ? (
        <Loading />
      ) : (
        <div className="panel">
          {tickets.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>{t.subject}</td>
                      <td>{t.message}</td>
                      <td>{t.status}</td>
                      <td>{new Date(t.createdAt).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="All caught up" text="No support requests yet." />
          )}
        </div>
      )}
    </Shell>
  );
}

const emptyCourse = { slug: '', name: '', category: 'Engineering Entrance', examType: 'JEE Main', shortDescription: '', fullDescription: '', imageUrl: null, bannerImageUrl: null, fee: 0, discountPercent: 0, durationDays: 180, mockTestCount: 1, status: 'draft', visible: true, featured: false, displayOrder: 0 };

function ArtworkField({ label, value, busy, onChoose, onRemove }) {
  return <div className="admin-artwork-field"><span>{label}</span>{value ? <div className="admin-artwork-preview"><img src={value} alt={`${label} preview`}/><button type="button" className="btn btn-outline small" onClick={onRemove}><X size={14}/> Remove</button></div> : <div className="admin-artwork-empty"><ImagePlus size={23}/><small>No image selected</small></div>}<label className={`btn btn-soft small admin-upload-button ${busy ? 'disabled' : ''}`}><UploadCloud size={15}/> {busy ? 'Optimizing…' : 'Upload image'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onChoose(file); }}/></label><small>JPG, PNG, or WebP. Images are resized to 1600 × 900 and optimized before saving.</small></div>;
}

export function ManageCourses() {
  const { token } = useAuth();
  const [courses, setCourses] = useState(null), [exams, setExams] = useState(null), [form, setForm] = useState(emptyCourse), [editing, setEditing] = useState(null), [message, setMessage] = useState(''), [artworkBusy, setArtworkBusy] = useState('');
  const refresh = () => Promise.all([api('/admin/courses', { token }), api('/admin/exams', { token })]).then(([courseData, examData]) => { setCourses(courseData.courses); setExams(examData.exams); }).catch((error) => setMessage(error.message));
  useEffect(() => { refresh(); }, [token]);
  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  async function save(event) { event.preventDefault(); setMessage(''); try { await api(editing ? `/admin/courses/${editing}` : '/admin/courses', { method: editing ? 'PUT' : 'POST', token, body: { ...form, fee: Number(form.fee), discountPercent: Number(form.discountPercent), durationDays: Number(form.durationDays), mockTestCount: Number(form.mockTestCount), displayOrder: Number(form.displayOrder) } }); setMessage(editing ? 'Course updated.' : 'Course created.'); setForm(emptyCourse); setEditing(null); refresh(); } catch (error) { setMessage(error.message); } }
  function edit(item) { setEditing(item.id); setForm({ ...emptyCourse, ...item, imageUrl: item.imageUrl || null, bannerImageUrl: item.bannerImageUrl || null }); }
  async function chooseArtwork(name, file) { setArtworkBusy(name); try { field(name, await optimizeArtwork(file)); setMessage('Image optimized and ready. Save the course to publish it.'); } catch (error) { setMessage(error.message); } finally { setArtworkBusy(''); } }
  async function deleteCourse(item) { if (!window.confirm(`Delete “${item.name}” from the course catalog? Its published examinations will remain available until you delete them separately.`)) return; try { await api(`/admin/courses/${item.id}`, { method: 'DELETE', token }); setMessage('Course deleted from the catalog.'); if (editing === item.id) { setEditing(null); setForm(emptyCourse); } refresh(); } catch (error) { setMessage(error.message); } }
  async function deleteExam(item) { if (!window.confirm(`Delete “${item.title}” from the public catalog? This hides the card and prevents new registrations.`)) return; try { await api(`/admin/exams/${item.id}`, { method: 'DELETE', token }); setMessage('Public course card deleted.'); refresh(); } catch (error) { setMessage(error.message); } }
  return <Shell title="Course management" kicker="CATALOG OPERATIONS" description="Create, publish, price, illustrate, feature, reorder, and connect courses to MCQ examinations.">
    {message && <div className="alert" role="status">{message}</div>}
    <div className="admin-catalog-layout">
      <form className="panel admin-course-form" onSubmit={save}>
        <div className="panel-head"><div><h3>{editing ? 'Edit course' : 'New course'}</h3><p className="muted">Course details control the landing catalog and provide default artwork for linked examinations.</p></div></div>
        <div className="admin-artwork-grid"><ArtworkField label="Course card image" value={form.imageUrl} busy={artworkBusy === 'imageUrl'} onChoose={(file) => chooseArtwork('imageUrl', file)} onRemove={() => field('imageUrl', null)}/><ArtworkField label="Wide exam banner" value={form.bannerImageUrl} busy={artworkBusy === 'bannerImageUrl'} onChoose={(file) => chooseArtwork('bannerImageUrl', file)} onRemove={() => field('bannerImageUrl', null)}/></div>
        <label>Name<input required value={form.name} onChange={(e) => field('name', e.target.value)}/></label><label>Slug<input required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => field('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}/></label>
        <div className="admin-form-grid"><label>Category<input required value={form.category} onChange={(e) => field('category', e.target.value)}/></label><label>Exam type<input required value={form.examType} onChange={(e) => field('examType', e.target.value)}/></label><label>Price (₹)<input type="number" min="0" step="0.01" value={form.fee} onChange={(e) => field('fee', e.target.value)}/></label><label>Discount %<input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => field('discountPercent', e.target.value)}/></label><label>Access duration (days)<input type="number" min="0" value={form.durationDays} onChange={(e) => field('durationDays', e.target.value)}/></label><label>Advertised mock tests<input type="number" min="0" value={form.mockTestCount} onChange={(e) => field('mockTestCount', e.target.value)}/></label><label>Status<select value={form.status} onChange={(e) => field('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Display order<input type="number" value={form.displayOrder} onChange={(e) => field('displayOrder', e.target.value)}/></label></div>
        <label>Card description<textarea value={form.shortDescription} onChange={(e) => field('shortDescription', e.target.value)}/></label><label>Full description<textarea rows="4" value={form.fullDescription} onChange={(e) => field('fullDescription', e.target.value)}/></label><label className="admin-check"><input type="checkbox" checked={form.visible} onChange={(e) => field('visible', e.target.checked)}/> Visible publicly</label><label className="admin-check"><input type="checkbox" checked={form.featured} onChange={(e) => field('featured', e.target.checked)}/> Featured on landing page</label>
        <div className="instruction-actions"><button type="button" className="btn btn-outline" onClick={() => { setEditing(null); setForm(emptyCourse); }}>Clear</button><Link className="btn btn-soft" to="/admin/import"><UploadCloud size={16}/> Add MCQs</Link><button className="btn btn-primary" disabled={Boolean(artworkBusy)}>{editing ? 'Save changes' : 'Create course'}</button></div>
      </form>
      <div className="admin-catalog-stack">
        <div className="panel admin-catalog-list"><div className="panel-head"><div><h3>Public catalog cards <span className="admin-count">{exams?.length ?? '—'}</span></h3><p className="muted">These are the exact cards shown on “Discover. Prepare. Excel.”</p></div><Link className="btn btn-outline small" to="/admin/question-banks"><ListChecks size={15}/> MCQ workflow</Link></div>{!exams ? <Loading/> : exams.map((item) => <div className="admin-exam-row" key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <div className="admin-image-placeholder"><BookOpen size={20}/></div>}<div><strong>{item.title}</strong><small>{item.type} · {item.questions} MCQs · {item.fee ? money(item.fee) : 'Free'} · {item.status}</small></div><div className="admin-row-actions"><Link className="btn btn-soft small" to="/admin/exams">Edit</Link><button className="btn btn-outline danger small" onClick={() => deleteExam(item)}><Trash2 size={14}/> Delete</button></div></div>)}</div>
        <div className="panel admin-catalog-list"><div className="panel-head"><div><h3>Course packages <span className="admin-count">{courses?.length ?? '—'}</span></h3><p className="muted">Shared pricing, access, and default artwork for linked examinations.</p></div></div>{!courses ? <Loading/> : courses.map((item) => <div className={`admin-course-row ${editing === item.id ? 'selected' : ''}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <div className="admin-image-placeholder"><BookOpen size={20}/></div>}<div><strong>{item.name}</strong><small>{item.examType} · {item.status} · {item.fee ? money(item.fee) : 'Free'} · {item.publishedExamCount || 0} exams · {item.publishedQuestionCount || 0} MCQs</small></div><div className="admin-row-actions"><button className="btn btn-soft small" onClick={() => edit(item)}>Edit</button><button className="btn btn-outline danger small" onClick={() => deleteCourse(item)}><Trash2 size={14}/> Delete</button></div></div>)}</div>
      </div>
    </div>
  </Shell>;
}

export function PlatformConfiguration() {
  const { token } = useAuth();
  const [patterns, setPatterns] = useState(null), [content, setContent] = useState({ heading: '', description: '', buttonLabel: '', visible: true }), [message, setMessage] = useState('');
  const [patternForm, setPatternForm] = useState({ code: '', name: '', officialYear: 2026, status: 'draft', configuration: '{\n  "durationMinutes": 180,\n  "questionCount": 0,\n  "maximumMarks": 0,\n  "subjects": [],\n  "rules": {}\n}' });
  const refreshPatterns = () => api('/exam-patterns', { token }).then((data) => setPatterns(data.patterns));
  useEffect(() => { Promise.all([api('/exam-patterns', { token }), api('/landing-content')]).then(([patternData, landingData]) => { setPatterns(patternData.patterns); setContent((current) => ({ ...current, ...(landingData.content.about_courses || {}) })); }).catch((error) => setMessage(error.message)); }, [token]);
  async function save(event) { event.preventDefault(); try { await api('/admin/landing-content/about_courses', { method: 'PUT', token, body: content }); setMessage('Landing content updated.'); } catch (error) { setMessage(error.message); } }
  async function createPattern(event) { event.preventDefault(); try { const configuration = JSON.parse(patternForm.configuration); await api('/admin/exam-patterns', { method: 'POST', token, body: { ...patternForm, officialYear: Number(patternForm.officialYear), configuration } }); setMessage('New immutable pattern version created.'); refreshPatterns(); } catch (error) { setMessage(error instanceof SyntaxError ? 'Pattern configuration must be valid JSON.' : error.message); } }
  return <Shell title="Platform configuration" kicker="PATTERNS & LANDING" description="Review versioned exam definitions and manage the public landing section.">{message && <div className="alert">{message}</div>}<div className="grid-2"><div className="panel"><h3>Versioned exam patterns</h3>{!patterns ? <Loading/> : patterns.map((item) => <div className="admin-row" key={item.id}><div><strong>{item.name}</strong><small>{item.code} · version {item.version} · {item.configuration.questionCount} questions · {item.configuration.durationMinutes} minutes</small></div><span className={`tag ${item.status === 'active' ? 'green' : ''}`}>{item.status}</span></div>)}<div className="alert">Published exams retain a configuration snapshot, so later pattern versions never alter attempts already in progress.</div></div><form className="panel admin-course-form" onSubmit={createPattern}><h3>Create pattern version</h3><label>Stable code<input required pattern="[a-z0-9-]+" value={patternForm.code} onChange={(e) => setPatternForm({ ...patternForm, code: e.target.value })}/></label><label>Name<input required value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })}/></label><div className="admin-form-grid"><label>Official year<input type="number" value={patternForm.officialYear} onChange={(e) => setPatternForm({ ...patternForm, officialYear: e.target.value })}/></label><label>Status<select value={patternForm.status} onChange={(e) => setPatternForm({ ...patternForm, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option></select></label></div><label>Configuration JSON<textarea rows="12" spellCheck="false" value={patternForm.configuration} onChange={(e) => setPatternForm({ ...patternForm, configuration: e.target.value })}/></label><button className="btn btn-primary">Create new version</button></form><form className="panel admin-course-form" onSubmit={save}><h3>“About Our Courses” section</h3><label>Heading<input value={content.heading} onChange={(e) => setContent({ ...content, heading: e.target.value })}/></label><label>Description<textarea rows="5" value={content.description} onChange={(e) => setContent({ ...content, description: e.target.value })}/></label><label>Button label<input value={content.buttonLabel} onChange={(e) => setContent({ ...content, buttonLabel: e.target.value })}/></label><label><input type="checkbox" checked={content.visible} onChange={(e) => setContent({ ...content, visible: e.target.checked })}/> Visible</label><button className="btn btn-primary">Save landing content</button></form></div></Shell>;
}
