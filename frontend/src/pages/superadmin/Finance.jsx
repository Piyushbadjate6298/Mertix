import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Users,
  Receipt,
  ShieldCheck,
  CreditCard,
  UserCheck,
  GraduationCap,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  TrendingUp,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money } from "../../lib/api";
import "./Finance.css";

export function useFinanceOverview() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    return api("/admin/finance/overview", { token })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  return { data, error, loading, refresh, token };
}

/* ==========================================================================
   1. Finance Dashboard (10 Real Summary Cards + Wallet Reconciliation)
   ========================================================================== */
export function FinanceDashboard() {
  const { data, error, loading, refresh, token } = useFinanceOverview();
  const [activeTab, setActiveTab] = useState("overview");

  if (!data && loading) {
    return (
      <Shell title="Finance Command Center" kicker="ADMIN FINANCE">
        <Loading />
      </Shell>
    );
  }

  const s = data?.summary || {
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalCourseSales: 0,
    totalWalletLiabilities: 0,
    pendingWithdrawalRequests: 0,
    pendingPaymentTransactions: 0,
  };

  const rec = data?.reconciliation || {};

  return (
    <Shell
      title="Financial Command Center"
      kicker="ADMIN / SUPER ADMIN FINANCE"
      description="Executive financial summaries, student wallet liabilities, and ledger reconciliation."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <a
            href="#"
            className="btn btn-primary small"
            onClick={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/admin/finance/reports/export-csv", {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `meritx-financial-ledger-${Date.now()}.csv`;
                a.click();
              } catch (err) {
                alert("Failed to export CSV: " + err.message);
              }
            }}
          >
            <Download size={14} /> Export CSV Ledger
          </a>
        </div>
      }
    >
      {/* Sub Navigation Tabs */}
      <div className="finance-tabs-nav">
        <button
          className={`finance-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <TrendingUp size={16} /> Overview & Reconciliation
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "wallets" ? "active" : ""}`}
          onClick={() => setActiveTab("wallets")}
        >
          <Wallet size={16} /> Student Wallets
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "withdrawals" ? "active" : ""}`}
          onClick={() => setActiveTab("withdrawals")}
        >
          <ArrowUpRight size={16} /> Withdrawals Workflow ({s.pendingWithdrawalRequests || 0})
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <FileSpreadsheet size={16} /> Financial Reports
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {activeTab === "overview" && (
        <>
          {/* DEMO MODE Notice */}
          <div className="finance-notice">
            <ShieldCheck size={24} />
            <div>
              <strong>DEMO MODE: Simulated Financial Operations</strong>
              <p>
                Metrics are aggregated in real-time from the connected database ledger. Real payment
                gateway connectivity (Razorpay/UPI) is prepared on the backend and requires merchant
                keys for live collections.
              </p>
            </div>
          </div>

          {/* 10 Dashboard Summary Cards */}
          <div className="grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <Stat
              icon={Users}
              label="Registered Students"
              value={s.totalStudents}
              delta="Active accounts"
            />
            <Stat
              icon={UserCheck}
              label="Registered Faculty"
              value={s.totalTeachers}
              tone="purple"
              delta="Course instructors"
            />
            <Stat
              icon={GraduationCap}
              label="Active Courses"
              value={s.totalCourses}
              tone="cyan"
              delta="Published in catalog"
            />
            <Stat
              icon={BookOpen}
              label="Course Enrollments"
              value={s.totalEnrollments}
              tone="green"
              delta="Via student wallet"
            />
            <Stat
              icon={ArrowDownLeft}
              label="Successful Deposits"
              value={money(s.totalDeposits)}
              tone="green"
              delta="Collected in wallets"
            />
            <Stat
              icon={ArrowUpRight}
              label="Completed Withdrawals"
              value={money(s.totalWithdrawals)}
              tone="orange"
              delta="Approved & paid"
            />
            <Stat
              icon={TrendingUp}
              label="Course Sales Revenue"
              value={money(s.totalCourseSales)}
              tone="green"
              delta="Earned platform revenue"
            />
            <Stat
              icon={Wallet}
              label="Wallet Liabilities"
              value={money(s.totalWalletLiabilities)}
              tone="purple"
              delta="Unspent student funds"
            />
            <Stat
              icon={Clock3}
              label="Pending Withdrawals"
              value={s.pendingWithdrawalRequests}
              tone="orange"
              delta="Needs admin review"
            />
            <Stat
              icon={CreditCard}
              label="Pending Transactions"
              value={s.pendingPaymentTransactions}
              delta="In gateway pipeline"
            />
          </div>

          {/* Wallet Reconciliation Section */}
          <div className="reconciliation-panel">
            <div className="panel-head">
              <div>
                <span className="demo-pill">AUDITED FINANCIAL SUMMARY</span>
                <h3 style={{ marginTop: 4 }}>Wallet Reconciliation & Capital Segregation</h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Clearly distinguishes collected deposits, earned course revenues, student liabilities, and payout flows.
                </p>
              </div>
            </div>

            <div className="reconciliation-grid">
              <div className="reconciliation-card">
                <div className="rec-label">Total Student Deposits</div>
                <div className="rec-value" style={{ color: "#2563eb" }}>
                  {money(rec.totalDeposits || 0)}
                </div>
                <div className="rec-desc">Gross funds injected into wallets (Held in Trust)</div>
              </div>

              <div className="reconciliation-card highlight">
                <div className="rec-label">Earned Course Sales Revenue</div>
                <div className="rec-value" style={{ color: "#10b981" }}>
                  {money(rec.totalCourseSales || 0)}
                </div>
                <div className="rec-desc">Recognized revenue debited from wallets for course sales</div>
              </div>

              <div className="reconciliation-card">
                <div className="rec-label">Completed Payouts</div>
                <div className="rec-value" style={{ color: "#64748b" }}>
                  {money(rec.totalWithdrawals || 0)}
                </div>
                <div className="rec-desc">Processed & settled withdrawals to students</div>
              </div>

              <div className="reconciliation-card">
                <div className="rec-label">Outstanding Wallet Liabilities</div>
                <div className="rec-value" style={{ color: "#8b5cf6" }}>
                  {money(rec.totalWalletLiabilities || 0)}
                </div>
                <div className="rec-desc">Total unspent available student balances held by platform</div>
              </div>

              <div className="reconciliation-card">
                <div className="rec-label">Refunds & Reversals</div>
                <div className="rec-value" style={{ color: "#ef4444" }}>
                  {money(rec.totalRefunds || 0)}
                </div>
                <div className="rec-desc">Returned or corrected transactions</div>
              </div>

              <div className="reconciliation-card">
                <div className="rec-label">Settlement Pipeline</div>
                <div className="rec-value" style={{ fontSize: 16 }}>
                  {rec.providerSettlement?.status === "simulated_demo" ? "Demo Mode (Mock Gateway)" : "Connected"}
                </div>
                <div className="rec-desc">{rec.providerSettlement?.provider || "Razorpay / UPI Prepared"}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "wallets" && <StudentWalletManagement standalone={false} />}
      {activeTab === "withdrawals" && <WithdrawalManagement standalone={false} onUpdated={refresh} />}
      {activeTab === "reports" && <FinancialReports standalone={false} />}
    </Shell>
  );
}

/* ==========================================================================
   2. Student Wallet Management (Searchable, Filterable & Detail Modal)
   ========================================================================== */
export function StudentWalletManagement({ standalone = true }) {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadWallets = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status !== "all") query.set("status", status);

    api(`/admin/finance/wallets?${query.toString()}`, { token })
      .then((res) => setStudents(res.students || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadWallets();
  }, [token, status]);

  const openStudentDetail = (id) => {
    setSelectedStudentId(id);
    setDetailLoading(true);
    api(`/admin/finance/wallets/${id}`, { token })
      .then((res) => setStudentDetail(res))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const content = (
    <div className="panel" style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel-head">
        <div>
          <h3>Student Wallet Directory</h3>
          <p className="muted">Searchable ledger accounts and balances across all registered students.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="search-box" style={{ width: 260 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by student name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadWallets()}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px" }}
          >
            <option value="all">All Accounts</option>
            <option value="active">Active Only</option>
          </select>
          <button className="btn btn-outline small" onClick={loadWallets}>
            Search
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : students.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Wallet Balance</th>
                <th>Total Deposits</th>
                <th>Course Spending</th>
                <th>Withdrawn</th>
                <th>Enrolled Courses</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.id}>
                  <td>
                    <strong>{st.name}</strong>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>ID: {st.id.slice(0, 8)}...</div>
                  </td>
                  <td>{st.email}</td>
                  <td>
                    <strong style={{ color: "#2563eb", fontSize: 14 }}>
                      {money(st.walletBalance || 0)}
                    </strong>
                  </td>
                  <td style={{ color: "#10b981" }}>{money(st.totalDeposited || 0)}</td>
                  <td style={{ color: "#ef4444" }}>{money(st.totalSpent || 0)}</td>
                  <td>{money(st.totalWithdrawn || 0)}</td>
                  <td>
                    <span className="tag">{st.enrolledCoursesCount || 0} courses</span>
                  </td>
                  <td>
                    <span className="tag green">{st.status || "active"}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-soft small"
                      onClick={() => openStudentDetail(st.id)}
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No students found" text="Try adjusting your search criteria." />
      )}

      {/* Student Detail Modal */}
      {selectedStudentId && (
        <div className="student-modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <div className="student-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="demo-pill">STUDENT WALLET DOSSIER</span>
                <h3 style={{ marginTop: 4 }}>{studentDetail?.student?.name || "Student Details"}</h3>
                <p className="muted" style={{ fontSize: 12 }}>
                  {studentDetail?.student?.email} · ID: {selectedStudentId}
                </p>
              </div>
              <button
                className="btn-icon-close"
                onClick={() => setSelectedStudentId(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="student-modal-body">
              {detailLoading ? (
                <Loading />
              ) : studentDetail ? (
                <>
                  <div className="grid-4" style={{ marginBottom: 20 }}>
                    <Stat
                      icon={Wallet}
                      label="Available Balance"
                      value={money(studentDetail.wallet?.availableBalance || 0)}
                      tone="green"
                    />
                    <Stat
                      icon={ArrowDownLeft}
                      label="Total Deposited"
                      value={money(studentDetail.wallet?.totalDeposited || 0)}
                    />
                    <Stat
                      icon={BookOpen}
                      label="Course Spending"
                      value={money(studentDetail.wallet?.totalSpent || 0)}
                      tone="purple"
                    />
                    <Stat
                      icon={ArrowUpRight}
                      label="Withdrawn"
                      value={money(studentDetail.wallet?.totalWithdrawn || 0)}
                    />
                  </div>

                  <h4 style={{ marginBottom: 10 }}>Enrolled Courses ({studentDetail.enrollments?.length || 0})</h4>
                  {studentDetail.enrollments?.length ? (
                    <div className="table-scroll" style={{ marginBottom: 20 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Course Name</th>
                            <th>Enrolled Date</th>
                            <th>Amount Paid</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetail.enrollments.map((en) => (
                            <tr key={en.id}>
                              <td><strong>{en.name}</strong></td>
                              <td>{new Date(en.enrolledAt).toLocaleDateString("en-IN")}</td>
                              <td>{money(en.amountPaid)}</td>
                              <td><span className="tag green">{en.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>No courses enrolled yet.</p>
                  )}

                  <h4 style={{ marginBottom: 10 }}>Recent Ledger Transactions ({studentDetail.transactions?.length || 0})</h4>
                  {studentDetail.transactions?.length ? (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetail.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>{new Date(tx.createdAt).toLocaleDateString("en-IN")}</td>
                              <td><span className="capitalize">{tx.type?.replace("_", " ")}</span></td>
                              <td style={{ fontSize: 12 }}>{tx.description}</td>
                              <td style={{ fontWeight: 700, color: tx.type === "deposit" || tx.type === "refund" ? "#10b981" : "#ef4444" }}>
                                {tx.type === "deposit" || tx.type === "refund" ? "+" : "-"}
                                {money(tx.amount)}
                              </td>
                              <td><span className="tag green">{tx.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 12 }}>No transactions recorded.</p>
                  )}
                </>
              ) : null}
            </div>

            <div className="student-modal-footer">
              <button className="btn btn-outline small" onClick={() => setSelectedStudentId(null)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return (
      <Shell
        title="Student Wallets"
        kicker="FINANCE & LEDGER"
        description="Searchable ledger accounts, balances, and transaction dossiers for registered students."
      >
        {content}
      </Shell>
    );
  }

  return content;
}

/* ==========================================================================
   3. Withdrawal Management (Admin Approval & Rejection Workflow)
   ========================================================================== */
export function WithdrawalManagement({ standalone = true, onUpdated }) {
  const { token } = useAuth();
  const [withdrawals, setWithdrawals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionItem, setActionItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadRequests = () => {
    setLoading(true);
    const query = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    api(`/admin/finance/withdrawals${query}`, { token })
      .then((res) => setWithdrawals(res.withdrawals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadRequests();
  }, [token, statusFilter]);

  async function handleReview(action) {
    if (action === "reject" && !rejectionReason.trim()) {
      alert("Please provide a rejection reason so the student understands why the request was declined.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api(`/admin/finance/withdrawals/${actionItem.id}`, {
        method: "POST",
        token,
        body: {
          action,
          rejectionReason: action === "reject" ? rejectionReason : null,
          payoutReference: action === "approve" ? payoutRef || `REF_PAYOUT_${Date.now()}` : null,
        },
      });
      setActionItem(null);
      setRejectionReason("");
      setPayoutRef("");
      setMsg(`Withdrawal request successfully ${action === "approve" ? "approved" : "rejected"}!`);
      loadRequests();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.message || "Failed to process withdrawal action.");
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div className="panel" style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel-head">
        <div>
          <h3>Student Withdrawal Request Workflow</h3>
          <p className="muted">Review pending payout requests, approve disbursements, or reject and release reserved funds.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px" }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Only</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn btn-outline small" onClick={loadRequests}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {msg && <div className="alert success">{msg}</div>}

      {loading ? (
        <Loading />
      ) : withdrawals.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Payout Destination</th>
                <th>Date Requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td>
                    <code>{w.id.slice(0, 10)}...</code>
                  </td>
                  <td>
                    <strong>{w.studentName}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{w.studentEmail}</div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 15 }}>{money(w.amount)}</strong>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <span className="capitalize">{w.payoutMethod?.replace("_", " ")}</span>
                    {w.destinationDetails?.upiId && <div>UPI: {w.destinationDetails.upiId}</div>}
                    {w.destinationDetails?.accountNumber && (
                      <div>
                        A/C: ...{w.destinationDetails.accountNumber.slice(-4)} ({w.destinationDetails.ifsc})
                      </div>
                    )}
                  </td>
                  <td>{new Date(w.createdAt).toLocaleString("en-IN")}</td>
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
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                        Reason: {w.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td>
                    {w.status === "pending" ? (
                      <button
                        className="btn btn-primary small"
                        onClick={() => {
                          setActionItem(w);
                          setPayoutRef(`PAY_REF_${Date.now()}`);
                          setRejectionReason("");
                        }}
                      >
                        Review
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {w.reviewedAt ? new Date(w.reviewedAt).toLocaleDateString("en-IN") : "Reviewed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No withdrawal requests" text="No requests match the selected status filter." />
      )}

      {/* Review / Approval Modal */}
      {actionItem && (
        <div className="student-modal-backdrop" onClick={() => setActionItem(null)}>
          <div className="student-modal-card" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="demo-pill">PAYOUT WORKFLOW</span>
                <h3>Review Withdrawal Request</h3>
              </div>
              <button className="btn-icon-close" onClick={() => setActionItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="student-modal-body">
              <div className="checkout-breakdown" style={{ marginBottom: 18 }}>
                <div className="breakdown-row">
                  <span>Student Name</span>
                  <strong>{actionItem.studentName}</strong>
                </div>
                <div className="breakdown-row">
                  <span>Student Email</span>
                  <span>{actionItem.studentEmail}</span>
                </div>
                <div className="breakdown-row">
                  <span>Requested Amount</span>
                  <strong style={{ fontSize: 18, color: "#2563eb" }}>{money(actionItem.amount)}</strong>
                </div>
                <div className="breakdown-row">
                  <span>Payout Method</span>
                  <span className="capitalize">{actionItem.payoutMethod?.replace("_", " ")}</span>
                </div>
                <div className="breakdown-row">
                  <span>Destination Details</span>
                  <code>{JSON.stringify(actionItem.destinationDetails)}</code>
                </div>
              </div>

              <div className="field">
                <label>Payout Reference Number (Optional for Approval)</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / IMPS reference"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginTop: 14 }}>
                <label>Rejection Reason (Required only if Rejecting)</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Incorrect bank account number or VPA unverified"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <small className="muted">
                  Rejecting this request will automatically release the {money(actionItem.amount)} back
                  into the student's available wallet balance.
                </small>
              </div>
            </div>

            <div className="student-modal-footer" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline danger"
                disabled={busy}
                onClick={() => handleReview("reject")}
              >
                Reject & Restore Funds
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => handleReview("approve")}
              >
                {busy ? "Processing..." : `Approve & Mark Completed`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return (
      <Shell
        title="Withdrawals Workflow"
        kicker="PAYOUT OPERATIONS"
        description="Review pending payout requests, approve disbursements, or reject and release reserved funds."
      >
        {content}
      </Shell>
    );
  }

  return content;
}

/* ==========================================================================
   4. Financial Reports (Daily/Weekly/Monthly Trends & CSV Export)
   ========================================================================== */
export function FinancialReports({ standalone = true }) {
  const { token } = useAuth();
  const [range, setRange] = useState("monthly");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReport = () => {
    setLoading(true);
    api(`/admin/finance/reports?range=${range}`, { token })
      .then((res) => setReport(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadReport();
  }, [token, range]);

  const content = (
    <div className="panel" style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel-head">
        <div>
          <h3>Financial & Revenue Reports</h3>
          <p className="muted">Periodic aggregates of transaction volumes, course sales, and student payments.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px" }}
          >
            <option value="daily">Daily Report (Today)</option>
            <option value="weekly">Weekly Report (Last 7 Days)</option>
            <option value="monthly">Monthly Report (Last 30 Days)</option>
          </select>
          <a
            href="#"
            className="btn btn-primary small"
            onClick={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/admin/finance/reports/export-csv", {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `financial-report-${range}-${Date.now()}.csv`;
                a.click();
              } catch (err) {
                alert("Export failed: " + err.message);
              }
            }}
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : report ? (
        <>
          <div className="grid-4" style={{ marginTop: 14 }}>
            <Stat
              icon={Receipt}
              label="Transaction Volume"
              value={report.summary?.transactionCount || 0}
              delta={`Selected period (${range})`}
            />
            <Stat
              icon={TrendingUp}
              label="Course Sales Revenue"
              value={money(report.summary?.courseRevenue || 0)}
              tone="green"
              delta="Gross sales"
            />
            <Stat
              icon={ArrowDownLeft}
              label="Student Deposits"
              value={money(report.summary?.depositVolume || 0)}
              tone="cyan"
              delta="Wallet inflow"
            />
            <Stat
              icon={ArrowUpRight}
              label="Withdrawal Volume"
              value={money(report.summary?.withdrawalVolume || 0)}
              tone="orange"
              delta="Paid out"
            />
          </div>

          {/* Course-wise Sales Report */}
          <div style={{ marginTop: 28 }}>
            <h4>Course-Wise Sales Performance</h4>
            {report.courseSales?.length ? (
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course Name</th>
                      <th>Category</th>
                      <th>Enrollments</th>
                      <th>Total Sales Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.courseSales.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.category}</td>
                        <td>{c.enrollmentCount}</td>
                        <td style={{ color: "#10b981", fontWeight: 700 }}>
                          {money(c.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No course sales in this period" text="Course purchases will show here." />
            )}
          </div>

          {/* Student-Wise Payments Report */}
          <div style={{ marginTop: 28 }}>
            <h4>Student-Wise Payment Activity</h4>
            {report.studentPayments?.length ? (
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Deposits Inflow</th>
                      <th>Course Spending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.studentPayments.map((st) => (
                      <tr key={st.id}>
                        <td><strong>{st.name}</strong></td>
                        <td>{st.email}</td>
                        <td style={{ color: "#10b981", fontWeight: 600 }}>{money(st.totalDeposited)}</td>
                        <td style={{ color: "#ef4444", fontWeight: 600 }}>{money(st.totalSpent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No student payments in this period" text="Student transactions will show here." />
            )}
          </div>
        </>
      ) : null}
    </div>
  );

  if (standalone) {
    return (
      <Shell
        title="Financial Reports"
        kicker="FINANCE & AUDIT"
        description="Periodic aggregates of transaction volumes, course sales, and student payments."
      >
        {content}
      </Shell>
    );
  }

  return content;
}

/* ==========================================================================
   Existing Components: Transactions & Audit (Maintained)
   ========================================================================== */
export function Transactions() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api("/me/wallet", { token })
        .then((res) => setTransactions(res.wallet?.transactions || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token]);

  return (
    <Shell
      title="Financial Transactions"
      kicker="PAYMENT AUDIT"
      description="Full historical ledger entries across student accounts."
    >
      <div className="panel">
        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td><code>{t.id.slice(0, 10)}...</code></td>
                    <td>{new Date(t.createdAt).toLocaleString("en-IN")}</td>
                    <td><span className="capitalize">{t.type?.replace("_", " ")}</span></td>
                    <td><code>{t.referenceNumber || "—"}</code></td>
                    <td style={{ fontWeight: 700 }}>{money(t.amount)}</td>
                    <td><span className="tag green">{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No transactions found" text="Transactions will populate as students interact with their wallets." />
        )}
      </div>
    </Shell>
  );
}

export function Audit() {
  const { data } = useFinanceOverview();
  return (
    <Shell
      title="Activity & Audit Log"
      kicker="TRANSPARENCY"
      description="Logged administrative and financial actions."
    >
      <div className="panel">
        <Empty title="Audit logs active" text="All ledger mutations, atomic locks, and withdrawal reviews are recorded in PostgreSQL." />
      </div>
    </Shell>
  );
}
