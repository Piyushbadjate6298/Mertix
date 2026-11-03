import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Video,
  Camera,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Users,
  ChevronRight,
  X,
  Radio,
  Wifi,
  WifiOff
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, friendlyDate } from "../../lib/api";
import "./LiveProctoring.css";

export function LiveProctoringDashboard() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flaggedFilter, setFlaggedFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams();
      if (examFilter !== "all") query.set("examId", examFilter);
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (flaggedFilter !== "all") query.set("flagged", flaggedFilter);

      const [statsRes, candidatesRes] = await Promise.all([
        api("/admin/proctoring/overview", { token }),
        api(`/admin/proctoring/candidates?${query.toString()}`, { token })
      ]);

      setOverview(statsRes);
      setCandidates(candidatesRes.candidates || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, examFilter, statusFilter, flaggedFilter]);

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, examFilter, statusFilter, flaggedFilter]);

  const openTimeline = async (attemptId) => {
    setSelectedAttemptId(attemptId);
    setTimelineLoading(true);
    try {
      const res = await api(`/admin/proctoring/attempts/${attemptId}/timeline`, { token });
      setTimelineData(res);
    } catch (err) {
      alert("Failed to load candidate timeline: " + err.message);
    } finally {
      setTimelineLoading(false);
    }
  };

  const closeTimeline = () => {
    setSelectedAttemptId(null);
    setTimelineData(null);
  };

  const stats = overview || {
    activeExamsCount: 0,
    activeAttemptsCount: 0,
    activeCamerasCount: 0,
    interruptedCamerasCount: 0,
    studentsWithWarningsCount: 0,
    flaggedAttemptsCount: 0,
    completedAttemptsCount: 0
  };

  return (
    <Shell
      title="Live Examination Proctoring Monitor"
      kicker="PROCTORING COMMAND CENTER"
      description="Real-time multi-candidate surveillance, camera streams, AI face & violation detection, and warning logs."
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label className="proctor-autorefresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-Refresh (10s)</span>
          </label>
          <button className="btn btn-primary small" onClick={fetchData} title="Refresh immediately">
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Now
          </button>
        </div>
      }
    >
      {/* Top Aggregates */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <Stat
          icon={Radio}
          label="Active Candidates"
          value={stats.activeAttemptsCount}
          delta={`${stats.activeExamsCount} active exams`}
          tone="cyan"
        />
        <Stat
          icon={Video}
          label="Webcams Streaming"
          value={stats.activeCamerasCount}
          delta={stats.interruptedCamerasCount > 0 ? `${stats.interruptedCamerasCount} interrupted` : "All camera streams healthy"}
          tone="green"
        />
        <Stat
          icon={AlertTriangle}
          label="Candidates With Warnings"
          value={stats.studentsWithWarningsCount}
          delta="1 to 2 violations issued"
          tone="amber"
        />
        <Stat
          icon={ShieldAlert}
          label="Flagged Attempts (3/3)"
          value={stats.flaggedAttemptsCount}
          delta="Exceeded 3 warning limit"
          tone="red"
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Candidate Surveillance Table */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3>Candidate Live Surveillance Queue</h3>
            <p className="muted">Continuous video feed status, face visibility, warning tallies, and audit events.</p>
          </div>
          <div className="proctor-filters-row">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="proctor-select"
            >
              <option value="all">All Attempt Statuses</option>
              <option value="in_progress">Attempting Now</option>
              <option value="submitted">Completed / Submitted</option>
            </select>
            <select
              value={flaggedFilter}
              onChange={(e) => setFlaggedFilter(e.target.value)}
              className="proctor-select"
            >
              <option value="all">All Warning States</option>
              <option value="true">Flagged Only (3 Warnings)</option>
            </select>
          </div>
        </div>

        {loading && candidates.length === 0 ? (
          <Loading />
        ) : candidates.length === 0 ? (
          <Empty
            title="No Active Candidates"
            text="There are currently no students taking examinations under proctored surveillance."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Examination</th>
                  <th>Camera Status</th>
                  <th>Warnings (Max 3)</th>
                  <th>Flag Status</th>
                  <th>Started At</th>
                  <th>Surveillance Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.attemptId} className={c.isFlagged ? "row-flagged" : ""}>
                    <td>
                      <div className="candidate-cell">
                        <div className="candidate-avatar">
                          {c.studentName?.charAt(0) || "S"}
                        </div>
                        <div>
                          <strong>{c.studentName}</strong>
                          <span className="candidate-email">{c.studentEmail}</span>
                          <span className="candidate-id">ID: {c.studentId}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="exam-badge">{c.examTitle}</span>
                      <small className="muted" style={{ display: "block", marginTop: 4 }}>
                        Status: <strong>{c.attemptStatus}</strong>
                      </small>
                    </td>
                    <td>
                      {c.cameraStatus === "active" ? (
                        <span className="badge badge-success proctor-pulse">
                          <span className="pulse-dot"></span> Camera Active
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <AlertCircle size={13} /> Interrupted
                        </span>
                      )}
                      {c.interruptionCount > 0 && (
                        <small className="muted" style={{ display: "block", marginTop: 4 }}>
                          {c.interruptionCount} breaks ({c.totalInterruptionSeconds}s total)
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="warning-meter">
                        <div className="warning-dots">
                          <span className={`dot ${c.warningCount >= 1 ? "warn-1" : ""}`} />
                          <span className={`dot ${c.warningCount >= 2 ? "warn-2" : ""}`} />
                          <span className={`dot ${c.warningCount >= 3 ? "warn-3" : ""}`} />
                        </div>
                        <span className={`warning-tag count-${c.warningCount}`}>
                          {c.warningCount} / 3 Warnings
                        </span>
                      </div>
                    </td>
                    <td>
                      {c.isFlagged ? (
                        <span className="badge badge-flagged">
                          <ShieldAlert size={14} /> FLAGGED
                        </span>
                      ) : (
                        <span className="badge badge-normal">
                          <ShieldCheck size={14} /> Normal
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="time-text">{c.startedAt ? new Date(c.startedAt).toLocaleTimeString() : "—"}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline small"
                        onClick={() => openTimeline(c.attemptId)}
                      >
                        <Eye size={14} /> View Events & Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Proctoring Dossier Modal */}
      {selectedAttemptId && (
        <div className="student-modal-backdrop" onClick={closeTimeline}>
          <div className="student-modal-card proctor-dossier-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div>
                <span className="eyebrow">CANDIDATE PROCTORING AUDIT DOSSIER</span>
                <h2>{timelineData?.attempt?.studentName || "Candidate Verification"}</h2>
                <span className="muted">Attempt ID: {selectedAttemptId} · {timelineData?.attempt?.examTitle}</span>
              </div>
              <button className="btn-icon" onClick={closeTimeline}>
                <X size={20} />
              </button>
            </div>

            <div className="student-modal-body">
              {timelineLoading || !timelineData ? (
                <Loading />
              ) : (
                <>
                  {/* Status Strip */}
                  <div className="proctor-modal-strip">
                    <div>
                      <span className="strip-label">Camera Status</span>
                      <strong className={timelineData.attempt.cameraStatus === "active" ? "text-green" : "text-red"}>
                        {timelineData.attempt.cameraStatus === "active" ? "Active Streaming" : "Interrupted"}
                      </strong>
                    </div>
                    <div>
                      <span className="strip-label">Total Warnings</span>
                      <strong className={timelineData.attempt.warningCount >= 3 ? "text-red" : "text-amber"}>
                        {timelineData.attempt.warningCount} / 3
                      </strong>
                    </div>
                    <div>
                      <span className="strip-label">Surveillance Review</span>
                      <strong className={timelineData.attempt.isFlagged ? "text-red" : "text-green"}>
                        {timelineData.attempt.isFlagged ? "Flagged for Admin Review" : "Compliant"}
                      </strong>
                    </div>
                    <div>
                      <span className="strip-label">Candidate Consent</span>
                      <strong>
                        {timelineData.attempt.consentGivenAt ? "Given & Signed" : "Unverified"}
                      </strong>
                    </div>
                  </div>

                  {/* Pre-Exam Verification Checklist */}
                  <h4 style={{ marginTop: 20, marginBottom: 10 }}>Pre-Examination Verification Checklist</h4>
                  <div className="verification-checklist-grid">
                    {Object.entries(timelineData.attempt.verificationChecks || {}).map(([key, val]) => (
                      <div key={key} className={`verify-item ${val ? "passed" : "failed"}`}>
                        {val ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <span>{key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}</span>
                      </div>
                    ))}
                  </div>

                  {/* Warnings Timeline */}
                  <h4 style={{ marginTop: 24, marginBottom: 10 }}>Surveillance Warnings Log</h4>
                  {timelineData.warnings?.length === 0 ? (
                    <div className="alert success">No proctoring warnings recorded during this session.</div>
                  ) : (
                    <div className="proctor-timeline">
                      {timelineData.warnings.map((w) => (
                        <div key={w.id} className={`timeline-entry warn-${w.warningNumber}`}>
                          <div className="timeline-badge">
                            {w.warningNumber}
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-meta">
                              <strong>Warning {w.warningNumber}/3: {w.category.replace(/_/g, " ").toUpperCase()}</strong>
                              <span>{new Date(w.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p>{w.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Event Stream */}
                  <h4 style={{ marginTop: 24, marginBottom: 10 }}>Chronological Surveillance Event Log</h4>
                  <div className="proctor-event-stream">
                    {timelineData.events?.map((ev) => (
                      <div key={ev.id} className={`event-stream-row sev-${ev.severity}`}>
                        <span className="event-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span className={`event-badge badge-${ev.severity}`}>{ev.eventType}</span>
                        <span className="event-detail">
                          {typeof ev.details === "object" ? JSON.stringify(ev.details) : ev.details}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="student-modal-footer">
              <button className="btn btn-outline" onClick={closeTimeline}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default LiveProctoringDashboard;
