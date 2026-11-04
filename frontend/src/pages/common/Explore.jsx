import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock3, Search, Users, ArrowUpRight, BookOpen, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell, Empty, Loading } from '../../components/Layouts';
import { useAuth } from '../../context/AuthContext';
import { api, friendlyDate, money } from '../../lib/api';
import '../student/Student.css';

export default function DashboardExplore() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [registeredExamIds, setRegisteredExamIds] = useState(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const promises = [
      api('/exams', { token }),
      api('/courses', { token }),
    ];
    if (token && user?.role === 'student') {
      promises.push(api('/me/dashboard', { token }).catch(() => null));
      promises.push(api('/me/courses', { token }).catch(() => null));
    }

    Promise.all(promises)
      .then(([e, c, dash, myCourses]) => {
        setExams(e?.exams || []);
        setCourses(c?.courses || []);
        const regSet = new Set();
        if (dash?.registrations) {
          dash.registrations.forEach(r => regSet.add(r.examId));
        }
        if (myCourses?.courses) {
          myCourses.courses.forEach(crs => {
            if (crs.primaryExamId) regSet.add(crs.primaryExamId);
            (crs.linkedExams || []).forEach(x => regSet.add(x.id));
          });
        }
        setRegisteredExamIds(regSet);
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [token, user]);

  const visible = exams.filter((exam) =>
    `${exam.title} ${exam.type} ${exam.subject}`.toLowerCase().includes(query.toLowerCase())
  );

  async function register(exam) {
    if (exam.fee > 0) {
      setMessage('Paid registration is disabled until legal review and provider approval are complete.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/exams/register', { method: 'POST', token, body: { examId: exam.id } });
      setRegisteredExamIds((prev) => new Set([...prev, exam.id]));
      setMessage('Your free examination registration is confirmed! Redirecting to My Registered Courses…');
      setTimeout(() => {
        navigate('/student/courses');
      }, 750);
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('already registered')) {
        setRegisteredExamIds((prev) => new Set([...prev, exam.id]));
        setMessage('You are already registered for this examination. Redirecting to My Registered Courses…');
        setTimeout(() => {
          navigate('/student/courses');
        }, 750);
      } else {
        setMessage(error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Explore"
      kicker={`${user?.role?.toUpperCase()} DISCOVERY`}
      description="Browse the published learning catalog and upcoming practice examinations."
    >
      <div className="explore-controls">
        <Search size={18} />
        <input
          aria-label="Search catalog"
          placeholder="Search examinations or subjects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {message && <div className="alert" role="status">{message}</div>}
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="explore-grid">
            {visible.map((exam) => {
              const isRegistered = registeredExamIds.has(exam.id);
              return (
                <button
                  className={`explore-card ${selected?.id === exam.id ? 'selected' : ''}`}
                  key={exam.id}
                  onClick={() => setSelected(exam)}
                >
                  <div className="explore-card-top">
                    <span>{exam.type}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {isRegistered && (
                        <span className="tag green" style={{ padding: '2px 8px', fontSize: 11 }}>
                          Registered ✓
                        </span>
                      )}
                      <span>
                        {exam.feeVisible === false ? 'Login for price' : exam.fee ? money(exam.fee) : 'FREE'}
                      </span>
                    </span>
                  </div>
                  <h3>{exam.title}</h3>
                  <p>{exam.subject}</p>
                  <div className="explore-meta">
                    <span><CalendarDays size={15} />{friendlyDate(exam.date)}</span>
                    <span><Clock3 size={15} />{exam.duration} min</span>
                    <span><Users size={15} />{exam.registered} enrolled</span>
                  </div>
                  <small>
                    {isRegistered ? 'registered · ready to start' : `${exam.status} · ${exam.registrationOpen === false ? 'registration closed' : 'registration available'}`}
                  </small>
                </button>
              );
            })}
          </div>
          {!visible.length && <Empty title="No matching examinations" text="Try another search." />}
          {selected && (
            <section className="panel explore-detail">
              <div>
                <span className="eyebrow">EXAM DETAILS</span>
                <h2>{selected.title}</h2>
                <p>{selected.description || selected.syllabus}</p>
                <p className="muted">
                  {selected.startsAt
                    ? new Date(selected.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
                    : friendlyDate(selected.date)}{' '}
                  · {selected.duration} minutes · {selected.questions} questions
                </p>
              </div>
              <div className="explore-actions">
                {user?.role === 'student' && registeredExamIds.has(selected.id) ? (
                  <>
                    <span
                      className="tag green"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 13, fontWeight: 700 }}
                    >
                      <Check size={16} /> Registered
                    </span>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate('/student/courses')}
                    >
                      Go to My Registered Courses <ArrowUpRight size={15} />
                    </button>
                    <Link to={`/take/${selected.id}`} className="btn btn-outline">
                      Start Exam Now
                    </Link>
                  </>
                ) : (
                  user?.role === 'student' && selected.fee === 0 && selected.registrationOpen !== false && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => register(selected)}
                    >
                      {busy ? 'Registering…' : 'Register for free'} <ArrowUpRight size={15} />
                    </button>
                  )
                )}
                {user?.role === 'student' && !registeredExamIds.has(selected.id) && selected.fee > 0 && (
                  <span className="muted">Paid registration unavailable</span>
                )}
                {user?.role !== 'student' && <span className="muted">View-only catalog for your role</span>}
                <button className="btn btn-outline" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </section>
          )}
          {courses.length > 0 && (
            <section className="explore-courses">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">LEARNING PATHS</span>
                  <h2>Published courses</h2>
                </div>
              </div>
              <div className="explore-grid">
                {courses.map((course) => (
                  <article className="explore-card course" key={course.id}>
                    {course.imageUrl && <img src={course.imageUrl} alt="" />}
                    <BookOpen size={18} />
                    <h3>{course.name}</h3>
                    <p>{course.shortDescription || course.category}</p>
                    <small>{course.publishedExamCount || 0} practice exams</small>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
