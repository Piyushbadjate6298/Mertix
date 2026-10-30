import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Target,
  Trophy,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  Clock3,
  Wallet,
  LifeBuoy,
  BookOpen,
  GraduationCap,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Settings,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Send,
  Building,
  Smartphone,
  Check,
  X,
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

export function useWallet() {
  const { token } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    return api("/me/wallet", { token })
      .then((data) => {
        const w = data.wallet || data;
        setWallet(w);
        setError("");
        return w;
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  return { wallet, error, loading, refresh, token };
}

/* ==========================================================================
   Course Checkout Modal (Atomic Wallet Debit with Shortfall Alert)
   ========================================================================== */
export function CourseCheckoutModal({ course, wallet, onClose, onEnrolled, onAddMoney }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  if (!course) return null;

  const price = Number(course.effectivePrice ?? course.fee ?? 0);
  const availableBalance = Number(wallet?.availableBalance ?? 0);
  const hasSufficient = availableBalance >= price;
  const shortfall = Math.max(0, price - availableBalance);
  const remaining = Math.max(0, availableBalance - price);

  async function handleEnroll() {
    setBusy(true);
    setError("");
    try {
      const res = await api("/me/courses/enroll", {
        method: "POST",
        token,
        body: { courseId: course.id },
      });
      setSuccess(res);
      if (onEnrolled) onEnrolled(res);
    } catch (err) {
      setError(err.message || "Enrollment failed. Please check your balance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="checkout-modal-header">
          <div>
            <span className="demo-pill">DEMO MODE · SIMULATED WALLET</span>
            <h3>Course Checkout</h3>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="checkout-success-view">
            <div className="checkout-success-icon">
              <CheckCircle2 size={48} color="#10b981" />
            </div>
            <h4>Enrollment Confirmed!</h4>
            <p className="muted">
              You are now enrolled in <strong>{course.name || course.title}</strong>. The fee of{" "}
              <strong>{money(price)}</strong> has been debited atomically from your student wallet.
            </p>
            <div className="checkout-breakdown" style={{ marginTop: 16 }}>
              <div className="breakdown-row">
                <span>Transaction Reference</span>
                <code>{success.reference}</code>
              </div>
              <div className="breakdown-row">
                <span>Updated Wallet Balance</span>
                <strong style={{ color: "#10b981" }}>{money(success.wallet?.availableBalance ?? remaining)}</strong>
              </div>
            </div>
            <div className="checkout-modal-actions" style={{ marginTop: 24 }}>
              <Link to="/student/courses" className="btn btn-primary" onClick={onClose}>
                Go to My Courses <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="checkout-course-summary">
              <div className="checkout-course-details">
                <h4>{course.name || course.title}</h4>
                <p className="muted">{course.shortDescription || course.category || "Full Course Access"}</p>
                <div className="checkout-meta-tags">
                  <span>Instructor: {course.teacherName || "Meritx Faculty"}</span>
                  <span>Duration: {course.durationDays || 180} Days</span>
                </div>
              </div>
            </div>

            <div className="checkout-breakdown">
              <div className="breakdown-row">
                <span>Course Price</span>
                <strong>{money(price)}</strong>
              </div>
              <div className="breakdown-row">
                <span>Your Available Balance</span>
                <strong style={{ color: hasSufficient ? "#10b981" : "#ef4444" }}>
                  {money(availableBalance)}
                </strong>
              </div>
              <div className="breakdown-divider" />
              {hasSufficient ? (
                <div className="breakdown-row">
                  <span>Balance After Enrollment</span>
                  <strong>{money(remaining)}</strong>
                </div>
              ) : (
                <div className="breakdown-row shortfall-row">
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>Shortfall</span>
                  <strong style={{ color: "#ef4444" }}>{money(shortfall)}</strong>
                </div>
              )}
            </div>

            {error && (
              <div className="alert error" style={{ margin: "14px 0" }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {!hasSufficient && (
              <div className="checkout-shortfall-alert">
                <AlertCircle size={18} color="#ef4444" />
                <div>
                  <strong>Insufficient Wallet Balance</strong>
                  <p>You need an additional {money(shortfall)} to enroll in this course.</p>
                </div>
              </div>
            )}

            <div className="checkout-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              {hasSufficient ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={handleEnroll}
                >
                  {busy ? "Processing Enrollment..." : `Pay ${money(price)} & Enroll Now`}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    if (onAddMoney) onAddMoney(shortfall);
                  }}
                >
                  <Plus size={16} /> Add {money(shortfall)} to Wallet
                </button>
              )}
            </div>
            <p className="checkout-safe-note">
              <ShieldCheck size={14} /> Row-level locking & atomic database debit prevent duplicate charges.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Section 1: Student Dashboard Overview
   ========================================================================== */
export function StudentDashboard() {
  const { user } = useAuth();
  const { data, error: studentError } = useStudent();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      api("/me/courses", { token })
        .then((res) => setEnrolledCourses(res.courses || []))
        .catch(() => {});
      api("/exams", { token })
        .then((d) => setExams(d.exams || []))
        .catch(() => {});
    }
  }, [token]);

  if (!data) {
    return (
      <Shell title="Student Dashboard">
        {studentError ? <div className="alert error">{studentError}</div> : <Loading />}
      </Shell>
    );
  }

  const attempts = data.attempts?.filter((a) => a.status === "submitted") || [];
  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.result.correct, 0) / attempts.length)
    : 0;
  const acc = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.result.accuracy, 0) / attempts.length)
    : 0;

  const recentTransactions = (wallet?.transactions || []).slice(0, 5);

  return (
    <Shell
      title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
      kicker="STUDENT LEARNING & FINANCE HUB"
      description="Track your enrolled courses, wallet balance, and exam preparation."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/student/deposit" className="btn btn-primary small">
            <Plus size={15} /> Add Money
          </Link>
          <Link to="/student/browse" className="btn btn-outline small">
            Browse Courses <ArrowUpRight size={15} />
          </Link>
        </div>
      }
    >
      {/* Prominent Wallet Hero Card */}
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <span className="demo-pill">DEMO MODE · SIMULATED INR</span>
          <div className="wallet-hero-label">Available Wallet Balance</div>
          <div className="wallet-hero-balance">
            {money(wallet?.availableBalance ?? 0)}
          </div>
          <p className="wallet-hero-sub">
            Individual student wallet · Instant debit for course enrollments.
          </p>
        </div>
        <div className="wallet-hero-actions">
          <Link to="/student/deposit" className="btn btn-white">
            <Plus size={16} /> Add Money
          </Link>
          <Link to="/student/withdraw" className="btn btn-glass">
            <ArrowUpRight size={16} /> Withdraw
          </Link>
          <Link to="/student/wallet" className="btn btn-glass">
            <Wallet size={16} /> View Ledger
          </Link>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid-4" style={{ marginTop: 20 }}>
        <Stat
          icon={Wallet}
          label="Available Balance"
          value={money(wallet?.availableBalance ?? 0)}
          tone="green"
          delta="Ready for enrollments"
        />
        <Stat
          icon={GraduationCap}
          label="Enrolled Courses"
          value={enrolledCourses.length}
          tone="purple"
          delta="Active access"
        />
        <Stat
          icon={Trophy}
          label="Tests Completed"
          value={attempts.length}
          tone="cyan"
          delta="Mock attempts"
        />
        <Stat
          icon={CreditCard}
          label="Total Course Spent"
          value={money(wallet?.totalSpent ?? 0)}
          delta="Simulated ledger"
        />
      </div>

      {/* 2-Column Panels: Enrolled Courses & Recent Transactions */}
      <div className="grid-2 student-panels">
        {/* Enrolled Courses */}
        <section className="panel">
          <div className="panel-head">
            <h3>My Enrolled Courses</h3>
            <Link className="action-link" to="/student/courses">
              View all ({enrolledCourses.length}) <ArrowUpRight size={14} />
            </Link>
          </div>
          {enrolledCourses.length ? (
            enrolledCourses.slice(0, 4).map((c) => (
              <div className="dashboard-exam" key={c.enrollmentId || c.id}>
                <div className="mini-exam-icon">
                  <BookOpen size={20} />
                </div>
                <div>
                  <strong>{c.name || c.title}</strong>
                  <small>
                    Instructor: {c.teacherName || "Faculty"} · {c.durationDays || 180} days access ·{" "}
                    Enrolled {new Date(c.enrolledAt).toLocaleDateString("en-IN")}
                  </small>
                </div>
                <Link className="btn btn-soft small" to="/student/explore">
                  Practice <ArrowUpRight size={14} />
                </Link>
              </div>
            ))
          ) : (
            <div style={{ padding: "20px 0" }}>
              <Empty
                title="No enrolled courses yet"
                text="Browse our course catalog and enroll using your wallet balance."
              />
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Link to="/student/browse" className="btn btn-primary small">
                  Browse Courses Now
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="panel">
          <div className="panel-head">
            <h3>Recent Wallet Transactions</h3>
            <Link className="action-link" to="/student/transactions">
              Full ledger <ArrowUpRight size={14} />
            </Link>
          </div>
          {recentTransactions.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type?.replace("_", " ")}
                        </span>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {tx.description || tx.referenceNumber}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: tx.type === "deposit" || tx.type === "refund" ? "#10b981" : "#ef4444",
                        }}
                      >
                        {tx.type === "deposit" || tx.type === "refund" ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No transactions yet"
              text="Your wallet ledger is currently empty. Add money to get started."
            />
          )}
        </section>
      </div>

      {/* Motivational Banner */}
      <div className="student-banner">
        <div>
          <span>LEVEL UP YOUR PREPARATION</span>
          <h2>
            Smarter study tools. Transparent wallet.
            <br />
            Make every mock test count.
          </h2>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <Link className="btn btn-white small" to="/student/browse">
              Browse Course Catalog <ArrowUpRight size={15} />
            </Link>
            <Link className="btn btn-glass small" to="/student/deposit">
              Add Money to Wallet
            </Link>
          </div>
        </div>
        <div className="banner-illustration">✦</div>
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 2: My Courses
   ========================================================================== */
