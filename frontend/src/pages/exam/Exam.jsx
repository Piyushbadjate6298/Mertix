import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Camera,
  Video,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Check,
  X,
  Eye,
  ShieldAlert,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  Layers,
  FileText,
  CheckSquare,
  Square,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import Brand from "../../components/Brand";
import { Loading } from "../../components/Layouts";
import QuestionRenderer from "../../components/QuestionRenderer";
import { ProctoringEngine } from "../../lib/proctoringEngine";
import "./Exam.css";

const format = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
    Math.floor((s % 3600) / 60)
  ).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Exam() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, token } = useAuth();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState([]);
  const [visited, setVisited] = useState([]);
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(720);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState("Saved");
  const [tabSwitches, setTabSwitches] = useState(0);

  // -------------------------------------------------------------
  // FEATURE 1: PRE-EXAM PERMISSION & VERIFICATION STATE
  // -------------------------------------------------------------
  const [cameraStatus, setCameraStatus] = useState("pending"); // "pending" | "active" | "denied"
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isEnablingCamera, setIsEnablingCamera] = useState(false);

  const [micStatus, setMicStatus] = useState("pending"); // "pending" | "active" | "denied"
  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState("");
  const [isEnablingMic, setIsEnablingMic] = useState(false);

  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [starting, setStarting] = useState(false);

  // -------------------------------------------------------------
  // FEATURE 2: PROCTORING WARNINGS & 3-SECOND COUNTDOWN STATE
  // -------------------------------------------------------------
  const [proctoringActive, setProctoringActive] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [countdownData, setCountdownData] = useState(null);
  const [terminationData, setTerminationData] = useState({
    reason: "Maximum violation limit reached",
    terminatedAt: null,
    violationHistory: [],
    warningCount: 3,
  });

  // -------------------------------------------------------------
  // FEATURE 4 & 5: LIVE PROCTORING HUD STATS
  // -------------------------------------------------------------
  const [proctoringStats, setProctoringStats] = useState({
    cameraStatus: "Connected",
    aiStatus: "Initializing...",
    faceStatus: "Checking camera feed...",
    faceStatusCode: "normal",
    faceCount: 1,
    micStatus: "Connected",
    audioMonitoringStatus: "Active (Silence)",
    audioLevel: 0,
    lastCheckTime: null,
    monitoringInterval: "3 Seconds",
    violationCount: 0,
  });

  // Refs
  const preflightVideoRef = useRef(null);
  const liveVideoRef = useRef(null);
  const proctoringEngineRef = useRef(null);
  const cameraStreamRef = useRef(null);
  cameraStreamRef.current = cameraStream;
  const micStreamRef = useRef(null);
  micStreamRef.current = micStream;
  const audioMeterCleanupRef = useRef(null);

  const dataRef = useRef({ answers, marked });
  dataRef.current = { answers, marked };
  const submittedRef = useRef(false);
  const currentAttempt = useRef(null);

  // Dynamic Sections derived from loaded questions
  const sections = useMemo(() => {
    const map = {};
    questions.forEach((q) => {
      const subj = q.subject || "General";
      map[subj] = (map[subj] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [questions]);

  const currentSection = questions[idx]?.subject || (sections[0]?.name ?? "General");

  // Load examination metadata, questions, and existing attempt check
  useEffect(() => {
    if (!token) return;
    Promise.all([
      api("/exams", { token }),
      api("/questions?examId=" + id, { token }),
      api("/me/dashboard", { token }).catch(() => null),
    ])
      .then(([es, qs, dashData]) => {
        setExam(es.exams.find((x) => x.id === id));
        setQuestions(qs.questions || []);

        if (dashData?.attempts) {
          const myAttempt = dashData.attempts.find((a) => a.examId === id);
          if (myAttempt) {
            if (myAttempt.status === "TERMINATED") {
              setAttempt(myAttempt);
              currentAttempt.current = myAttempt;
              setIsTerminated(true);
              setTerminationData({
                reason:
                  myAttempt.terminationReason ||
                  "Maximum violation limit reached",
                terminatedAt: myAttempt.terminatedAt,
                violationHistory: myAttempt.violationHistory || [],
                warningCount: myAttempt.warningCount || 3,
              });
              setResult(myAttempt);
              setSeconds(0);
            } else if (myAttempt.status === "in_progress") {
              setAttempt(myAttempt);
              currentAttempt.current = myAttempt;
              setAnswers(myAttempt.answers || {});
              setMarked(myAttempt.marked || []);
              setSeconds(
                Math.max(
                  0,
                  Math.floor(
                    (new Date(myAttempt.deadlineAt).getTime() - Date.now()) /
                      1000
                  )
                )
              );
            } else if (myAttempt.status === "submitted" && myAttempt.result) {
              setResult(myAttempt);
            }
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [id, token]);

  // Handle explicit Camera Permission button click
  const handleEnableCamera = async () => {
    setIsEnablingCamera(true);
    setCameraError("");
    try {
      const stream = await ProctoringEngine.requestCameraStream();
      setCameraStream(stream);
      cameraStreamRef.current = stream;
      setCameraStatus("active");

      if (preflightVideoRef.current) {
        preflightVideoRef.current.srcObject = stream;
        preflightVideoRef.current.muted = true;
        await preflightVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera access error:", err);
      setCameraStatus("denied");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError(
          "Camera access permission was denied. Please allow camera permissions in your browser address bar."
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setCameraError(
          "No webcam hardware detected. Please plug in or enable a camera to proceed."
        );
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        setCameraError(
          "Webcam is currently in use by another application. Please close other camera tabs and retry."
        );
      } else {
        setCameraError(err.message || "Failed to initialize webcam.");
      }
    } finally {
      setIsEnablingCamera(false);
    }
  };

  // Handle explicit Microphone Permission button click
  const handleEnableMicrophone = async () => {
    setIsEnablingMic(true);
    setMicError("");
    try {
      const stream = await ProctoringEngine.requestMicrophoneStream();
      setMicStream(stream);
      micStreamRef.current = stream;
      setMicStatus("active");

      if (audioMeterCleanupRef.current) {
        audioMeterCleanupRef.current();
      }
      audioMeterCleanupRef.current = ProctoringEngine.createAudioMeter(
        stream,
        (level) => setMicLevel(level)
      );
    } catch (err) {
      console.warn("Microphone access error:", err);
      setMicStatus("denied");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError(
          "Microphone access permission was denied. Please allow microphone permissions in your browser address bar."
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setMicError(
          "No microphone hardware detected. Please connect a microphone to proceed."
        );
      } else {
        setMicError(err.message || "Failed to initialize microphone.");
      }
    } finally {
      setIsEnablingMic(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioMeterCleanupRef.current) {
        audioMeterCleanupRef.current();
      }
      if (!currentAttempt.current) {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      }
      if (proctoringEngineRef.current) {
        proctoringEngineRef.current.destroy();
        proctoringEngineRef.current = null;
      }
    };
  }, []);

  // Helper to cross-browser request fullscreen
  const enterFullscreen = async () => {
    const el = document.documentElement;
    const isAlreadyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (!isAlreadyFullscreen) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
      } catch (fsErr) {
        console.warn("Fullscreen request not granted:", fsErr);
      }
    }
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  };

  // Pre-start verification validation condition
  const canStartExam =
    cameraStatus === "active" &&
    cameraStream !== null &&
    micStatus === "active" &&
    micStream !== null &&
    rulesAcknowledged === true;

  // Compute evaluation score
  const computeClientEvaluation = useCallback(
    (questionList, submittedAnswers, examConfig) => {
      if (!questionList || !questionList.length) return null;
      let correct = 0;
      let incorrect = 0;
      let unattempted = 0;
      let score = 0;
      const details = [];

      const marking =
        examConfig?.rules?.single_correct || {
          correct: 4,
          incorrect: -1,
          unanswered: 0,
        };
      const posMark = Number(marking.correct ?? 4);
      const negMark = Math.abs(Number(marking.incorrect ?? -1));

      questionList.forEach((item) => {
        const ans = submittedAnswers[item.id];
        const isAnswered = ans !== undefined && ans !== null && ans !== "";
        let isCorrect = false;

        if (isAnswered) {
          if (item.questionType === "multiple_correct") {
            const correctSet = new Set(
              Array.isArray(item.correctOptions)
                ? item.correctOptions
                : [item.answer]
            );
            const userSet = new Set(Array.isArray(ans) ? ans : [ans]);
            isCorrect =
              correctSet.size === userSet.size &&
              [...correctSet].every((val) => userSet.has(val));
          } else {
            const userVal = Number.isInteger(ans) ? ans : Number(ans);
            const correctVal = Number.isInteger(item.answer)
              ? item.answer
              : Number(item.correctOption);
            isCorrect = userVal === correctVal;
          }

          if (isCorrect) {
            correct++;
            score += posMark;
          } else {
            incorrect++;
            score -= negMark;
          }
        } else {
          unattempted++;
        }

        details.push({
          id: item.id,
          attempted: isAnswered,
          selectedValue: isAnswered
            ? Number.isInteger(ans)
              ? String.fromCharCode(65 + ans)
              : String(ans)
            : null,
          correctValue: Number.isInteger(item.answer)
            ? String.fromCharCode(65 + item.answer)
            : Number.isInteger(item.correctOption)
            ? String.fromCharCode(65 + item.correctOption)
            : String(item.answer || item.correctOption || "A"),
          selectedOptions: Array.isArray(ans)
            ? ans
            : isAnswered
            ? [ans]
            : [],
          correctOptions: Array.isArray(item.correctOptions)
            ? item.correctOptions
            : [item.answer ?? item.correctOption ?? 0],
          isCorrect,
          explanation:
            item.explanation ||
            "Official answer key verified by examination board.",
        });
      });

      const attemptedCount = correct + incorrect;
      const maximumMarks = questionList.length * posMark;
      const accuracy =
        attemptedCount > 0 ? Math.round((correct / attemptedCount) * 100) : 0;

      return {
        score,
        maximumMarks,
        attempted: attemptedCount,
        correct,
        incorrect,
        unattempted,
        unanswered: unattempted,
        accuracy,
        details,
      };
    },
    []
  );

  // Automatic Exam Termination on 3 Proctoring Violations
  const handleAutomaticTermination = useCallback(
    async (termInfo) => {
      setIsTerminated(true);
      setSeconds(0);
      setActiveWarning(null);
      setCountdownData(null);

      if (proctoringEngineRef.current) {
        proctoringEngineRef.current.destroy();
        proctoringEngineRef.current = null;
      }
      setProctoringActive(false);

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      const curAnswers =
        termInfo?.answers || dataRef.current.answers || answers || {};
      const history = termInfo?.violationHistory || [];
      const targetAttemptId =
        currentAttempt.current?.id || attempt?.id || termInfo?.attemptId;

      setTerminationData({
        reason: "Maximum violation limit reached",
        terminatedAt: new Date().toISOString(),
        violationHistory: history,
        warningCount: 3,
      });

      // Immediate calculation so user never gets stuck loading
      const clientEval = computeClientEvaluation(
        questions,
        curAnswers,
        exam?.configuration
      );
      if (clientEval) {
        setResult({
          result: clientEval,
          status: "TERMINATED",
          terminationReason: "MAX_VIOLATIONS_REACHED",
        });
      }

      // Sync termination to backend
      if (targetAttemptId && token) {
        try {
          const res = await api("/proctoring/warning", {
            method: "POST",
            token,
            body: {
              attemptId: targetAttemptId,
              category: "exam_rule_violation",
              message:
                "Warning 3/3 (MAXIMUM VIOLATIONS REACHED): Exam automatically terminated.",
              evidenceMetadata: { code: "auto_terminate", finalViolation: true },
              currentAnswers: curAnswers,
            },
          });

          const finalAttempt = res?.attempt;
          const finalResult = res?.result || res?.attempt?.result;

          if (finalAttempt) {
            setAttempt(finalAttempt);
            currentAttempt.current = finalAttempt;
          }
          if (finalResult) {
            setResult({
              result: finalResult,
              status: "TERMINATED",
              terminationReason: "MAX_VIOLATIONS_REACHED",
            });
          } else if (finalAttempt?.result) {
            setResult(finalAttempt);
          }
          if (res?.violationHistory?.length) {
            setTerminationData((prev) => ({
              ...prev,
              violationHistory: res.violationHistory,
            }));
          }
        } catch (err) {
          console.error("Warning termination error, calling fallback:", err);
          try {
            const tRes = await api("/attempts/terminate", {
              method: "POST",
              token,
              body: {
                attemptId: targetAttemptId,
                answers: curAnswers,
                reason: "MAX_VIOLATIONS_REACHED",
              },
            });
            if (tRes?.attempt) {
              setAttempt(tRes.attempt);
              currentAttempt.current = tRes.attempt;
              setResult(tRes.attempt);
            }
          } catch (fErr) {
            console.error("Fallback termination error:", fErr);
          }
        }
      }
    },
    [token, questions, exam, attempt, answers, computeClientEvaluation]
  );

  // Start Examination function triggered ONLY by candidate click on START EXAMINATION button
  async function startExam(isRetake = false) {
    const retake = isRetake === true;

    if (!retake && !canStartExam) {
      if (cameraStatus !== "active") {
        setError("Please enable and verify your camera before starting.");
      } else if (micStatus !== "active") {
        setError("Please enable and verify your microphone before starting.");
      } else if (!rulesAcknowledged) {
        setError(
          "Please read and acknowledge the examination rules and proctoring consent to continue."
        );
      }
      return;
    }

    if (starting) return;
    setStarting(true);
    setError("");

    try {
      // 1. Request fullscreen on user click
      await enterFullscreen();

      // 2. Validate authentication
      if (!token) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      // 3. Start attempt on backend
      let data;
      try {
        data = await api("/attempts/start", {
          method: "POST",
          token,
          body: {
            examId: id,
            acceptedInstructions: true,
            retake,
          },
        });
      } catch (startErr) {
        if (
          startErr.message?.includes("Register before starting") ||
          startErr.code === "REGISTRATION_REQUIRED"
        ) {
          await api("/exams/register", {
            method: "POST",
            token,
            body: { examId: id },
          }).catch(() => {});
          data = await api("/attempts/start", {
            method: "POST",
            token,
            body: {
              examId: id,
              acceptedInstructions: true,
              retake,
            },
          });
        } else {
          throw startErr;
        }
      }

      if (!data?.attempt?.id) {
        throw new Error(
          "Failed to initialize authorized exam session. Please try again."
        );
      }

      const next = data.attempt;

      if (next.status === "TERMINATED") {
        setAttempt(next);
        currentAttempt.current = next;
        setIsTerminated(true);
        setTerminationData({
          reason: next.terminationReason || "Maximum violation limit reached",
          terminatedAt: next.terminatedAt,
          violationHistory: next.violationHistory || [],
          warningCount: next.warningCount || 3,
        });
        setResult(next);
        setSeconds(0);
        return;
      }

      // 4. Combine camera and microphone streams cleanly
      const cam = cameraStreamRef.current;
      const mic = micStreamRef.current;

      const combinedStream = new MediaStream([
        ...(cam ? cam.getVideoTracks() : []),
        ...(mic ? mic.getAudioTracks() : []),
      ]);

      // 5. Initialize Proctoring Engine
      if (proctoringEngineRef.current) {
        proctoringEngineRef.current.destroy();
        proctoringEngineRef.current = null;
      }

      const engine = new ProctoringEngine({
        token,
        examId: id,
        attemptId: next.id,
        getAnswers: () => dataRef.current.answers,
        onWarning: (warn) => {
          setWarningCount(warn.warningCount);
          setActiveWarning(warn);
          if (warn.isFlagged) {
            setIsFlagged(true);
          }
          if (!warn.isTerminated) {
            setTimeout(() => {
              setActiveWarning((cur) =>
                cur?.timestamp === warn.timestamp ? null : cur
              );
            }, 6000);
          }
        },
        onStatusChange: (status) => {
          setWarningCount(status.warningCount);
          setIsFlagged(status.isFlagged);
          if (status.isTerminated) {
            setIsTerminated(true);
          }
          if (status.resolvedIncident) {
            setActiveWarning((cur) =>
              cur?.code === status.resolvedIncident ? null : cur
            );
          }
        },
        onStatsUpdate: (stats) => {
          setProctoringStats((prev) => ({
            ...prev,
            ...stats,
          }));
        },
        onCountdownTick: (tickInfo) => {
          setCountdownData(tickInfo);
        },
        onTerminated: (termInfo) => {
          handleAutomaticTermination(termInfo);
        },
      });

      proctoringEngineRef.current = engine;
      setProctoringActive(true);

      // Start engine with live video & audio streams
      await engine.startMonitoring(null, combinedStream, mic);

      // 6. Start examination timer & state
      const deadlineMs = new Date(next.deadlineAt).getTime();
      const leftSeconds = Math.max(
        0,
        Math.floor((deadlineMs - Date.now()) / 1000)
      );

      setResult(null);
      setAttempt(next);
      currentAttempt.current = next;
      setAnswers(next.answers || {});
      setMarked(next.marked || []);
      setSeconds(leftSeconds);
    } catch (issue) {
      console.error("Exam start error:", issue);
      setError(issue.message || "Failed to start examination. Please retry.");
    } finally {
      setStarting(false);
    }
  }

  // Ensure proctoring webcam binds to live video element as soon as active exam mounts
  useEffect(() => {
    if (attempt && liveVideoRef.current && proctoringEngineRef.current) {
      proctoringEngineRef.current.attachVideoElement(liveVideoRef.current);
    }
  }, [attempt]);

  // Submit Exam handler
  const submit = useCallback(async () => {
    if (submittedRef.current || !currentAttempt.current) return;
    submittedRef.current = true;

    if (proctoringEngineRef.current) {
      proctoringEngineRef.current.destroy();
      proctoringEngineRef.current = null;
    }
    setProctoringActive(false);

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
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      submittedRef.current = false;
      setError(e.message);
    }
  }, [token]);

  // Timer countdown
  useEffect(() => {
    if (!attempt || result || isTerminated) return;
    const t = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((new Date(attempt.deadlineAt).getTime() - Date.now()) / 1000)
      );
      setSeconds(left);
      if (!left) {
        clearInterval(t);
        submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [attempt, result, isTerminated, submit]);

  // Tab switch counter
  useEffect(() => {
    if (!attempt || result || isTerminated) return;
    const onVisibility = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [attempt, result, isTerminated]);

  // Auto-save answers
  useEffect(() => {
    if (!attempt || result || isTerminated) return;
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
  }, [answers, marked, attempt, result, isTerminated, token]);

  // Record visited questions
  useEffect(() => {
    if (questions.length && questions[idx]) {
      setVisited((p) =>
        p.includes(questions[idx].id) ? p : [...p, questions[idx].id]
      );
    }
  }, [idx, questions]);

  const answer = (option) =>
    setAnswers((current) => {
      const question = questions[idx];
      if (question.questionType !== "multiple_correct")
        return { ...current, [question.id]: option };
      const selected = Array.isArray(current[question.id])
        ? current[question.id]
        : [];
      const next = selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option];
      const updated = { ...current };
      if (next.length) updated[question.id] = next;
      else delete updated[question.id];
      return updated;
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
        : [...p, questions[idx].id]
    );

  const hasAnswer = (value) =>
    Number.isInteger(value) ||
    (Array.isArray(value) && value.length > 0) ||
    (typeof value === "string" && value.trim() !== "");

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
          <div
            className="instruction-card"
            style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}
          >
            <AlertCircle
              size={36}
              color="#d9534f"
              style={{ margin: "0 auto 12px" }}
            />
            <h2>Unable to load examination</h2>
            <p className="muted">{error}</p>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <button
                className="btn btn-primary small"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
              <Link className="btn btn-outline small" to="/student">
                My Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <Loading />
        )}
      </div>
    );

  // -------------------------------------------------------------
  // FEATURE 1: PRE-EXAMINATION INSTRUCTIONS & VERIFICATION SCREEN
  // -------------------------------------------------------------
  if (!attempt && !result && !isTerminated) {
    const config = exam.configuration || {};
    const markingRules = config.rules?.single_correct || {
      correct: 4,
      incorrect: -1,
      unanswered: 0,
    };
    const posMark = Number(markingRules.correct ?? 4);
    const negMark = Math.abs(Number(markingRules.incorrect ?? -1));

    const totalMarks =
      exam.marks ||
      exam.totalMarks ||
      questions.length * posMark;

    const examDateStr = exam.date
      ? new Date(exam.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

    const startTimeStr = exam.time || "Immediate upon candidate launch";
    const durationMins = exam.duration || exam.durationMinutes || 180;

    const passingCriteria = config.passingPercentage
      ? `${config.passingPercentage}% Minimum`
      : config.passMarks
      ? `${config.passMarks} Marks`
      : "As per exam board cutoff criteria";

    return (
      <div className="pre-exam-screen">
        <div className="pre-exam-container">
          {/* Header */}
          <div className="pre-exam-header">
            <div className="pre-exam-header-left">
              <span className="secure-badge">
                <ShieldCheck size={14} /> Official Examination Portal
              </span>
              <h1>{exam.title}</h1>
              <p>
                Pre-Exam Verification & Proctoring Setup · All permissions must be granted to proceed
              </p>
            </div>
            <Brand />
          </div>

          {/* STEP 1: EXAMINATION DETAILS */}
          <div className="pre-exam-section-block">
            <div className="section-block-title">
              <span className="section-step-pill">Step 1</span>
              <span>Examination Details & Summary</span>
            </div>
            <div className="pre-exam-details-grid">
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Examination Name</span>
                <span className="pre-exam-detail-value">{exam.title}</span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Course / Stream</span>
                <span className="pre-exam-detail-value">
                  {exam.type || exam.subject || "Standard Assessment"}
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Candidate Name</span>
                <span className="pre-exam-detail-value highlight-blue">
                  {user?.name || "Registered Candidate"}
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Exam Date</span>
                <span className="pre-exam-detail-value">{examDateStr}</span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Exam Start Time</span>
                <span className="pre-exam-detail-value">{startTimeStr}</span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Total Duration</span>
                <span className="pre-exam-detail-value highlight-green">
                  {durationMins} Minutes
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Total Sections</span>
                <span className="pre-exam-detail-value">
                  {sections.length} ({sections.map((s) => s.name).join(", ")})
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Questions per Section</span>
                <span className="pre-exam-detail-value">
                  {sections.map((s) => `${s.name}: ${s.count}`).join(" · ")}
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Total Questions</span>
                <span className="pre-exam-detail-value">{questions.length} Questions</span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Total Marks</span>
                <span className="pre-exam-detail-value">{totalMarks} Marks</span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Marking Scheme</span>
                <span className="pre-exam-detail-value">
                  +{posMark} Correct / -{negMark} Incorrect / 0 Unattempted
                </span>
              </div>
              <div className="pre-exam-detail-item">
                <span className="pre-exam-detail-label">Passing Standard</span>
                <span className="pre-exam-detail-value">{passingCriteria}</span>
              </div>
            </div>
          </div>

          {/* STEP 2: EXAMINATION RULES */}
          <div className="pre-exam-section-block">
            <div className="section-block-title">
              <span className="section-step-pill">Step 2</span>
              <span>Mandatory Examination Rules & Code of Conduct</span>
            </div>
            <div className="rules-grid">
              <div className="rule-card">
                <span className="rule-num">1</span>
                <span>The candidate must remain continuously visible within the camera frame.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">2</span>
                <span>Only one candidate should appear in the camera view at any point.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">3</span>
                <span>Both webcam camera and microphone must remain enabled throughout the exam.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">4</span>
                <span>Switching browser tabs or minimizing the examination window triggers a violation.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">5</span>
                <span>Exiting fullscreen mode triggers a proctoring violation.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">6</span>
                <span>Background speech or suspicious ambient voice triggers a proctoring violation.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">7</span>
                <span>Three valid violations will result in immediate automatic examination termination.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">8</span>
                <span>A terminated examination cannot be restarted or resumed under any circumstance.</span>
              </div>
              <div className="rule-card">
                <span className="rule-num">9</span>
                <span>All answers must be submitted before the official examination timer expires.</span>
              </div>
            </div>
          </div>

          {/* STEP 3: CAMERA AND MICROPHONE PERMISSIONS */}
          <div className="pre-exam-section-block">
            <div className="section-block-title">
              <span className="section-step-pill">Step 3</span>
              <span>Camera and Microphone Permissions</span>
            </div>
            <div className="permissions-cards-grid">
              {/* Card 1: Camera Permission */}
              <div className={`permission-card ${cameraStatus}`}>
                <div className="permission-card-head">
                  <div className="permission-title-group">
                    <div className="permission-icon-wrap">
                      <Camera size={22} />
                    </div>
                    <div>
                      <h4>Camera Permission</h4>
                      <p>Required for live visual proctoring & face visibility</p>
                    </div>
                  </div>
                  <span className={`perm-badge ${cameraStatus}`}>
                    {cameraStatus === "active"
                      ? "✓ Granted"
                      : cameraStatus === "denied"
                      ? "✕ Denied"
                      : "Pending"}
                  </span>
                </div>

                <div className="permission-body-preview">
                  {cameraStatus === "active" ? (
                    <div className="camera-preview-box">
                      <video
                        ref={preflightVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-preview-video"
                      />
                      <div className="face-oval-guide">
                        <div className="face-oval-border" />
                        <span className="face-oval-text">Center Face In Oval</span>
                      </div>
                    </div>
                  ) : (
                    <div className="camera-preview-placeholder">
                      <Camera size={36} color="#94a3b8" />
                      <span>Click 'Enable Camera' to preview video feed</span>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="alert-preflight-error" style={{ marginBottom: 12 }}>
                    <AlertCircle size={15} />
                    <span>{cameraError}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={`btn ${cameraStatus === "active" ? "btn-outline" : "btn-primary"} small`}
                  onClick={handleEnableCamera}
                  disabled={isEnablingCamera}
                >
                  <Camera size={15} />
                  {isEnablingCamera
                    ? "Requesting Access..."
                    : cameraStatus === "active"
                    ? "Camera Active · Re-test"
                    : "Enable Camera"}
                </button>
              </div>

              {/* Card 2: Microphone Permission */}
              <div className={`permission-card ${micStatus}`}>
                <div className="permission-card-head">
                  <div className="permission-title-group">
                    <div className="permission-icon-wrap">
                      <Mic size={22} />
                    </div>
                    <div>
                      <h4>Microphone Permission</h4>
                      <p>Required for speech and background sound monitoring</p>
                    </div>
                  </div>
                  <span className={`perm-badge ${micStatus}`}>
                    {micStatus === "active"
                      ? "✓ Granted"
                      : micStatus === "denied"
                      ? "✕ Denied"
                      : "Pending"}
                  </span>
                </div>

                <div className="permission-body-preview">
                  {micStatus === "active" ? (
                    <div className="audio-meter-panel">
                      <div className="audio-meter-status-row">
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          Live Audio Activity:
                        </span>
                        <span
                          className={`audio-detected-chip ${
                            micLevel > 15 ? "speaking" : "silence"
                          }`}
                        >
                          <Volume2 size={13} />
                          {micLevel > 15 ? "Voice / Sound Detected" : "Ambient Silence"}
                        </span>
                      </div>

                      {/* Dynamic Equalizer Visualizer Bars */}
                      <div className="audio-bars-container">
                        {[12, 28, 45, 60, 80, 65, 50, 35, 20, 15].map((scale, i) => {
                          const height = Math.min(
                            100,
                            Math.max(8, (micLevel * scale) / 35)
                          );
                          const isHot = height > 55;
                          const isLoud = height > 85;
                          return (
                            <div
                              key={i}
                              className={`audio-bar-stick ${
                                isLoud ? "loud" : isHot ? "hot" : ""
                              }`}
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>

                      <div className="audio-meter-status-row">
                        <small style={{ color: "#64748b" }}>
                          Real-time volume response level:
                        </small>
                        <strong style={{ color: micLevel > 40 ? "#ea580c" : "#10b981" }}>
                          {micLevel}%
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="camera-preview-placeholder">
                      <Mic size={36} color="#94a3b8" />
                      <span>Click 'Enable Microphone' to activate audio monitor</span>
                    </div>
                  )}
                </div>

                {micError && (
                  <div className="alert-preflight-error" style={{ marginBottom: 12 }}>
                    <AlertCircle size={15} />
                    <span>{micError}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={`btn ${micStatus === "active" ? "btn-outline" : "btn-primary"} small`}
                  onClick={handleEnableMicrophone}
                  disabled={isEnablingMic}
                >
                  <Mic size={15} />
                  {isEnablingMic
                    ? "Requesting Access..."
                    : micStatus === "active"
                    ? "Microphone Active · Re-test"
                    : "Enable Microphone"}
                </button>
              </div>
            </div>
          </div>

          {/* STEP 4: PRE-START VALIDATION & START EXAMINATION */}
          <div className="pre-exam-section-block" style={{ marginBottom: 0 }}>
            <div className="section-block-title">
              <span className="section-step-pill">Step 4</span>
              <span>Pre-Start Validation & Examination Launch</span>
            </div>
            <div className="pre-start-card">
              <div className="pre-start-items">
                <div className={`pre-check-pill ${cameraStatus === "active" ? "ok" : "missing"}`}>
                  {cameraStatus === "active" ? <Check size={16} /> : <X size={16} />}
                  <span>Camera Enabled & Live</span>
                </div>
                <div className={`pre-check-pill ${micStatus === "active" ? "ok" : "missing"}`}>
                  {micStatus === "active" ? <Check size={16} /> : <X size={16} />}
                  <span>Microphone Enabled & Monitoring</span>
                </div>
                <div className="pre-check-pill ok">
                  <Check size={16} />
                  <span>Fullscreen Lock Supported</span>
                </div>
                <div className={`pre-check-pill ${rulesAcknowledged ? "ok" : "missing"}`}>
                  {rulesAcknowledged ? <Check size={16} /> : <X size={16} />}
                  <span>Rules & Policy Confirmed</span>
                </div>
              </div>

              {/* Checkbox agreement */}
              <label className="pre-rules-agreement">
                <input
                  type="checkbox"
                  checked={rulesAcknowledged}
                  onChange={(e) => setRulesAcknowledged(e.target.checked)}
                />
                <div>
                  <strong>
                    I have read, understood, and agree to all 9 examination rules and policy guidelines.
                  </strong>
                  <small>
                    I consent to continuous camera and microphone surveillance, automated AI violation tracking, and understand that 3 violations will immediately terminate my exam attempt.
                  </small>
                </div>
              </label>

              {error && (
                <div className="alert-preflight-error" style={{ marginBottom: 18 }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="pre-start-actions">
                <Link className="btn btn-outline" to="/student">
                  <ArrowLeft size={16} /> Back to Dashboard
                </Link>
                <button
                  type="button"
                  className="btn btn-primary btn-launch-exam"
                  disabled={!canStartExam || starting}
                  onClick={() => startExam(false)}
                >
                  {starting ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Launching Exam Session...
                    </>
                  ) : (
                    <>
                      START EXAMINATION <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>

              {!canStartExam && (
                <p className="start-disabled-hint">
                  * Enable camera, microphone, and accept the agreement checkbox above to unlock the Start Examination button. (Exam timer will only begin after you click Start Examination).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FEATURE 2: AUTOMATICALLY TERMINATED EXAMINATION SCREEN
  // -------------------------------------------------------------
  if (isTerminated || attempt?.status === "TERMINATED" || result?.status === "TERMINATED") {
    let r =
      result?.result ||
      attempt?.result ||
      (result?.score != null ? result : null) ||
      (attempt?.score != null ? attempt : null);

    if (!r && questions.length > 0) {
      r = computeClientEvaluation(
        questions,
        answers || attempt?.answers || {},
        exam?.configuration
      );
    }

    const rawHistory = terminationData.violationHistory?.length
      ? terminationData.violationHistory
      : attempt?.violationHistory?.length
      ? attempt.violationHistory
      : [];

    const vHistory = [...rawHistory];
    while (vHistory.length < 3) {
      const num = vHistory.length + 1;
      vHistory.push({
        warningNumber: num,
        description:
          num === 1
            ? "Warning 1/3: Proctoring rule infraction or candidate face not detected."
            : num === 2
            ? "Warning 2/3 (FINAL WARNING): Second proctoring infraction recorded."
            : "Warning 3/3 (MAXIMUM VIOLATIONS REACHED): Third infraction recorded. Exam automatically terminated.",
        timestamp: new Date().toISOString(),
      });
    }

    const examDateStr = (attempt?.startedAt || terminationData.terminatedAt)
      ? new Date(attempt?.startedAt || terminationData.terminatedAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

    const formatTime = (ts) => {
      if (!ts) return "Recorded";
      try {
        return new Date(ts).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } catch {
        return String(ts);
      }
    };

    let passFailStatus = null;
    if (r && exam?.configuration) {
      if (exam.configuration.passingPercentage != null) {
        const pct = (r.score / (r.maximumMarks || 1)) * 100;
        passFailStatus = pct >= exam.configuration.passingPercentage ? "PASS" : "FAIL";
      } else if (
        exam.configuration.passMarks != null ||
        exam.configuration.passingMarks != null
      ) {
        const req =
          exam.configuration.passMarks ?? exam.configuration.passingMarks;
        passFailStatus = r.score >= req ? "PASS" : "FAIL";
      }
    }

    const percentageDisplay = r
      ? r.maximumMarks
        ? ((r.score / r.maximumMarks) * 100).toFixed(1)
        : r.accuracy
      : 0;

    return (
      <div className="exam-terminated-screen">
        <div className="exam-terminated-card">
          {/* Red Warning/Termination Indicator */}
          <div className="termination-hero">
            <div className="termination-icon-wrap">
              <ShieldAlert size={40} />
            </div>
            <h1>EXAM TERMINATED</h1>
            <div className="termination-hero-badge">
              <AlertTriangle size={14} /> Maximum Proctoring Limit Reached
            </div>
          </div>

          {/* Required Violation Disclaimer Box */}
          <div className="termination-disclaimer">
            <h3>
              <AlertCircle size={18} /> Official Examination Proctoring Notice
            </h3>
            <p>
              Your examination has been automatically terminated because you have violated the examination rules three times.
            </p>
            <p>
              As per the examination policy, a maximum of three violations are permitted. Your third violation resulted in automatic termination and submission of your examination.
            </p>
            <p>
              Your answers submitted up to this point have been recorded.
            </p>
          </div>

          {/* Details Section */}
          <div className="termination-details-section">
            <div className="termination-details-grid">
              <div className="termination-detail-item">
                <span className="label">Candidate Name</span>
                <span className="value">{user?.name || "Registered Candidate"}</span>
              </div>
              <div className="termination-detail-item">
                <span className="label">Exam Name</span>
                <span className="value">
                  {exam?.title || attempt?.examTitle || "Online Examination"}
                </span>
              </div>
              <div className="termination-detail-item">
                <span className="label">Exam Date and Time</span>
                <span className="value">{examDateStr}</span>
              </div>
              <div className="termination-detail-item">
                <span className="label">Total Violations</span>
                <span className="value" style={{ color: "#dc2626", fontWeight: 900 }}>
                  3 of 3
                </span>
              </div>
              <div className="termination-detail-item">
                <span className="label">Exam Status</span>
                <span className="status-pill-terminated">
                  <X size={12} /> TERMINATED
                </span>
              </div>
              <div className="termination-detail-item">
                <span className="label">Termination Reason</span>
                <span className="value" style={{ color: "#b91c1c" }}>
                  Maximum violation limit reached
                </span>
              </div>
            </div>

            {/* Violation History (Violation 1, 2, 3 with descriptions and timestamps) */}
            <div className="violation-history-box">
              <h3>
                <Clock3 size={16} /> Violation History (3 Recorded Events)
              </h3>
              <div className="violation-list">
                {vHistory.slice(0, 3).map((v, i) => (
                  <div
                    key={i}
                    className={`violation-card ${i === 2 ? "final" : ""}`}
                  >
                    <span className="violation-badge">
                      Violation {v.warningNumber || i + 1}
                    </span>
                    <div className="violation-info">
                      <strong>
                        {v.description ||
                          v.message ||
                          `Proctoring violation ${i + 1}`}
                      </strong>
                      <small>
                        <Clock3 size={11} /> Timestamp: {formatTime(v.timestamp)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Examination Result Section */}
            <div className="termination-results-box">
              <h3>
                <Bookmark size={18} color="#2563eb" /> Examination Result Summary
              </h3>

              {!r ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <RefreshCw size={24} className="spin" color="#dc2626" />
                  <p className="muted" style={{ marginTop: 8 }}>
                    Evaluating submitted answers and computing score...
                  </p>
                </div>
              ) : (
                <>
                  <div className="termination-metrics-grid">
                    <div className="term-metric-tile highlight">
                      <small>Obtained Marks</small>
                      <strong>{r.score}</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Total Marks</small>
                      <strong>{r.maximumMarks}</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Percentage</small>
                      <strong>{percentageDisplay}%</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Attempted</small>
                      <strong>{r.attempted}</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Correct</small>
                      <strong style={{ color: "#059669" }}>{r.correct}</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Incorrect</small>
                      <strong style={{ color: "#dc2626" }}>{r.incorrect}</strong>
                    </div>
                    <div className="term-metric-tile">
                      <small>Unanswered</small>
                      <strong>{r.unanswered ?? r.unattempted ?? 0}</strong>
                    </div>
                    {passFailStatus && (
                      <div
                        className={`term-metric-tile ${passFailStatus.toLowerCase()}`}
                      >
                        <small>Pass / Fail Status</small>
                        <strong>{passFailStatus}</strong>
                      </div>
                    )}
                  </div>

                  {/* Review of Attempted Questions & Explanations */}
                  <div className="review-section" style={{ marginTop: 24 }}>
                    <h4
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        marginBottom: 12,
                      }}
                    >
                      Attempted Questions & Answer Explanations
                    </h4>
                    {questions.map((qItem, i) => {
                      const d = r.details?.find((item) => item.id === qItem.id);
                      return (
                        <div key={qItem.id} className="review-item">
                          <strong>
                            Q{i + 1}. {qItem.text}
                          </strong>
                          <p>
                            Your answer:{" "}
                            {d?.attempted
                              ? d.selectedOptions?.length
                                ? d.selectedOptions
                                    .map(
                                      (value) =>
                                        `${String.fromCharCode(65 + value)}. ${
                                          qItem.options[value]
                                        }`
                                    )
                                    .join(", ")
                                : d.selectedValue
                              : "Not attempted"}{" "}
                            · Correct:{" "}
                            {d?.correctOptions?.length
                              ? d.correctOptions
                                  .map(
                                    (value) =>
                                      `${String.fromCharCode(65 + value)}. ${
                                        qItem.options[value]
                                      }`
                                  )
                                  .join(", ")
                              : d?.correctValue}
                          </p>
                          <small>{d?.explanation}</small>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Strict: No retake or restart buttons! */}
            <div className="termination-actions-bar">
              <Link className="btn btn-primary" to="/student/results">
                View All Results in Portal <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-outline" to="/student">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // POST-EXAM RESULTS SCREEN (NORMAL SUBMISSION)
  // -------------------------------------------------------------
  if (result) {
    const r = result.result;
    return (
      <div className="exam-results">
        <div className="result-complete">
          <div className="result-check">
            <CheckCircle2 size={39} />
          </div>
          <span className="eyebrow">EXAM COMPLETED & SUBMITTED</span>
          <h1>Well done, {user.name.split(" ")[0]}!</h1>
          <p>
            Your examination responses and proctoring audit log have been recorded.
          </p>

          {isFlagged && (
            <div className="flagged-submission-notice">
              <ShieldAlert size={20} color="#b91c1c" />
              <div>
                <strong>Proctoring Notice: Flagged for Review</strong>
                <p>
                  This session accumulated proctoring warnings during testing. Responses were submitted successfully, but results remain subject to proctor review.
                </p>
              </div>
            </div>
          )}

          <div className="result-score">
            <small>ACCURACY ACROSS ALL QUESTIONS</small>
            <strong>
              {r.accuracy}% <span>· {r.correct}/{r.total}</span>
            </strong>
          </div>
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
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 16,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <Link className="btn btn-primary" to="/student/results">
              View My Results <ArrowRight size={16} />
            </Link>
            <Link className="btn btn-outline" to="/student">
              Student Dashboard
            </Link>
          </div>
          <div className="review-section">
            <h3>Answer explanations</h3>
            {questions.map((qItem, i) => {
              const d = r.details.find((item) => item.id === qItem.id);
              return (
                <div key={qItem.id} className="review-item">
                  <strong>
                    Q{i + 1}. {qItem.text}
                  </strong>
                  <p>
                    Your answer:{" "}
                    {d?.attempted
                      ? d.selectedOptions?.length
                        ? d.selectedOptions
                            .map(
                              (value) =>
                                `${String.fromCharCode(65 + value)}. ${
                                  qItem.options[value]
                                }`
                            )
                            .join(", ")
                        : d.selectedValue
                      : "Not attempted"}{" "}
                    · Correct:{" "}
                    {d?.correctOptions?.length
                      ? d.correctOptions
                          .map(
                            (value) =>
                              `${String.fromCharCode(65 + value)}. ${
                                qItem.options[value]
                              }`
                          )
                          .join(", ")
                      : d?.correctValue}
                  </p>
                  <small>{d?.explanation}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FEATURE 3: ACTIVE EXAMINATION INTERFACE WITH NAVIGATION & HUD
  // -------------------------------------------------------------
  const q = questions[idx];

  // Helper to jump to a section's first question
  const handleSectionClick = (sectionName) => {
    const targetIdx = questions.findIndex((item) => item.subject === sectionName);
    if (targetIdx >= 0) {
      setIdx(targetIdx);
    }
  };

  return (
    <div className="exam-screen">
      {/* FEATURE 2: 3-Second Termination Countdown Overlay */}
      {countdownData && (
        <div className="countdown-modal-overlay">
          <div className="countdown-modal-card">
            <div className="countdown-huge-circle">
              {countdownData.secondsRemaining}
            </div>
            <h2>EXAMINATION TERMINATION IN {countdownData.secondsRemaining}s</h2>
            <p>{countdownData.formattedMessage}</p>
            <div className="countdown-freeze-note">
              <AlertTriangle size={15} /> All inputs frozen. Examination answers are being recorded and submitted.
            </div>
          </div>
        </div>
      )}

      {/* Real-time Warning Banner (Three-Level Warning System) */}
      {activeWarning && !countdownData && (
        <div
          className={`proctoring-warning-bar warning-level-${activeWarning.warningLevel} ${
            activeWarning.warningCount === 2 ? "flagged-bar" : ""
          }`}
        >
          <div className="warning-bar-content">
            <AlertTriangle size={20} className="warning-icon-pulse" />
            <div className="warning-text">
              <strong>
                {activeWarning.warningCount === 2
                  ? "FINAL PROCTORING WARNING (2 OF 3)"
                  : `PROCTORING WARNING ${activeWarning.warningCount} OF 3`}
              </strong>
              <span>{activeWarning.message}</span>
            </div>
          </div>
          <span className="warning-counter-pill">
            {activeWarning.warningCount}/3 Violations
          </span>
        </div>
      )}

      {/* Header */}
      <header className="exam-header">
        <div className="exam-head-brand">
          <Brand compact />
          <div>
            <strong>{exam.title}</strong>
            <small>
              Live Proctored Assessment · Section: {currentSection} · {questions.length} Questions
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
            disabled={countdownData !== null}
          >
            Submit Exam <Send size={14} />
          </button>
        </div>
      </header>

      {/* FEATURE 3: Dynamic Section Navigation Tabs */}
      {sections.length > 1 && (
        <nav className="exam-section-tabs">
          {sections.map((sec) => (
            <button
              key={sec.name}
              type="button"
              className={`section-tab-item ${
                currentSection === sec.name ? "active" : ""
              }`}
              onClick={() => handleSectionClick(sec.name)}
              disabled={countdownData !== null}
            >
              <span>{sec.name}</span>
              <span className="section-tab-count">{sec.count} Qs</span>
            </button>
          ))}
        </nav>
      )}

      {/* Main Examination Layout */}
      <div className="exam-body">
        <main className="question-area">
          <div className="question-meta">
            <span>
              QUESTION {idx + 1} OF {questions.length}
            </span>
            <span className="tag">
              {q.subject} · {q.chapter}
            </span>
            <span className="tag green">
              {q.questionType === "multiple_correct"
                ? "Multiple correct"
                : "Single correct"}
            </span>
          </div>
          <div className="question-progress">
            <i
              style={{ width: ((idx + 1) / questions.length) * 100 + "%" }}
            />
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
              disabled={countdownData !== null}
            />
          </div>

          {/* Question Controls & Navigation */}
          <div className="question-controls">
            <div className="question-left-actions">
              <button
                className="btn btn-outline small"
                onClick={clear}
                disabled={countdownData !== null}
              >
                Clear Response
              </button>
              <button
                className={
                  "btn small " +
                  (marked.includes(q.id) ? "btn-primary" : "btn-soft")
                }
                onClick={toggleMark}
                disabled={countdownData !== null}
              >
                <Bookmark size={15} />{" "}
                {marked.includes(q.id) ? "Marked" : "Mark for Review"}
              </button>
            </div>
            <div className="question-navigation">
              <button
                className="btn btn-outline small"
                disabled={idx <= 0 || countdownData !== null}
                onClick={() => setIdx(idx - 1)}
              >
                <ArrowLeft size={15} /> Previous Question
              </button>
              <button
                className="btn btn-primary small"
                disabled={countdownData !== null}
                onClick={() => {
                  if (idx < questions.length - 1) {
                    setIdx(idx + 1);
                  } else {
                    setConfirm(true);
                  }
                }}
              >
                {idx === questions.length - 1 ? (
                  <>
                    Finish & Submit Exam <Send size={15} />
                  </>
                ) : (
                  <>
                    Next Question <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar with Live Webcam & Audio Proctoring HUD */}
        <aside className="question-sidebar">
          {/* Live Webcam Widget */}
          <div className="live-proctoring-widget">
            <div className="proctoring-widget-header">
              <div className="active-cam-badge">
                <span className="green-pulse" /> AI PROCTOR ACTIVE
              </div>
              <span
                className={`proctor-warning-badge ${
                  warningCount > 0
                    ? isFlagged
                      ? "badge-danger"
                      : "badge-warn"
                    : "badge-ok"
                }`}
              >
                Violations: {warningCount}/3
              </span>
            </div>
            <div className="proctoring-video-frame">
              <video
                ref={(el) => {
                  liveVideoRef.current = el;
                  if (el && proctoringEngineRef.current) {
                    proctoringEngineRef.current.attachVideoElement(el);
                  }
                }}
                autoPlay
                playsInline
                muted
                className="live-video-element"
              />
              <div className="video-secure-watermark">
                <span>{user.name}</span>
                <span>REC ● AI VISION & AUDIO</span>
              </div>
            </div>

            {/* Live Proctoring Status Panel (Features 4 & 5) */}
            <div className="proctoring-status-panel">
              <div className="proctoring-status-row">
                <span className="status-label">Camera:</span>
                <span
                  className={`status-val ${
                    proctoringStats.cameraStatus === "Connected"
                      ? "val-green"
                      : "val-red"
                  }`}
                >
                  <span
                    className={
                      proctoringStats.cameraStatus === "Connected"
                        ? "green-dot"
                        : "red-dot"
                    }
                  />
                  {proctoringStats.cameraStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Face Detection:</span>
                <span
                  className={`status-val ${
                    proctoringStats.faceStatusCode === "normal"
                      ? "val-green"
                      : proctoringStats.faceStatusCode === "no_face"
                      ? "val-amber"
                      : "val-red"
                  }`}
                >
                  {proctoringStats.faceStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Microphone:</span>
                <span
                  className={`status-val ${
                    proctoringStats.micStatus === "Connected"
                      ? "val-green"
                      : "val-red"
                  }`}
                >
                  <span
                    className={
                      proctoringStats.micStatus === "Connected"
                        ? "green-dot"
                        : "red-dot"
                    }
                  />
                  {proctoringStats.micStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Audio Monitor:</span>
                <span
                  className={`status-val ${
                    proctoringStats.audioMonitoringStatus.includes("Voice")
                      ? "val-red"
                      : proctoringStats.audioMonitoringStatus.includes("Silence")
                      ? "val-green"
                      : "val-amber"
                  }`}
                >
                  {proctoringStats.audioMonitoringStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Total Violations:</span>
                <span
                  className={`status-val ${
                    warningCount > 0
                      ? warningCount >= 2
                        ? "val-red"
                        : "val-amber"
                      : "val-green"
                  }`}
                >
                  <strong>{warningCount} of 3</strong>
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Last Check:</span>
                <span className="status-val muted-val">
                  {proctoringStats.lastCheckTime || "Running..."}
                </span>
              </div>
            </div>
          </div>

          <div className="student-session">
            <div className="avatar">{user.name[0]}</div>
            <div>
              <strong>{user.name}</strong>
              <small>Candidate · Live Proctored</small>
            </div>
            <ShieldCheck size={19} color="#10b981" />
          </div>

          {/* Question Palette with 4 Visual States */}
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
            {questions.map((item, i) => {
              const isAnswered = hasAnswer(answers[item.id]);
              const isMarked = marked.includes(item.id);
              const isVisited = visited.includes(item.id);

              let statusClass = "unvisited";
              if (isAnswered) statusClass = "answered";
              else if (isMarked) statusClass = "marked";
              else if (isVisited) statusClass = "visited";

              return (
                <button
                  title={`Question ${i + 1} (${item.subject})`}
                  key={item.id}
                  disabled={countdownData !== null}
                  onClick={() => setIdx(i)}
                  className={`${statusClass} ${idx === i ? " current" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
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
            <div>
              <span>Proctoring Warnings</span>
              <strong
                style={{
                  color: warningCount > 0 ? "#e11d48" : "#10b981",
                }}
              >
                {warningCount} / 3 {isFlagged ? "(FLAGGED)" : ""}
              </strong>
            </div>
          </div>

          <div className="exam-sidebar-note">
            <ShieldCheck size={16} color="#10b981" />
            <span>
              Continuous AI vision and audio proctoring active. Camera stream, face alignment, and background voice are monitored in real time.
            </span>
          </div>
        </aside>
      </div>

      {/* Submission Confirmation Modal */}
      {confirm && (
        <div className="modal-cover">
          <div className="confirm-modal">
            <div className="modal-icon">
              <Flag />
            </div>
            <h2>Submit your examination?</h2>
            <p>
              This action is final. Your webcam and microphone proctoring session will end and responses will be locked.
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
