import React, { useEffect, useState, useId } from "react";
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
  Building,
  Lock,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Coins,
  DollarSign,
  Briefcase,
  Award,
  CircleDollarSign,
  Landmark,
  KeyRound
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money, friendlyDate } from "../../lib/api";
import "./Finance.css";

/* ==========================================================================
   Helper: Interactive SVG Charts (Zero-dependency, fully responsive)
   ========================================================================== */
export function SimpleBarChart({ data = [], valueKey = "amount", labelKey = "label", height = 180, color = "#2563eb", unit = "₹" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 12 }}>No trend data recorded</div>;
  }
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  const chartHeight = height - 40;

  return (
    <div className="chart-wrapper">
      <div className="chart-svg-container" style={{ height }}>
        <svg width="100%" height={chartHeight} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={chartHeight * (1 - ratio)}
              x2="100%"
              y2={chartHeight * (1 - ratio)}
              stroke="#f1f5f9"
              strokeDasharray="4 4"
            />
          ))}

          {/* Bars */}
          {data.map((item, idx) => {
            const val = Number(item[valueKey]) || 0;
            const barHeight = Math.max(4, (val / maxVal) * chartHeight);
            const xPercent = ((idx + 0.5) / data.length) * 100;
            const barWidth = Math.max(8, Math.min(28, 600 / data.length));
            const isHovered = hoveredIdx === idx;

            return (
              <g key={idx}>
                <rect
                  x={`calc(${xPercent}% - ${barWidth / 2}px)`}
                  y={chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={isHovered ? "#1d4ed8" : color}
                  opacity={isHovered ? 1 : 0.85}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="chart-tooltip" style={{ left: `${((hoveredIdx + 0.5) / data.length) * 100}%` }}>
            <span className="tooltip-label">{data[hoveredIdx][labelKey] || data[hoveredIdx].date}</span>
            <strong className="tooltip-value">
              {unit === "₹" ? money(data[hoveredIdx][valueKey]) : `${data[hoveredIdx][valueKey]} ${unit}`}
            </strong>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="chart-x-labels">
        {data.map((item, idx) => (
          <span
            key={idx}
            className={`x-label ${hoveredIdx === idx ? "active" : ""}`}
            style={{ width: `${100 / data.length}%` }}
          >
            {item[labelKey] || item.date}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SimpleAreaChart({ data = [], valueKey = "amount", labelKey = "label", height = 180, color = "#10b981", unit = "₹" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 12 }}>No trend data recorded</div>;
  }
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  const chartHeight = height - 40;

  // Compute SVG polyline points
  const points = data.map((d, idx) => {
    const x = (idx / (data.length - 1 || 1)) * 100;
    const y = chartHeight - ((Number(d[valueKey]) || 0) / maxVal) * chartHeight;
    return `${x},${y}`;
  });

  const areaPoints = `0,${chartHeight} ${points.join(" ")} 100,${chartHeight}`;

  return (
    <div className="chart-wrapper">
      <div className="chart-svg-container" style={{ height }}>
        <svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <polygon points={areaPoints} fill={`url(#grad-${color})`} />

          {/* Line */}
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {data.map((d, idx) => {
            const x = (idx / (data.length - 1 || 1)) * 100;
            const y = chartHeight - ((Number(d[valueKey]) || 0) / maxVal) * chartHeight;
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isHovered ? 5 : 3}
                fill="#ffffff"
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 2}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer", transition: "r 0.15s ease" }}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="chart-tooltip" style={{ left: `${(hoveredIdx / (data.length - 1 || 1)) * 100}%` }}>
            <span className="tooltip-label">{data[hoveredIdx][labelKey] || data[hoveredIdx].date}</span>
            <strong className="tooltip-value">
              {unit === "₹" ? money(data[hoveredIdx][valueKey]) : `${data[hoveredIdx][valueKey]} ${unit}`}
            </strong>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="chart-x-labels">
        {data.map((item, idx) => (
          <span
            key={idx}
            className={`x-label ${hoveredIdx === idx ? "active" : ""}`}
            style={{ width: `${100 / data.length}%` }}
          >
            {item[labelKey] || item.date}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Hook: Overview Data & Date Range Filters
   ========================================================================== */
export function useFinanceOverview() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const refresh = (overrideRange) => {
    if (!token) return;
    setLoading(true);
    const r = overrideRange || range;
    const query = new URLSearchParams();
    if (r !== "all") query.set("range", r);
    if (r === "custom" && startDate) query.set("startDate", startDate);
    if (r === "custom" && endDate) query.set("endDate", endDate);

    return api(`/admin/finance/overview?${query.toString()}`, { token })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [token, range]);

  return {
    data,
    error,
    loading,
    refresh,
    token,
    range,
    setRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate
  };
}

/* ==========================================================================
   1. Complete Finance Dashboard Component (9 Distinct Subsections)
   ========================================================================== */
export function FinanceDashboard() {
  const {
    data,
    error,
    loading,
    refresh,
    token,
    range,
    setRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate
  } = useFinanceOverview();

  const [activeTab, setActiveTab] = useState("overview");

  if (!data && loading) {
    return (
      <Shell title="Finance & Master Wallet" kicker="ADMIN FINANCE">
        <Loading />
      </Shell>
    );
  }

  const s = data || {};
  const charts = data?.charts || {};
  const rec = data?.reconciliation || {};

  return (
    <Shell
      title="Finance & Platform Master Wallet"
      kicker="ADMIN / SUPER ADMIN FINANCIAL COMMAND"
      description="Real-time financial surveillance, double-entry platform treasury, faculty royalties, and administrator withdrawals."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={() => refresh()}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Data
          </button>
          <a
            href="/api/admin/finance/reports/export-csv"
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
      {/* 9 Section Sub-navigation Tabs */}
      <div className="finance-tabs-nav">
        <button
          className={`finance-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <TrendingUp size={16} /> Financial Overview
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "master-wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("master-wallet")}
        >
          <Landmark size={16} /> Platform Master Wallet
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <Users size={16} /> Student Wallet Summary
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "teachers" ? "active" : ""}`}
          onClick={() => setActiveTab("teachers")}
        >
          <UserCheck size={16} /> Teacher Wallet Summary
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          <Receipt size={16} /> Payments & Collections
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "withdrawals" ? "active" : ""}`}
          onClick={() => setActiveTab("withdrawals")}
        >
          <ArrowUpRight size={16} /> Withdrawals & Payouts ({s.pendingWithdrawalCount || 0})
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "refunds" ? "active" : ""}`}
          onClick={() => setActiveTab("refunds")}
        >
          <CircleDollarSign size={16} /> Refunds
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <CreditCard size={16} /> Financial Transactions
        </button>
        <button
          className={`finance-tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <FileSpreadsheet size={16} /> Financial Reports
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* ===================================================================
          SUBSECTION 1: FINANCIAL OVERVIEW
          =================================================================== */}
      {activeTab === "overview" && (
        <>
          {/* Time Filter Bar */}
          <div className="finance-filter-bar">
            <span className="filter-title">
              <Calendar size={14} /> Time Range Filter:
            </span>
            <div className="filter-chips">
              {[
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["last7days", "Last 7 Days"],
                ["last30days", "Last 30 Days"],
                ["thismonth", "This Month"],
                ["all", "All Time"],
                ["custom", "Custom Range"]
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip-btn ${range === key ? "active" : ""}`}
                  onClick={() => setRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {range === "custom" && (
              <div className="custom-date-inputs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
                <span>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
                <button className="btn btn-outline small" onClick={() => refresh()}>
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* 13 Financial Metric Cards (INR) */}
          <div className="finance-grid-cards">
            {/* Card 1: Today's Total Collection */}
            <div className="metric-box box-blue">
              <span className="metric-label">1. Today's Total Collection</span>
              <strong className="metric-num">{money(s.todayCollection || 0)}</strong>
              <small className="metric-sub">Verified deposits + sales today</small>
            </div>

            {/* Card 2: Today's Successful Payments */}
            <div className="metric-box box-blue">
              <span className="metric-label">2. Today's Successful Payments</span>
              <strong className="metric-num">{s.todaySuccessfulPayments || 0}</strong>
              <small className="metric-sub">Paid orders recorded today</small>
            </div>

            {/* Card 3: Total Students Who Paid Today */}
            <div className="metric-box box-cyan">
              <span className="metric-label">3. Students Who Paid Today</span>
              <strong className="metric-num">{s.todayStudentsPaid || 0}</strong>
              <small className="metric-sub">Unique verified student payers</small>
            </div>

            {/* Card 4: Total Amount Collected All Time */}
            <div className="metric-box box-indigo">
              <span className="metric-label">4. All-Time Collections</span>
              <strong className="metric-num">{money(s.totalAmountCollectedAllTime || 0)}</strong>
              <small className="metric-sub">Lifetime platform gross inflow</small>
            </div>

            {/* Card 5: Total Successful Transactions */}
            <div className="metric-box box-indigo">
              <span className="metric-label">5. Successful Transactions</span>
              <strong className="metric-num">{s.totalSuccessfulTransactions || 0}</strong>
              <small className="metric-sub">Verified ledger entries</small>
            </div>

            {/* Card 6: Total Student Wallet Balance */}
            <div className="metric-box box-purple">
              <span className="metric-label">6. Student Wallet Balance</span>
              <strong className="metric-num">{money(s.totalStudentWalletBalance || 0)}</strong>
              <small className="metric-sub">Student funds held in trust</small>
            </div>

            {/* Card 7: Total Teacher Wallet Balance */}
            <div className="metric-box box-purple">
              <span className="metric-label">7. Teacher Wallet Balance</span>
              <strong className="metric-num">{money(s.totalTeacherWalletBalance || 0)}</strong>
              <small className="metric-sub">Faculty royalties & honorarium</small>
            </div>

            {/* Card 8: Total Pending Withdrawals */}
            <div className="metric-box box-amber">
              <span className="metric-label">8. Pending Withdrawals</span>
              <strong className="metric-num">{money(s.totalPendingWithdrawals || 0)}</strong>
              <small className="metric-sub">{s.pendingWithdrawalCount || 0} payout requests pending</small>
            </div>

            {/* Card 9: Total Refunds */}
            <div className="metric-box box-red">
              <span className="metric-label">9. Total Refunds Disbursed</span>
              <strong className="metric-num">{money(s.totalRefunds || 0)}</strong>
              <small className="metric-sub">Reversals & refund transactions</small>
            </div>

            {/* Card 10: Total Rewards/Prize Money Reserved */}
            <div className="metric-box box-amber">
              <span className="metric-label">10. Prize Money Reserved</span>
              <strong className="metric-num">{money(s.totalRewardsReserved || 0)}</strong>
              <small className="metric-sub">Reserved for top exam ranks</small>
            </div>

            {/* Card 11: Total Settled Amount */}
            <div className="metric-box box-green">
              <span className="metric-label">11. Total Settled Amount</span>
              <strong className="metric-num">{money(s.totalSettledAmount || 0)}</strong>
              <small className="metric-sub">Verified bank settlements</small>
            </div>

            {/* Card 12: Available Platform Balance */}
            <div className="metric-box box-emerald highlight">
              <span className="metric-label">12. Available Platform Balance</span>
              <strong className="metric-num">{money(s.availablePlatformBalance || 0)}</strong>
              <small className="metric-sub">Gross platform treasury balance</small>
            </div>

            {/* Card 13: Available Amount for Admin Withdrawal */}
            <div className="metric-box box-green hero-box">
              <span className="metric-label">13. Withdrawable Platform Treasury</span>
              <strong className="metric-num hero-num">{money(s.withdrawablePlatformBalance || 0)}</strong>
              <small className="metric-sub">Eligible for Admin Bank Payout (Net of obligations)</small>
            </div>
          </div>

          {/* Interactive Graphs */}
          <div className="finance-graphs-section" style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 16 }}>Financial Analytics & Trends (INR ₹)</h3>

            <div className="graphs-grid">
              {/* Daily Collections Chart */}
              <div className="graph-card">
                <div className="graph-card-head">
                  <div>
                    <h4>Daily Collections (Past 14 Days)</h4>
                    <span className="muted">Gross deposit and enrollment transactions</span>
                  </div>
                  <Coins size={18} color="#2563eb" />
                </div>
                <SimpleBarChart
                  data={charts.dailyCollections || []}
                  valueKey="amount"
                  labelKey="label"
                  color="#2563eb"
                  unit="₹"
                />
              </div>

              {/* Monthly Collections Chart */}
              <div className="graph-card">
                <div className="graph-card-head">
                  <div>
                    <h4>Monthly Collections (Trailing 12 Months)</h4>
                    <span className="muted">Aggregate monthly cash volume</span>
                  </div>
                  <BarChart3Icon size={18} color="#0f766e" />
                </div>
                <SimpleBarChart
                  data={charts.monthlyCollections || []}
                  valueKey="amount"
                  labelKey="label"
                  color="#0f766e"
                  unit="₹"
                />
              </div>

              {/* Platform Revenue Trend */}
              <div className="graph-card">
                <div className="graph-card-head">
                  <div>
                    <h4>Platform Revenue Allocation</h4>
                    <span className="muted">Recognized net platform earnings</span>
                  </div>
                  <TrendingUp size={18} color="#10b981" />
                </div>
                <SimpleAreaChart
                  data={charts.revenueTrend || []}
                  valueKey="platformRevenue"
                  labelKey="date"
                  color="#10b981"
                  unit="₹"
                />
              </div>

              {/* Withdrawal History Trend */}
              <div className="graph-card">
                <div className="graph-card-head">
                  <div>
                    <h4>Withdrawals & Payouts Volume</h4>
                    <span className="muted">Completed payouts to students & platform</span>
                  </div>
                  <ArrowUpRight size={18} color="#f59e0b" />
                </div>
                <SimpleBarChart
                  data={charts.withdrawalTrend || []}
                  valueKey="amount"
                  labelKey="date"
                  color="#f59e0b"
                  unit="₹"
                />
              </div>
            </div>
          </div>

          {/* Capital Segregation & Reconciliation Summary */}
          <div className="reconciliation-panel" style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3>Auditable Wallet Reconciliation & Capital Segregation</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Zero-trust accounting: User funds held in trust are strictly isolated from platform revenue.
                </p>
              </div>
              <span className="badge badge-success">
                <ShieldCheck size={14} /> Double-Entry Ledger Active
              </span>
            </div>

            <div className="allocation-bar" style={{ marginTop: 20 }}>
              <div
                style={{
                  width: `${Math.min(100, (s.totalStudentWalletBalance / (s.totalAmountCollectedAllTime || 1)) * 100)}%`,
                  background: "#3b82f6"
                }}
                title="Student Wallet Liabilities"
              />
              <div
                style={{
                  width: `${Math.min(100, (s.totalTeacherWalletBalance / (s.totalAmountCollectedAllTime || 1)) * 100)}%`,
                  background: "#8b5cf6"
                }}
                title="Teacher Wallet Liabilities"
              />
              <div
                style={{
                  width: `${Math.min(100, (s.totalRewardsReserved / (s.totalAmountCollectedAllTime || 1)) * 100)}%`,
                  background: "#f59e0b"
                }}
                title="Reward Liabilities"
              />
              <div
                style={{
                  width: `${Math.min(100, (s.withdrawablePlatformBalance / (s.totalAmountCollectedAllTime || 1)) * 100)}%`,
                  background: "#10b981"
                }}
                title="Withdrawable Platform Treasury"
              />
            </div>

            <div className="allocation-legends" style={{ marginTop: 14 }}>
              <div>
                <span className="legend-dot" style={{ background: "#3b82f6" }} />
                Student Liabilities
                <strong>{money(s.totalStudentWalletBalance || 0)}</strong>
              </div>
              <div>
                <span className="legend-dot" style={{ background: "#8b5cf6" }} />
                Faculty Royalties
                <strong>{money(s.totalTeacherWalletBalance || 0)}</strong>
              </div>
              <div>
                <span className="legend-dot" style={{ background: "#f59e0b" }} />
                Prize Reserve Pool
                <strong>{money(s.totalRewardsReserved || 0)}</strong>
              </div>
              <div>
                <span className="legend-dot" style={{ background: "#10b981" }} />
                Withdrawable Treasury
                <strong style={{ color: "#047857" }}>{money(s.withdrawablePlatformBalance || 0)}</strong>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================
          SUBSECTION 2: PLATFORM MASTER WALLET
          =================================================================== */}
      {activeTab === "master-wallet" && (
        <MasterWalletSection onWithdrawalCompleted={() => refresh()} />
      )}

      {/* ===================================================================
          SUBSECTION 3: STUDENT WALLET SUMMARY
          =================================================================== */}
      {activeTab === "students" && (
        <StudentWalletManagement standalone={false} />
      )}

      {/* ===================================================================
          SUBSECTION 4: TEACHER WALLET SUMMARY
          =================================================================== */}
      {activeTab === "teachers" && (
        <TeacherWalletManagement standalone={false} />
      )}

      {/* ===================================================================
          SUBSECTION 5: PAYMENTS & COLLECTIONS
          =================================================================== */}
      {activeTab === "payments" && (
        <PaymentsCollectionsSection />
      )}

      {/* ===================================================================
          SUBSECTION 6: WITHDRAWALS & PAYOUTS
          =================================================================== */}
      {activeTab === "withdrawals" && (
        <WithdrawalManagement standalone={false} onUpdated={() => refresh()} />
      )}

      {/* ===================================================================
          SUBSECTION 7: REFUNDS
          =================================================================== */}
      {activeTab === "refunds" && (
        <RefundsSection />
      )}

      {/* ===================================================================
          SUBSECTION 8: FINANCIAL TRANSACTIONS
          =================================================================== */}
      {activeTab === "transactions" && (
        <Transactions />
      )}

      {/* ===================================================================
          SUBSECTION 9: FINANCIAL REPORTS
          =================================================================== */}
      {activeTab === "reports" && (
        <FinancialReports standalone={false} />
      )}
    </Shell>
  );
}

function BarChart3Icon(props) {
  return <TrendingUp {...props} />;
}

/* ==========================================================================
   2. Platform Master Wallet Component (With Bank Withdrawal Modal)
   ========================================================================== */
export function MasterWalletSection({ onWithdrawalCompleted }) {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPurpose, setWithdrawPurpose] = useState("Platform Revenue Payout");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(null);
  const [withdrawError, setWithdrawError] = useState("");

  const loadMasterWallet = () => {
    setLoading(true);
    api("/admin/finance/master-wallet", { token })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadMasterWallet();
  }, [token]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setWithdrawError("");
    const num = Number(withdrawAmount);
    if (!num || num <= 0) {
      setWithdrawError("Please enter a valid withdrawal amount greater than zero.");
      return;
    }
    if (num > (data?.withdrawablePlatformBalance || 0)) {
      setWithdrawError(`Requested amount exceeds available platform balance (₹${Number(data?.withdrawablePlatformBalance || 0).toLocaleString('en-IN')}).`);
      return;
    }
    if (!withdrawPassword) {
      setWithdrawError("Please enter your administrator password for secure re-authentication.");
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await api("/admin/finance/master-wallet/withdraw", {
        method: "POST",
        token,
        body: {
          amount: num,
          purpose: withdrawPurpose,
          password: withdrawPassword,
          idempotencyKey: `payout-${user?.id}-${Date.now()}`
        }
      });
      setWithdrawSuccess(res);
      loadMasterWallet();
      if (onWithdrawalCompleted) onWithdrawalCompleted();
    } catch (err) {
      setWithdrawError(err.message);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    setWithdrawAmount("");
    setWithdrawPassword("");
    setWithdrawError("");
    setWithdrawSuccess(null);
  };

  if (loading && !data) return <Loading />;

  const m = data || {};
  const bank = m.beneficiaryAccount || {};

  // Filter transactions
  const filteredTxs = (m.transactions || []).filter((tx) => {
    if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        tx.id.toLowerCase().includes(s) ||
        tx.transactionKey.toLowerCase().includes(s) ||
        tx.description.toLowerCase().includes(s) ||
        (tx.referenceId && tx.referenceId.toLowerCase().includes(s))
      );
    }
    return true;
  });

  return (
    <div className="master-wallet-container">
      {/* Platform Master Wallet Header Banner */}
      <div className="master-wallet-hero">
        <div className="hero-left">
          <div className="badge-platform-verified">
            <Landmark size={15} /> MERITX PLATFORM MASTER TREASURY
          </div>
          <h1>{money(m.withdrawablePlatformBalance || 0)}</h1>
          <span className="hero-subtext">
            Available Platform Treasury for Admin Withdrawal (Net of User Liabilities & Reserves)
          </span>
          <div className="beneficiary-pill">
            <Building size={14} />
            <span>
              Destination: <strong>{bank.bankName}</strong> ({bank.accountNumberMasked}) · IFSC: {bank.ifscCode}
            </span>
          </div>
        </div>

        <div className="hero-right">
          <button
            className="btn btn-primary large withdraw-hero-btn"
            onClick={() => setShowWithdrawModal(true)}
          >
            <ArrowUpRight size={18} /> WITHDRAW TO BANK ACCOUNT
          </button>
          <small className="muted" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
            Super Admin re-authentication required
          </small>
        </div>
      </div>

      {/* 8 Master Wallet Category Breakdowns */}
      <div className="grid-4" style={{ marginTop: 22 }}>
        <div className="stat-card">
          <div className="stat-symbol blue"><Landmark size={20} /></div>
          <span className="muted-label">Total Platform Balance</span>
          <strong>{money(m.availablePlatformBalance || 0)}</strong>
          <span className="stat-delta">Gross platform treasury</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol purple"><Users size={20} /></div>
          <span className="muted-label">Student Liabilities</span>
          <strong>{money(m.studentWalletLiabilities || 0)}</strong>
          <span className="stat-delta">Student deposits held in trust</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol purple"><Briefcase size={20} /></div>
          <span className="muted-label">Teacher Liabilities</span>
          <strong>{money(m.teacherWalletLiabilities || 0)}</strong>
          <span className="stat-delta">Faculty royalties & honorarium</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol amber"><Award size={20} /></div>
          <span className="muted-label">Prize Pool Obligations</span>
          <strong>{money(m.totalRewardLiabilities || 0)}</strong>
          <span className="stat-delta">Reserved mock rewards</span>
        </div>
      </div>

      <div className="grid-4" style={{ marginTop: 14 }}>
        <div className="stat-card">
          <div className="stat-symbol green"><DollarSign size={20} /></div>
          <span className="muted-label">Total Course Sales</span>
          <strong>{money(m.totalCourseSales || 0)}</strong>
          <span className="stat-delta">Gross course fee volume</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol green"><TrendingUp size={20} /></div>
          <span className="muted-label">Recognized Revenue (40%)</span>
          <strong>{money(m.totalPlatformRevenue || 0)}</strong>
          <span className="stat-delta">Net platform earnings</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol cyan"><CheckCircle2 size={20} /></div>
          <span className="muted-label">Settled by Gateway</span>
          <strong>{money(m.completedSettlements || 0)}</strong>
          <span className="stat-delta">Completed bank settlements</span>
        </div>
        <div className="stat-card">
          <div className="stat-symbol red"><CircleDollarSign size={20} /></div>
          <span className="muted-label">Total Refunds Paid</span>
          <strong>{money(m.totalRefundsPaid || 0)}</strong>
          <span className="stat-delta">Disbursed refunds</span>
        </div>
      </div>

      {/* Master Ledger Transactions Table */}
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <div>
            <h3>Platform Master Financial Ledger</h3>
            <p className="muted">Immutable double-entry platform ledger showing all treasury and liability credits & debits.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search ledger entries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="proctor-select"
            >
              <option value="all">All Categories</option>
              <option value="treasury">Platform Treasury</option>
              <option value="user_liability">User Liabilities</option>
              <option value="reward_liability">Reward Liabilities</option>
              <option value="gateway_settlement">Gateway Settlements</option>
            </select>
          </div>
        </div>

        {filteredTxs.length === 0 ? (
          <Empty title="No Ledger Transactions" text="No platform ledger entries matched your search filter." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Amount (INR)</th>
                  <th>Treasury After</th>
                  <th>Reference / UTR</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className="font-mono text-bold">{tx.id}</span>
                      <small className="muted" style={{ display: "block" }}>{tx.transactionKey}</small>
                    </td>
                    <td><span className="time-text">{new Date(tx.date).toLocaleString()}</span></td>
                    <td>
                      <span className={`badge badge-category ${tx.category}`}>
                        {tx.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td><span className="text-bold">{tx.type.replace(/_/g, " ")}</span></td>
                    <td>
                      <span className={`badge badge-${tx.direction === "credit" ? "success" : "danger"}`}>
                        {tx.direction.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong className={tx.direction === "credit" ? "text-green" : "text-red"}>
                        {tx.direction === "credit" ? "+" : "-"}{money(tx.amount)}
                      </strong>
                    </td>
                    <td><span>{money(tx.balanceAfter)}</span></td>
                    <td><span className="font-mono text-muted">{tx.referenceId || "—"}</span></td>
                    <td><span className="text-desc">{tx.description}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Bank Payouts History Table */}
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <div>
            <h3>Platform Bank Withdrawals History</h3>
            <p className="muted">Audit record of payouts disbursed directly to the owner current account.</p>
          </div>
        </div>

        {(m.payouts || []).length === 0 ? (
          <Empty title="No Withdrawals Yet" text="No platform current account withdrawals have been executed yet." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payout ID</th>
                  <th>Date</th>
                  <th>Requested Amount</th>
                  <th>Bank & Account</th>
                  <th>Net Disbursed</th>
                  <th>UTR / Reference</th>
                  <th>Status</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {m.payouts.map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-mono text-bold">{p.id}</span></td>
                    <td><span className="time-text">{new Date(p.createdAt).toLocaleDateString()}</span></td>
                    <td><strong>{money(p.amount)}</strong></td>
                    <td>
                      <span>{p.bankName}</span>
                      <small className="muted" style={{ display: "block" }}>{p.accountNumberMasked} · {p.ifscCode}</small>
                    </td>
                    <td><strong className="text-green">{money(p.netAmount)}</strong></td>
                    <td>
                      <span className="badge badge-success font-mono">
                        {p.utrNumber || "Processing"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${p.status === "completed" ? "success" : p.status === "rejected" ? "danger" : "amber"}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td><span className="text-desc">{p.purpose}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================
          ADMIN MASTER WITHDRAWAL MODAL
          =================================================================== */}
      {showWithdrawModal && (
        <div className="student-modal-backdrop" onClick={closeWithdrawModal}>
          <div className="student-modal-card withdraw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="eyebrow">PLATFORM TREASURY PAYOUT</span>
                <h2>Withdraw to Business Current Account</h2>
                <span className="muted">Direct bank settlement to verified MeritX platform corporate account.</span>
              </div>
              <button className="btn-icon" onClick={closeWithdrawModal}>
                <X size={20} />
              </button>
            </div>

            <div className="student-modal-body">
              {withdrawSuccess ? (
                <div className="withdraw-success-view">
                  <div className="success-icon-ring">
                    <CheckCircle2 size={48} color="#10b981" />
                  </div>
                  <h3>Withdrawal Transferred Successfully</h3>
                  <p className="muted">
                    Your platform treasury payout has been verified and disbursed to your registered current account.
                  </p>

                  <div className="payout-summary-receipt">
                    <div className="receipt-row">
                      <span>Bank Reference / UTR</span>
                      <strong className="font-mono text-green">{withdrawSuccess.utrNumber}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Beneficiary Account</span>
                      <strong>{bank.accountHolderName}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Bank & Branch</span>
                      <strong>{bank.bankName} ({bank.accountNumberMasked})</strong>
                    </div>
                    <div className="receipt-row">
                      <span>IFSC Code</span>
                      <strong>{bank.ifscCode}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Gross Payout Amount</span>
                      <strong>{money(withdrawSuccess.payout?.amount || withdrawAmount)}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Net Disbursed</span>
                      <strong className="text-green">{money(withdrawSuccess.payout?.netAmount || (Number(withdrawAmount) - 5))}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Remaining Platform Treasury</span>
                      <strong>{money(withdrawSuccess.newBalance || 0)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWithdrawSubmit}>
                  {/* Available Balance Banner */}
                  <div className="withdraw-balance-banner">
                    <div>
                      <span className="banner-label">Available for Withdrawal</span>
                      <strong className="banner-amount">{money(m.withdrawablePlatformBalance || 0)}</strong>
                    </div>
                    <div className="verified-seal">
                      <ShieldCheck size={16} /> Verified Platform Funds
                    </div>
                  </div>

                  {/* Destination Bank Account Card */}
                  <div className="destination-bank-card">
                    <div className="bank-card-icon">
                      <Building size={24} />
                    </div>
                    <div className="bank-card-info">
                      <strong>{bank.accountHolderName}</strong>
                      <span>{bank.bankName} · {bank.accountType || "Current Account"}</span>
                      <span className="bank-account-num font-mono">{bank.accountNumberMasked} · IFSC: {bank.ifscCode}</span>
                    </div>
                    <span className="badge badge-success">Verified Destination</span>
                  </div>

                  {/* Amount Input */}
                  <div className="form-group" style={{ marginTop: 18 }}>
                    <label>Withdrawal Amount (INR ₹)</label>
                    <div className="input-with-symbol">
                      <span className="input-symbol">₹</span>
                      <input
                        type="number"
                        min="10"
                        max={m.withdrawablePlatformBalance || 0}
                        step="1"
                        placeholder="Enter withdrawal amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        required
                        className="modal-amount-input"
                      />
                    </div>
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="preset-chips">
                    {[10000, 25000, 50000].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        className="preset-chip"
                        disabled={amt > (m.withdrawablePlatformBalance || 0)}
                        onClick={() => setWithdrawAmount(String(amt))}
                      >
                        {money(amt)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => setWithdrawAmount(String(Math.floor(m.withdrawablePlatformBalance || 0)))}
                    >
                      Max Available ({money(m.withdrawablePlatformBalance || 0)})
                    </button>
                  </div>

                  {/* Withdrawal Purpose */}
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label>Withdrawal Purpose / Ledger Memo</label>
                    <input
                      type="text"
                      value={withdrawPurpose}
                      onChange={(e) => setWithdrawPurpose(e.target.value)}
                      placeholder="e.g. Platform Revenue Settlement"
                      className="form-control"
                      required
                    />
                  </div>

                  {/* Step-Up Security Re-Authentication */}
                  <div className="security-reauth-box" style={{ marginTop: 18 }}>
                    <div className="reauth-head">
                      <KeyRound size={16} />
                      <strong>Super Admin Re-Authentication Required</strong>
                    </div>
                    <p className="muted" style={{ fontSize: 11, margin: "4px 0 10px" }}>
                      To prevent unauthorized treasury outflow, re-enter your administrator account password.
                    </p>
                    <input
                      type="password"
                      placeholder="Enter administrator password"
                      value={withdrawPassword}
                      onChange={(e) => setWithdrawPassword(e.target.value)}
                      required
                      className="form-control"
                    />
                  </div>

                  {/* Summary Breakdown */}
                  {Number(withdrawAmount) > 0 && (
                    <div className="payout-calc-box" style={{ marginTop: 16 }}>
                      <div className="calc-row">
                        <span>Withdrawal Amount:</span>
                        <strong>{money(withdrawAmount)}</strong>
                      </div>
                      <div className="calc-row">
                        <span>Corporate Banking Transfer Fee:</span>
                        <span>₹5.00</span>
                      </div>
                      <div className="calc-row total">
                        <span>Net Bank Disbursement:</span>
                        <strong className="text-green">{money(Math.max(0, Number(withdrawAmount) - 5))}</strong>
                      </div>
                    </div>
                  )}

                  {withdrawError && <div className="alert error" style={{ marginTop: 14 }}>{withdrawError}</div>}

                  <div className="modal-actions" style={{ marginTop: 22 }}>
                    <button type="button" className="btn btn-outline" onClick={closeWithdrawModal}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={withdrawSubmitting || !withdrawAmount || !withdrawPassword}
                    >
                      {withdrawSubmitting ? "Processing Bank Payout..." : "Confirm & Withdraw Funds"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {withdrawSuccess && (
              <div className="student-modal-footer">
                <button className="btn btn-primary" onClick={closeWithdrawModal}>
                  Done & View Ledger
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   3. Teacher Wallet Management Component
   ========================================================================== */
export function TeacherWalletManagement({ standalone = true }) {
  const { token } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadTeachers = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);

    api(`/admin/finance/teachers?${query.toString()}`, { token })
      .then((res) => setTeachers(res.teachers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadTeachers();
  }, [token]);

  return (
    <div className="panel" style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel-head">
        <div>
          <h3>Teacher Wallet Directory</h3>
          <p className="muted">Faculty balances, 60% course royalty disbursements, and student enrollment rosters.</p>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search faculty name, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : teachers.length === 0 ? (
        <Empty title="No Faculty Wallets" text="No teacher accounts matched your search criteria." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty Member</th>
                <th>Department & Expertise</th>
                <th>Current Balance</th>
                <th>Lifetime Royalties</th>
                <th>Total Paid Out</th>
                <th>Assigned Courses</th>
                <th>Students Enrolled</th>
                <th>Wallet Status</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.teacherId}>
                  <td>
                    <div className="candidate-cell">
                      <div className="candidate-avatar" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
                        {t.teacherName?.charAt(0) || "T"}
                      </div>
                      <div>
                        <strong>{t.teacherName}</strong>
                        <span className="candidate-email">{t.email}</span>
                        <small className="muted">{t.designation}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{t.department}</strong>
                    <small className="muted" style={{ display: "block" }}>{t.specialization} · {t.experienceYears}y exp</small>
                  </td>
                  <td><strong className="text-green">{money(t.balance)}</strong></td>
                  <td><span>{money(t.totalCredits)}</span></td>
                  <td><span>{money(t.totalPayouts)}</span></td>
                  <td><span className="badge badge-normal">{t.assignedCourses} Courses</span></td>
                  <td><span>{t.totalStudents} Students</span></td>
                  <td>
                    <span className={`badge badge-${t.walletStatus === "active" ? "success" : "danger"}`}>
                      {t.walletStatus.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   4. Payments & Collections Component
   ========================================================================== */
export function PaymentsCollectionsSection() {
  const { token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPayments = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (statusFilter !== "all") query.set("status", statusFilter);

    api(`/admin/finance/payments?${query.toString()}`, { token })
      .then((res) => setPayments(res.payments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadPayments();
  }, [token, statusFilter]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Payments & Collections Journal</h3>
          <p className="muted">Real-time payment orders, gateway references, UPI transactions, and captured receipts.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search payment ID, order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="proctor-select"
          >
            <option value="all">All Statuses</option>
            <option value="captured">Captured / Paid</option>
            <option value="created">Created / Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : payments.length === 0 ? (
        <Empty title="No Payment Records" text="No payment orders found matching the filter." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Student</th>
                <th>Item / Purpose</th>
                <th>Amount (INR)</th>
                <th>Method & Gateway</th>
                <th>Gateway Reference</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td><span className="font-mono text-bold">{p.id}</span></td>
                  <td>
                    <strong>{p.studentName}</strong>
                    <small className="muted" style={{ display: "block" }}>{p.studentEmail}</small>
                  </td>
                  <td><span>{p.itemName || p.purpose.replace(/_/g, " ")}</span></td>
                  <td><strong className="text-green">{money(p.amount)}</strong></td>
                  <td>
                    <span>{p.paymentMethod.toUpperCase()}</span>
                    <small className="muted" style={{ display: "block" }}>{p.gateway}</small>
                  </td>
                  <td><span className="font-mono text-muted">{p.gatewayPaymentId || p.gatewayOrderId || "—"}</span></td>
                  <td><span className="time-text">{new Date(p.date).toLocaleString()}</span></td>
                  <td>
                    <span className={`badge badge-${p.status === "captured" || p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "amber"}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   5. Refunds Component
   ========================================================================== */
export function RefundsSection() {
  const { token } = useAuth();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadRefunds = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);

    api(`/admin/finance/refunds?${query.toString()}`, { token })
      .then((res) => setRefunds(res.refunds || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadRefunds();
  }, [token]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Refunds & Reversals Registry</h3>
          <p className="muted">Disbursed refunds, cancelled enrollments, and reversed student wallet debits.</p>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search refund ID, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : refunds.length === 0 ? (
        <Empty title="No Refunds Logged" text="No refund or reversal transactions recorded in the system." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Recipient</th>
                <th>Role</th>
                <th>Refund Amount</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td><span className="font-mono text-bold">{r.id}</span></td>
                  <td>
                    <strong>{r.userName}</strong>
                    <small className="muted" style={{ display: "block" }}>{r.userEmail}</small>
                  </td>
                  <td><span className="badge badge-normal">{r.userRole.toUpperCase()}</span></td>
                  <td><strong className="text-red">{money(r.amount)}</strong></td>
                  <td><span className="font-mono text-muted">{r.referenceId}</span></td>
                  <td><span className="text-desc">{r.description}</span></td>
                  <td><span className="time-text">{new Date(r.date).toLocaleString()}</span></td>
                  <td>
                    <span className="badge badge-success">
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   6. Student Wallet Management (Searchable, Filterable & Dossier Modal)
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
      .then((res) => setStudents(res.wallets || res.students || []))
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
            className="proctor-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Accounts</option>
            <option value="active">Active Only</option>
            <option value="frozen">Frozen</option>
          </select>
          <button className="btn btn-outline small" onClick={loadWallets}>
            Search
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : students.length === 0 ? (
        <Empty title="No Students Found" text="No student records matched your search query." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Available Balance</th>
                <th>Locked Balance</th>
                <th>Total Deposited</th>
                <th>Course Spending</th>
                <th>Total Withdrawn</th>
                <th>Courses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td>
                    <div className="candidate-cell">
                      <div className="candidate-avatar">
                        {s.studentName?.charAt(0) || "S"}
                      </div>
                      <div>
                        <strong>{s.studentName}</strong>
                        <span className="candidate-email">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td><strong className="text-green">{money(s.availableBalance)}</strong></td>
                  <td><span>{money(s.lockedBalance)}</span></td>
                  <td><span>{money(s.totalDeposits)}</span></td>
                  <td><span>{money(s.totalSpent)}</span></td>
                  <td><span>{money(s.totalWithdrawals)}</span></td>
                  <td><span className="badge badge-normal">{s.enrolledCourses} Enrolled</span></td>
                  <td>
                    <span className={`badge badge-${s.accountStatus === "active" ? "success" : "danger"}`}>
                      {s.accountStatus.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline small"
                      onClick={() => openStudentDetail(s.studentId)}
                    >
                      <Eye size={14} /> View Dossier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Dossier Modal */}
      {selectedStudentId && (
        <div className="student-modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <div className="student-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="eyebrow">STUDENT ACCOUNT DOSSIER</span>
                <h2>{studentDetail?.student?.name || "Student Financial Dossier"}</h2>
                <span className="muted">{studentDetail?.student?.email}</span>
              </div>
              <button className="btn-icon" onClick={() => setSelectedStudentId(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="student-modal-body">
              {detailLoading || !studentDetail ? (
                <Loading />
              ) : (
                <>
                  <div className="proctor-modal-strip">
                    <div>
                      <span className="strip-label">Available Balance</span>
                      <strong className="text-green">{money(studentDetail.wallet?.availableBalance)}</strong>
                    </div>
                    <div>
                      <span className="strip-label">Locked In Review</span>
                      <strong className="text-amber">{money(studentDetail.wallet?.lockedBalance)}</strong>
                    </div>
                    <div>
                      <span className="strip-label">Enrolled Courses</span>
                      <strong>{studentDetail.enrollments?.length || 0}</strong>
                    </div>
                    <div>
                      <span className="strip-label">Wallet Status</span>
                      <strong className="text-green">{studentDetail.wallet?.status?.toUpperCase()}</strong>
                    </div>
                  </div>

                  <h4 style={{ marginTop: 22, marginBottom: 10 }}>Enrolled Courses</h4>
                  {(studentDetail.enrollments || []).length === 0 ? (
                    <p className="muted">No course enrollments found for this student.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Course Name</th>
                            <th>Fee Paid</th>
                            <th>Enrolled Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetail.enrollments.map((e) => (
                            <tr key={e.id}>
                              <td><strong>{e.courseName}</strong></td>
                              <td>{money(e.feePaid)}</td>
                              <td>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                              <td><span className="badge badge-success">{e.status.toUpperCase()}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <h4 style={{ marginTop: 22, marginBottom: 10 }}>Wallet Transaction History</h4>
                  {(studentDetail.transactions || []).length === 0 ? (
                    <p className="muted">No wallet transactions logged.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Balance Before</th>
                            <th>Balance After</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetail.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td><strong>{tx.type.replace(/_/g, " ").toUpperCase()}</strong></td>
                              <td>
                                <strong className={tx.direction === "credit" ? "text-green" : "text-red"}>
                                  {tx.direction === "credit" ? "+" : "-"}{money(tx.amount)}
                                </strong>
                              </td>
                              <td>{money(tx.balanceBefore)}</td>
                              <td>{money(tx.balanceAfter)}</td>
                              <td>{new Date(tx.date).toLocaleDateString()}</td>
                              <td><span className="badge badge-success">{tx.status.toUpperCase()}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="student-modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedStudentId(null)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return standalone ? (
    <Shell title="Student Wallets" kicker="FINANCE CONSOLE">
      {content}
    </Shell>
  ) : (
    content
  );
}

/* ==========================================================================
   7. Withdrawal Requests Workflow Component
   ========================================================================== */
export function WithdrawalManagement({ standalone = true, onUpdated }) {
  const { token } = useAuth();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [actionModal, setActionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadWithdrawals = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);

    api(`/admin/finance/withdrawals?${query.toString()}`, { token })
      .then((res) => setWithdrawals(res.withdrawals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadWithdrawals();
  }, [token, status]);

  const handleReviewAction = async (action) => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      await api(`/admin/finance/withdrawals/${actionModal.id}/review`, {
        method: "POST",
        token,
        body: {
          action,
          rejectionReason: action === "reject" ? rejectionReason : undefined,
          notes: adminNotes || undefined,
        },
      });
      setActionModal(null);
      setRejectionReason("");
      setAdminNotes("");
      loadWithdrawals();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert("Error processing withdrawal: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="panel" style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel-head">
        <div>
          <h3>Withdrawal Requests Queue</h3>
          <p className="muted">Authorize student payout disbursements or reject and restore reserved wallet balances.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            className="proctor-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Request Statuses</option>
            <option value="pending">Pending Review Only</option>
            <option value="completed">Completed / Approved</option>
            <option value="rejected">Rejected / Restored</option>
          </select>
          <button className="btn btn-outline small" onClick={loadWithdrawals}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : withdrawals.length === 0 ? (
        <Empty title="No Withdrawal Requests" text="No withdrawal requests matched your filter." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Student</th>
                <th>Requested Amount</th>
                <th>Payout Destination</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td><span className="font-mono text-bold">{w.referenceNumber}</span></td>
                  <td>
                    <strong>{w.studentName}</strong>
                    <small className="muted" style={{ display: "block" }}>{w.studentEmail}</small>
                  </td>
                  <td><strong className="text-green">{money(w.amount)}</strong></td>
                  <td>
                    <span>{w.payoutMethod === "upi" ? `UPI: ${w.payoutDetails?.upiId}` : `${w.payoutDetails?.bankName} (${w.payoutDetails?.accountNumber})`}</span>
                    {w.payoutMethod === "bank_transfer" && (
                      <small className="muted" style={{ display: "block" }}>IFSC: {w.payoutDetails?.ifsc}</small>
                    )}
                  </td>
                  <td><span className="time-text">{new Date(w.createdAt).toLocaleDateString()}</span></td>
                  <td>
                    <span className={`badge badge-${w.status === "completed" || w.status === "approved" ? "success" : w.status === "rejected" ? "danger" : "amber"}`}>
                      {w.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {w.status === "pending" || w.status === "processing" ? (
                      <button
                        className="btn btn-primary small"
                        onClick={() => setActionModal(w)}
                      >
                        Review Request
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve / Reject Modal */}
      {actionModal && (
        <div className="student-modal-backdrop" onClick={() => setActionModal(null)}>
          <div className="student-modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="eyebrow">WITHDRAWAL AUTHORIZATION</span>
                <h2>Review Payout Request</h2>
              </div>
              <button className="btn-icon" onClick={() => setActionModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="student-modal-body">
              <div className="payout-summary-receipt" style={{ marginBottom: 18 }}>
                <div className="receipt-row">
                  <span>Student Name:</span>
                  <strong>{actionModal.studentName}</strong>
                </div>
                <div className="receipt-row">
                  <span>Withdrawal Amount:</span>
                  <strong className="text-green" style={{ fontSize: 18 }}>{money(actionModal.amount)}</strong>
                </div>
                <div className="receipt-row">
                  <span>Payout Method:</span>
                  <strong>{actionModal.payoutMethod.toUpperCase()}</strong>
                </div>
                <div className="receipt-row">
                  <span>Destination:</span>
                  <strong className="font-mono">
                    {actionModal.payoutMethod === "upi" ? actionModal.payoutDetails?.upiId : `${actionModal.payoutDetails?.bankName} - ${actionModal.payoutDetails?.accountNumber}`}
                  </strong>
                </div>
              </div>

              <div className="form-group">
                <label>Administrator Memo / Transaction Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Verified and approved"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Rejection Reason (Required if declining)</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Bank IFSC code invalid or name mismatch"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="student-modal-footer" style={{ gap: 10 }}>
              <button
                className="btn btn-outline"
                style={{ color: "#dc2626", borderColor: "#fecaca" }}
                disabled={submitting || !rejectionReason.trim()}
                onClick={() => handleReviewAction("reject")}
              >
                Reject & Restore Funds
              </button>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => handleReviewAction("approve")}
              >
                {submitting ? "Approving..." : "Approve & Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return standalone ? (
    <Shell title="Withdrawal Requests" kicker="FINANCE CONSOLE">
      {content}
    </Shell>
  ) : (
    content
  );
}

/* ==========================================================================
   8. Financial Reports Component
   ========================================================================== */
export function FinancialReports({ standalone = true }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      setLoading(true);
      api("/admin/finance/reports", { token })
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token]);

  const content = (
    <div style={{ marginTop: standalone ? 0 : 14 }}>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Course Sales & Enrollment Analytics</h3>
            <p className="muted">Detailed revenue generated per published curriculum.</p>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : (data?.courseSales || []).length === 0 ? (
          <Empty title="No Course Sales" text="No course enrollments logged yet." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Title</th>
                  <th>Enrollments Count</th>
                  <th>Total Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {data.courseSales.map((cs) => (
                  <tr key={cs.courseId}>
                    <td><strong>{cs.courseName}</strong></td>
                    <td><span className="badge badge-normal">{cs.salesCount} Students</span></td>
                    <td><strong className="text-green">{money(cs.revenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h3>Student Spending Summary</h3>
            <p className="muted">Top student depositors and course spenders.</p>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : (data?.studentPayments || []).length === 0 ? (
          <Empty title="No Student Spending" text="No student payment activity recorded." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Enrolled Courses</th>
                  <th>Total Deposited</th>
                  <th>Total Spent on Courses</th>
                </tr>
              </thead>
              <tbody>
                {data.studentPayments.map((sp) => (
                  <tr key={sp.studentId}>
                    <td><strong>{sp.studentName}</strong></td>
                    <td>{sp.email}</td>
                    <td><span className="badge badge-normal">{sp.coursesEnrolled}</span></td>
                    <td><strong>{money(sp.totalDeposited)}</strong></td>
                    <td><strong className="text-green">{money(sp.totalSpent)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return standalone ? (
    <Shell title="Financial Reports" kicker="FINANCE CONSOLE">
      {content}
    </Shell>
  ) : (
    content
  );
}

/* ==========================================================================
   9. Transactions Component
   ========================================================================== */
export function Transactions() {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      setLoading(true);
      api("/admin/finance/reports", { token })
        .then((res) => setData(res.transactions || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token]);

  return (
    <Shell title="Financial Transactions Ledger" kicker="DOUBLE ENTRY JOURNAL">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Platform Ledger Entries</h3>
            <p className="muted">Immutable transaction records across all student and teacher wallets.</p>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : data.length === 0 ? (
          <Empty title="No Transactions" text="No wallet transactions found in the database ledger." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Amount (INR)</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.map((tx) => (
                  <tr key={tx.id}>
                    <td><span className="font-mono text-bold">{tx.id}</span></td>
                    <td><span className="time-text">{new Date(tx.date).toLocaleString()}</span></td>
                    <td><strong>{tx.type.replace(/_/g, " ").toUpperCase()}</strong></td>
                    <td>
                      <span className={`badge badge-${tx.direction === "credit" ? "success" : "danger"}`}>
                        {tx.direction.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong className={tx.direction === "credit" ? "text-green" : "text-red"}>
                        {tx.direction === "credit" ? "+" : "-"}{money(tx.amount)}
                      </strong>
                    </td>
                    <td>{money(tx.balanceBefore)}</td>
                    <td>{money(tx.balanceAfter)}</td>
                    <td><span className="font-mono text-muted">{tx.referenceId || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   10. Audit Component
   ========================================================================== */
export function Audit() {
  return (
    <Shell title="Financial Audit Log" kicker="COMPLIANCE & INTEGRITY">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Security & Ledger Audit Trail</h3>
            <p className="muted">Cryptographic event hashes, row locks, and immutable financial logs.</p>
          </div>
        </div>
        <div className="proctor-modal-strip" style={{ marginTop: 14 }}>
          <div>
            <span className="strip-label">Ledger Integrity</span>
            <strong className="text-green">Immutable Double-Entry Ready</strong>
          </div>
          <div>
            <span className="strip-label">Lock Mechanism</span>
            <strong>SELECT ... FOR UPDATE (Row-Level)</strong>
          </div>
          <div>
            <span className="strip-label">Advisory Concurrency Lock</span>
            <strong className="text-green">pg_advisory_xact_lock Active</strong>
          </div>
          <div>
            <span className="strip-label">Role Isolation</span>
            <strong className="text-green">Zero-Trust Faculty Isolation</strong>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export default FinanceDashboard;