export function MyCourses() {
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCourses = () => {
    setLoading(true);
    api("/me/courses", { token })
      .then((res) => {
        setCourses(res.courses || []);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadCourses();
  }, [token]);

  return (
    <Shell
      title="My Enrolled Courses"
      kicker="ACADEMIC ENROLLMENTS"
      description="All courses unlocked through your Meritx student wallet."
      action={
        <Link to="/student/browse" className="btn btn-primary small">
          <Plus size={16} /> Browse New Courses
        </Link>
      }
    >
      {error && <div className="alert error">{error}</div>}
      {loading ? (
        <Loading />
      ) : courses.length ? (
        <div className="course-catalog-grid">
          {courses.map((course) => (
            <article className="course-catalog-card" key={course.enrollmentId || course.id}>
              {course.imageUrl ? (
                <div className="course-card-image">
                  <img src={course.imageUrl} alt={course.name} />
                </div>
              ) : (
                <div className="course-card-image placeholder">
                  <BookOpen size={40} />
                </div>
              )}
              <div className="course-card-body">
                <div className="course-card-tags">
                  <span className="course-tag-category">{course.category || "Preparation"}</span>
                  <span className="tag green">Active Access</span>
                </div>
                <h3>{course.name || course.title}</h3>
                <p className="course-desc">
                  {course.shortDescription || course.fullDescription || "Comprehensive curriculum and mock tests."}
                </p>
                <div className="course-card-meta">
                  <div>
                    <User size={14} />
                    <span>Instructor: <strong>{course.teacherName || "Meritx Faculty"}</strong></span>
                  </div>
                  <div>
                    <Clock3 size={14} />
                    <span>Duration: <strong>{course.durationDays || 180} Days</strong></span>
                  </div>
                  <div>
                    <CalendarDays size={14} />
                    <span>Enrolled: <strong>{new Date(course.enrolledAt).toLocaleDateString("en-IN")}</strong></span>
                  </div>
                </div>
                <div className="course-card-footer">
                  <div>
                    <small className="muted">PAID VIA WALLET</small>
                    <strong style={{ display: "block", color: "#10b981", fontSize: 16 }}>
                      {money(course.amountPaid || course.effectivePrice || 0)}
                    </strong>
                  </div>
                  <Link to="/student/explore" className="btn btn-primary small">
                    Start Learning <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <BookOpen size={48} color="#94a3b8" style={{ margin: "0 auto 16px" }} />
          <h3>No Enrolled Courses Yet</h3>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 20px" }}>
            You have not enrolled in any courses yet. Explore our published courses and enroll instantly using your student wallet.
          </p>
          <Link to="/student/browse" className="btn btn-primary">
            Explore Course Catalog <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
    </Shell>
  );
}

/* ==========================================================================
   Section 3: Browse Courses (Authenticated Price Visibility & Instant Checkout)
   ========================================================================== */
export function BrowseCourses() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [myCourseIds, setMyCourseIds] = useState(new Set());
  const { wallet, refresh: refreshWallet } = useWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api("/courses", { token }),
      api("/me/courses", { token }).catch(() => ({ courses: [] })),
    ])
      .then(([courseRes, myRes]) => {
        setCourses(courseRes.courses || []);
        const enrolledSet = new Set((myRes.courses || []).map((c) => c.courseId || c.id));
        setMyCourseIds(enrolledSet);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const filtered = courses.filter((c) =>
    `${c.name} ${c.category} ${c.examType} ${c.teacherName || ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <Shell
      title="Browse Courses"
      kicker="COURSE CATALOG"
      description="Explore curated courses taught by premier faculty. Enroll directly using your student wallet."
      action={
        <div className="wallet-mini-pill">
          <Wallet size={16} />
          <span>Wallet Balance: <strong>{money(wallet?.availableBalance ?? 0)}</strong></span>
          <Link to="/student/deposit" className="btn-mini-add">
            + Add
          </Link>
        </div>
      }
    >
      <div className="catalog-header-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search courses by title, category, or instructor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="demo-mode-badge">
          <ShieldCheck size={16} /> DEMO MODE: Simulated Purchases
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="course-catalog-grid">
          {filtered.map((course) => {
            const isEnrolled = myCourseIds.has(course.id);
            const price = Number(course.effectivePrice ?? course.fee ?? 0);
            return (
              <article className="course-catalog-card" key={course.id}>
                {course.imageUrl ? (
                  <div className="course-card-image">
                    <img src={course.imageUrl} alt={course.name} />
                  </div>
                ) : (
                  <div className="course-card-image placeholder">
                    <BookOpen size={40} />
                  </div>
                )}
                <div className="course-card-body">
                  <div className="course-card-tags">
                    <span className="course-tag-category">{course.category}</span>
                    {course.discountPercent > 0 && (
                      <span className="tag orange">{course.discountPercent}% OFF</span>
                    )}
                  </div>
                  <h3>{course.name}</h3>
                  <p className="course-desc">
                    {course.shortDescription || course.fullDescription}
                  </p>
                  <div className="course-card-meta">
                    <div>
                      <User size={14} />
                      <span>Instructor: <strong>{course.teacherName || "Faculty"}</strong></span>
                    </div>
                    <div>
                      <Clock3 size={14} />
                      <span>Duration: <strong>{course.durationDays || 180} Days</strong></span>
                    </div>
                    <div>
                      <Target size={14} />
                      <span>{course.enrolledStudentCount || 0} students enrolled</span>
                    </div>
                  </div>
                  <div className="course-card-footer">
                    <div className="course-price-wrap">
                      <small className="muted">PRICE</small>
                      <div className="price-display">
                        <strong className="current-price">{price > 0 ? money(price) : "FREE"}</strong>
                        {course.discountPercent > 0 && (
                          <span className="original-price">{money(course.fee)}</span>
                        )}
                      </div>
                    </div>
                    {isEnrolled ? (
                      <span className="btn btn-soft small enrolled-pill">
                        <Check size={14} /> Enrolled
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary small"
                        onClick={() => setSelectedCourse(course)}
                      >
                        Enroll Now <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="No matching courses" text="Try searching with different terms." />
      )}

      {selectedCourse && (
        <CourseCheckoutModal
          course={selectedCourse}
          wallet={wallet}
          onClose={() => setSelectedCourse(null)}
          onEnrolled={() => {
            refreshWallet();
            loadData();
          }}
          onAddMoney={(shortfall) => {
            navigate("/student/deposit", { state: { suggestedAmount: shortfall } });
          }}
        />
      )}
    </Shell>
  );
}

/* ==========================================================================
   Section 4: My Wallet
   ========================================================================== */
export function MyWallet() {
  const { wallet, loading, error, refresh } = useWallet();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const transactions = (wallet?.transactions || []).filter((tx) => {
    const matchType = filter === "all" || tx.type === filter;
    const matchSearch =
      !search ||
      tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.id?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <Shell
      title="My Wallet"
      kicker="INDIVIDUAL STUDENT WALLET"
      description="Manage your funds in INR (₹). Simulated transactions in Demo Mode."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={15} /> Refresh
          </button>
          <Link to="/student/deposit" className="btn btn-primary small">
            <Plus size={15} /> Add Money
          </Link>
          <Link to="/student/withdraw" className="btn btn-soft small">
            Withdraw
          </Link>
        </div>
      }
    >
      {error && <div className="alert error">{error}</div>}

      {/* Prominent Balance Banner */}
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <span className="demo-pill">DEMO MODE · SIMULATED INR</span>
          <div className="wallet-hero-label">Available Wallet Balance</div>
          <div className="wallet-hero-balance">
            {money(wallet?.availableBalance ?? 0)}
          </div>
          <p className="wallet-hero-sub">
            Eligible for course purchases and withdrawal requests.
          </p>
        </div>
        <div className="wallet-hero-actions">
          <Link to="/student/deposit" className="btn btn-white">
            <Plus size={16} /> Add Money
          </Link>
          <Link to="/student/withdraw" className="btn btn-glass">
            <ArrowUpRight size={16} /> Withdraw
          </Link>
        </div>
      </div>

      {/* Wallet Stats Breakdown */}
      <div className="grid-4" style={{ marginTop: 22 }}>
        <Stat
          icon={ArrowDownLeft}
          label="Total Deposited"
          value={money(wallet?.totalDeposited ?? 0)}
          tone="green"
          delta="Simulated deposits"
        />
        <Stat
          icon={BookOpen}
          label="Spent on Courses"
          value={money(wallet?.totalSpent ?? 0)}
          tone="purple"
          delta="Enrolled courses"
        />
        <Stat
          icon={ArrowUpRight}
          label="Total Withdrawn"
          value={money(wallet?.totalWithdrawn ?? 0)}
          tone="cyan"
          delta="Processed payouts"
        />
        <Stat
          icon={Clock3}
          label="Pending / Reserved"
          value={money(wallet?.pendingWithdrawals ?? 0)}
          tone="orange"
          delta="In processing"
        />
      </div>

      {/* Demo Notice */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={20} color="#2563eb" />
          <h4 style={{ margin: 0 }}>Demo Mode Notice</h4>
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
          Real payments are disabled until credentials and merchant onboarding are configured.
          Simulated transactions use safe atomic database locks. Deposits and course enrollments are
          instantly reflected in your personal ledger.
        </p>
      </div>

      {/* Ledger Table */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h3>Wallet Transaction Ledger</h3>
            <p className="muted">Complete record of credits, debits, and adjustments.</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search reference or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: "6px 12px", width: 220 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter transactions"
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="course_purchase">Course Purchases</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || tx.type === "refund";
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code>{tx.id.slice(0, 12)}...</code>
                      </td>
                      <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{tx.description}</td>
                      <td>
                        <code>{tx.referenceNumber || "—"}</code>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isCredit ? "#10b981" : "#ef4444",
                        }}
                      >
                        {isCredit ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No transactions found"
            text="Add money to your wallet or enroll in a course to see ledger activity."
          />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 5: Add Money (Simulated Demo Payment Flow)
   ========================================================================== */
export function AddMoney() {
  const { token } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const navigate = useNavigate();

  const [amount, setAmount] = useState(1000);
  const [method, setMethod] = useState("upi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const presets = [500, 1000, 2000, 5000];

  async function handleDeposit(e) {
    e.preventDefault();
    if (amount < 10) {
      setError("Minimum deposit amount is ₹10.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      // 1. Create deposit order
      const orderRes = await api("/me/wallet/deposit/order", {
        method: "POST",
        token,
        body: { amount: Number(amount), paymentMethod: method },
      });

      // 2. Simulate payment gateway verification (Demo Mode)
      const verifyRes = await api("/me/wallet/deposit/verify", {
        method: "POST",
        token,
        body: {
          orderId: orderRes.orderId,
          paymentId: `pay_demo_${Date.now()}`,
          signature: "demo_sig_verified",
        },
      });

      setReceipt(verifyRes);
      refreshWallet();
    } catch (err) {
      setError(err.message || "Deposit simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Add Money"
      kicker="WALLET RECHARGE"
      description="Add funds to your individual student wallet using simulated Demo Mode payments."
      action={
        <div className="wallet-mini-pill">
          <Wallet size={16} />
          <span>Available: <strong>{money(wallet?.availableBalance ?? 0)}</strong></span>
        </div>
      }
    >
      <div className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div className="demo-notice-banner">
          <ShieldCheck size={20} color="#2563eb" />
          <div>
            <strong>DEMO MODE: Simulated Payment Flow</strong>
            <p>
              In production, this initiates a Razorpay / UPI order. Test transactions will credit your
              demo wallet immediately without charging a real bank account.
            </p>
          </div>
        </div>

        {receipt ? (
          <div className="checkout-success-view" style={{ padding: "30px 10px" }}>
            <div className="checkout-success-icon">
              <CheckCircle2 size={54} color="#10b981" />
            </div>
            <h3>Wallet Credited Successfully!</h3>
            <p className="muted">
              Your deposit of <strong>{money(amount)}</strong> has been processed and credited to your
              student wallet ledger.
            </p>
            <div className="checkout-breakdown" style={{ marginTop: 20 }}>
              <div className="breakdown-row">
                <span>Transaction Reference</span>
                <code>{receipt.reference}</code>
              </div>
              <div className="breakdown-row">
                <span>Updated Available Balance</span>
                <strong style={{ color: "#10b981", fontSize: 18 }}>
                  {money(receipt.wallet?.availableBalance ?? 0)}
                </strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setReceipt(null);
                  setAmount(1000);
                }}
              >
                Add More Funds
              </button>
              <Link to="/student/browse" className="btn btn-primary">
                Browse Courses <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDeposit} style={{ marginTop: 20 }}>
            {error && <div className="alert error">{error}</div>}

            <div className="field">
              <label>Select or Enter Amount (INR ₹)</label>
              <div className="deposit-presets-grid">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn-preset ${amount === p ? "active" : ""}`}
                    onClick={() => setAmount(p)}
                  >
                    ₹{p.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
              <div className="amount-input-wrap" style={{ marginTop: 12 }}>
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  min="10"
                  max="100000"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Enter custom amount"
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 24 }}>
              <label>Select Payment Method</label>
              <div className="payment-method-grid">
                <label className={`method-card ${method === "upi" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="upi"
                    checked={method === "upi"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <Smartphone size={24} />
                  <div>
                    <strong>UPI (Instant)</strong>
                    <small>Google Pay, PhonePe, Paytm</small>
                  </div>
                </label>

                <label className={`method-card ${method === "card" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="card"
                    checked={method === "card"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <CreditCard size={24} />
                  <div>
                    <strong>Debit / Credit Card</strong>
                    <small>Visa, Mastercard, RuPay</small>
                  </div>
                </label>

                <label className={`method-card ${method === "netbanking" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="netbanking"
                    checked={method === "netbanking"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <Building size={24} />
                  <div>
                    <strong>Net Banking</strong>
                    <small>All Indian Major Banks</small>
                  </div>
                </label>
              </div>
            </div>

            {/* Review Box */}
            <div className="checkout-breakdown" style={{ marginTop: 24 }}>
              <div className="breakdown-row">
                <span>Deposit Amount</span>
                <strong>{money(amount)}</strong>
              </div>
              <div className="breakdown-row">
                <span>Payment Gateway Fee</span>
                <strong style={{ color: "#10b981" }}>FREE (₹0)</strong>
              </div>
              <div className="breakdown-divider" />
              <div className="breakdown-row">
                <span>Total Payable</span>
                <strong style={{ fontSize: 18 }}>{money(amount)}</strong>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 24 }}
              disabled={busy}
            >
              {busy ? "Processing Simulated Payment..." : `Proceed to Deposit ${money(amount)} (Demo)`}
            </button>
            <p className="checkout-safe-note" style={{ marginTop: 12 }}>
              <ShieldCheck size={14} /> Server-side order creation & cryptographic signature simulation.
            </p>
          </form>
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 6: Withdraw Money (Fund Reservation & Admin Approval Workflow)
   ========================================================================== */
export function WithdrawMoney() {
  const { token } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState(500);
  const [payoutMethod, setPayoutMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState({
    accountNumber: "",
    ifsc: "",
    holderName: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadWithdrawals = () => {
    api("/me/wallet/withdrawals", { token })
      .then((res) => setWithdrawals(res.withdrawals || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (token) loadWithdrawals();
  }, [token]);

  const available = Number(wallet?.availableBalance ?? 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (amount <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }
    if (amount > available) {
      setError(`Cannot withdraw more than available balance (${money(available)}).`);
      return;
    }

    const destination =
      payoutMethod === "upi"
        ? { upiId }
        : {
            accountNumber: bankAccount.accountNumber,
            ifsc: bankAccount.ifsc,
            holderName: bankAccount.holderName,
          };

    if (payoutMethod === "upi" && !upiId.includes("@")) {
      setError("Please enter a valid UPI ID (e.g., yourname@okhdfcbank).");
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      await api("/me/wallet/withdraw", {
        method: "POST",
        token,
        body: {
          amount: Number(amount),
          payoutMethod,
          destinationDetails: destination,
        },
      });

      setFeedback("Withdrawal request submitted! Funds have been reserved from your available balance.");
      setAmount(500);
      setUpiId("");
      setBankAccount({ accountNumber: "", ifsc: "", holderName: "" });
      refreshWallet();
      loadWithdrawals();
    } catch (err) {
      setError(err.message || "Failed to submit withdrawal request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Withdraw Money"
      kicker="PAYOUT REQUEST"
      description="Request withdrawal of eligible student wallet funds to your verified account."
      action={
        <div className="wallet-mini-pill">
          <Wallet size={16} />
          <span>Available: <strong>{money(available)}</strong></span>
        </div>
      }
    >
      <div className="grid-2">
        {/* Request Form */}
        <div className="panel">
          <div className="panel-head">
            <h3>New Withdrawal Request</h3>
            <span className="demo-pill">DEMO SIMULATION</span>
          </div>

          <div className="demo-notice-banner" style={{ margin: "14px 0" }}>
            <ShieldCheck size={18} color="#2563eb" />
            <div>
              <strong>Funds Reservation Policy</strong>
              <p>
                Requested funds are immediately locked and deducted from your available balance. An
                admin will review your request. If approved, status changes to Completed. If
                rejected, reserved funds are safely restored to your available balance.
              </p>
            </div>
          </div>

          {error && <div className="alert error">{error}</div>}
          {feedback && <div className="alert success">{feedback}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Withdrawal Amount (INR ₹)</label>
              <div className="amount-input-wrap">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  min="100"
                  max={available}
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Amount to withdraw"
                />
              </div>
              <small className="muted">
                Available to withdraw: <strong>{money(available)}</strong>
              </small>
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <label>Payout Destination</label>
              <div className="radio-group-tabs">
                <label className={`radio-tab ${payoutMethod === "upi" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="upi"
                    checked={payoutMethod === "upi"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  />
                  UPI ID (VPA)
                </label>
                <label className={`radio-tab ${payoutMethod === "bank_transfer" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="bank_transfer"
                    checked={payoutMethod === "bank_transfer"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  />
                  Bank Account
                </label>
              </div>
            </div>

            {payoutMethod === "upi" ? (
              <div className="field">
                <label>UPI ID / Virtual Payment Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mobile@upi or username@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Account Holder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name as in bank passbook"
                    value={bankAccount.holderName}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, holderName: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Bank Account Number</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter account number"
                    value={bankAccount.accountNumber}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, accountNumber: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>IFSC Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC0001234"
                    value={bankAccount.ifsc}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, ifsc: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={busy || amount > available || amount <= 0}
            >
              {busy ? "Submitting Request..." : `Request Withdrawal of ${money(amount)}`}
            </button>
          </form>
        </div>

        {/* Request History */}
        <div className="panel">
          <div className="panel-head">
            <h3>Withdrawal Request History</h3>
          </div>
          {withdrawals.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Destination</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{new Date(w.createdAt).toLocaleDateString("en-IN")}</div>
                        <code style={{ fontSize: 10 }}>{w.id.slice(0, 8)}</code>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span className="capitalize">{w.payoutMethod?.replace("_", " ")}</span>
                        {w.destinationDetails?.upiId && (
                          <div style={{ color: "#64748b" }}>{w.destinationDetails.upiId}</div>
                        )}
                        {w.destinationDetails?.accountNumber && (
                          <div style={{ color: "#64748b" }}>
                            A/C ...{w.destinationDetails.accountNumber.slice(-4)} ({w.destinationDetails.ifsc})
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{money(w.amount)}</td>
                      <td>
                        <span
                          className={`tag ${
                            w.status === "approved" || w.status === "completed"
                              ? "green"
                              : w.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {w.status}
                        </span>
                        {w.rejectionReason && (
                          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                            {w.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No withdrawal requests"
              text="Your submitted payout requests will appear here with real-time status updates."
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 7: Deposit History
   ========================================================================== */
export function DepositHistory() {
  const { wallet, loading, error, refresh } = useWallet();

  const deposits = (wallet?.transactions || []).filter((tx) => tx.type === "deposit");

  return (
    <Shell
      title="Deposit History"
      kicker="WALLET RECORDS"
      description="History of all successful and pending wallet top-ups."
      action={
        <Link to="/student/deposit" className="btn btn-primary small">
          <Plus size={16} /> Add Money
        </Link>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Wallet Top-up History</h3>
            <p className="muted">Total Deposits: <strong>{money(wallet?.totalDeposited ?? 0)}</strong></p>
          </div>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : deposits.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Reference Number</th>
                  <th>Payment Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                    <td>
                      <code>{tx.referenceNumber || tx.id}</code>
                    </td>
                    <td>
                      <span className="capitalize">{tx.metadata?.paymentMethod || "UPI"}</span>
                    </td>
                    <td style={{ color: "#10b981", fontWeight: 700 }}>
                      +{money(tx.amount)}
                    </td>
                    <td>
                      <span className="tag green">{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No deposits recorded"
            text="Add money to your student wallet to see deposit records here."
          />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 8: Transaction History
   ========================================================================== */
export function TransactionHistory() {
  const { wallet, loading, error, refresh } = useWallet();
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const transactions = (wallet?.transactions || []).filter((tx) => {
    const matchType = filter === "all" || tx.type === filter;
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    const matchSearch =
      !search ||
      tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.id?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchStatus && matchSearch;
  });

  return (
    <Shell
      title="Transaction History"
      kicker="FINANCIAL AUDIT"
      description="Detailed ledger of all credits, course debits, withdrawals, and refunds."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/student/deposit" className="btn btn-primary small">
            <Plus size={14} /> Add Money
          </Link>
        </div>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search reference, description, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px", minWidth: 240 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px" }}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="course_purchase">Course Purchases</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px" }}
            >
              <option value="all">All Statuses</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference Number</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || tx.type === "refund";
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code>{tx.id.slice(0, 10)}...</code>
                      </td>
                      <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type?.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{tx.description}</td>
                      <td>
                        <code>{tx.referenceNumber || "—"}</code>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isCredit ? "#10b981" : "#ef4444",
                        }}
                      >
                        {isCredit ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No matching transactions" text="Try resetting filters or search query." />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 9: Profile and Settings
   ========================================================================== */
export function StudentProfile() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState({
    phone: "",
    bio: "",
    city: "",
    state: "",
    targetExam: "JEE Main",
    academicYear: "2025-2026",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (token) {
      api("/me/profile", { token })
        .then((res) => {
          if (res.profile) {
            setProfile({
              phone: res.profile.phone || "",
              bio: res.profile.bio || "",
              city: res.profile.city || "",
              state: res.profile.state || "",
              targetExam: res.profile.targetExam || "JEE Main",
              academicYear: res.profile.academicYear || "2025-2026",
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
    setMsg("");
    setErr("");

    try {
      await api("/me/profile", {
        method: "PUT",
        token,
        body: profile,
      });
      setMsg("Profile details saved successfully.");
    } catch (e) {
      setErr(e.message || "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Profile & Settings"
      kicker="ACCOUNT MANAGEMENT"
      description="Update your personal details, academic goals, and contact information."
    >
      <div className="panel" style={{ maxWidth: 650, margin: "0 auto" }}>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}

        {loading ? (
          <Loading />
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div className="field">
                <label>Student Name</label>
                <input type="text" disabled value={user?.name || ""} />
                <small className="muted">Name is linked to your registered login account.</small>
              </div>
              <div className="field">
                <label>Email Address</label>
                <input type="email" disabled value={user?.email || ""} />
                <small className="muted">Primary email cannot be modified.</small>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Target Examination</label>
                <select
                  value={profile.targetExam}
                  onChange={(e) => setProfile({ ...profile, targetExam: e.target.value })}
                >
                  <option value="JEE Main">JEE Main</option>
                  <option value="JEE Advanced">JEE Advanced</option>
                  <option value="NEET UG">NEET UG</option>
                  <option value="UPSC CSE">UPSC CSE</option>
                  <option value="Foundation">Foundation (Class 9-10)</option>
                  <option value="Other">Other Examination</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>City</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Kota, Delhi"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra, Rajasthan"
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Academic Year</label>
              <input
                type="text"
                placeholder="e.g. 2025-2026"
                value={profile.academicYear}
                onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Bio / Preparation Goals</label>
              <textarea
                rows="4"
                placeholder="Briefly describe your study targets and timeline..."
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
              {busy ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Existing Components: Results, Rewards, Support (Maintained)
   ========================================================================== */
export function Results() {
  const { data } = useStudent();
  const [exams, setExams] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  useEffect(() => {
    api("/exams").then((d) => setExams(d.exams || []));
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
                          {exams.find((e) => e.id === a.examId)?.title || a.examId}
                        </td>
                        <td>{a.result.total}</td>
                        <td>{a.result.attempted}</td>
                        <td>{a.result.correct}</td>
                        <td>{a.result.incorrect}</td>
                        <td>{a.result.unanswered ?? a.result.unattempted}</td>
                        <td>{a.result.accuracy}%</td>
                        <td>{new Date(a.submittedAt).toLocaleDateString("en-IN")}</td>
                        <td>
                          <button
                            className="btn btn-soft small"
                            onClick={() => setReviewId(reviewId === a.id ? null : a.id)}
                          >
                            {reviewId === a.id ? "Hide" : "Review"}
                          </button>
                        </td>
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
          {data.attempts
            .filter((attempt) => attempt.id === reviewId)
            .map((attempt) => (
              <div className="review-section" key={attempt.id}>
                <h3>Detailed answer review</h3>
                {(attempt.questions || []).map((question, index) => {
                  const detail = attempt.result.details.find(
                    (item) => item.id === question.id
                  );
                  return (
                    <article className="review-item" key={question.id}>
                      <strong>
                        Question {index + 1} · {question.subject} · {question.chapter}
                      </strong>
                      <QuestionRenderer
                        question={question}
                        selected={detail?.selectedOptions || []}
                        disabled
                        showAnswer
                      />
                      <p>
                        <b>Status:</b>{" "}
                        {!detail?.attempted
                          ? "Unanswered"
                          : detail.isCorrect
                          ? "Correct"
                          : "Incorrect"}
                      </p>
                      <p>
                        <b>Your answer:</b>{" "}
                        {detail?.attempted
                          ? detail.selectedOptions
                              .map((value) => String.fromCharCode(65 + value))
                              .join(", ")
                          : "Not answered"}{" "}
                        · <b>Correct:</b>{" "}
                        {(detail?.correctOptions || []).map((value) =>
                          String.fromCharCode(65 + value)
                        ).join(", ")}
                      </p>
                      {question.explanation && (
                        <p>
                          <b>Explanation:</b> {question.explanation}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </Shell>
  );
}

export function Rewards() {
  return <MyWallet />;
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
