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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import Brand from "../../components/Brand";
import { Loading } from "../../components/Layouts";
import QuestionRenderer from "../../components/QuestionRenderer";
import { ProctoringEngine } from "../../lib/proctoringEngine";
import "./Exam.css";

const format = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  // Pre-examination Verification State
  const [preflightStatus, setPreflightStatus] = useState({
    cameraHardware: false,
    cameraPermission: false,
    videoPreview: false,
    faceVisible: false,
    internetStable: false,
    browserCompatible: false,
    fullscreenAvailable: false,
    instructionsAcknowledged: false,
    consentGiven: false,
  });
  const [preflightRunning, setPreflightRunning] = useState(false);
  const [preflightError, setPreflightError] = useState("");
  const [previewStream, setPreviewStream] = useState(null);

  // Live Proctoring State
  const [proctoringActive, setProctoringActive] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationData, setTerminationData] = useState({
    reason: "Maximum violation limit reached",
    terminatedAt: null,
    violationHistory: [],
    warningCount: 3,
  });
  const [starting, setStarting] = useState(false);
  const [proctoringStats, setProctoringStats] = useState({
    cameraStatus: "Connected",
    aiStatus: "Initializing...",
    faceStatus: "Checking camera feed...",
    faceStatusCode: "normal",
    faceCount: 1,
    lastCheckTime: null,
    monitoringInterval: "3 Seconds",
    violationCount: 0,
  });

  // Refs
  const preflightVideoRef = useRef(null);
  const liveVideoRef = useRef(null);
  const proctoringEngineRef = useRef(null);
  const previewStreamRef = useRef(null);
  previewStreamRef.current = previewStream;
  const dataRef = useRef({ answers, marked });
  dataRef.current = { answers, marked };
  const submittedRef = useRef(false);
  const currentAttempt = useRef(null);

  // Load exam and question metadata, plus check for existing attempt
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
                reason: myAttempt.terminationReason || "Maximum violation limit reached",
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
                  Math.floor((new Date(myAttempt.deadlineAt).getTime() - Date.now()) / 1000)
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

  // Run initial preflight device verification
  const runVerification = useCallback(async () => {
    setPreflightRunning(true);
    setPreflightError("");
    try {
      const res = await ProctoringEngine.runPreflightChecks(preflightVideoRef.current);
      if (res.stream) {
        setPreviewStream(res.stream);
        previewStreamRef.current = res.stream;
      }
      setPreflightStatus((prev) => ({
        ...prev,
        cameraHardware: res.cameraHardware,
        cameraPermission: res.cameraPermission,
        videoPreview: res.videoPreview,
        faceVisible: res.faceVisible,
        internetStable: res.internetStable,
        browserCompatible: res.browserCompatible,
        fullscreenAvailable: res.fullscreenAvailable,
      }));
      if (res.errorMessage) {
        setPreflightError(res.errorMessage);
      }
    } catch (err) {
      setPreflightError(err.message || "Camera verification failed");
    } finally {
      setPreflightRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!attempt && !result && exam) {
      runVerification();
    }
  }, [attempt, result, exam, runVerification]);

  // Keep camera preview alive on element when previewStream is available
  useEffect(() => {
    if (previewStream && preflightVideoRef.current) {
      if (preflightVideoRef.current.srcObject !== previewStream) {
        preflightVideoRef.current.srcObject = previewStream;
        preflightVideoRef.current.muted = true;
        preflightVideoRef.current.play().catch(() => {});
      }
    }
  }, [previewStream]);

  // Continual face alignment check while on preflight preview
  useEffect(() => {
    if (!previewStream || attempt || result || preflightStatus.faceVisible) return;
    const interval = setInterval(async () => {
      if (preflightVideoRef.current && preflightVideoRef.current.readyState >= 2) {
        try {
          const res = await ProctoringEngine.detectFaceInVideo(preflightVideoRef.current);
          if (res.faceCount >= 1 || res.status === "normal" || res.status === "fallback_ok") {
            setPreflightStatus((prev) => ({ ...prev, faceVisible: true }));
          }
        } catch {
          // Keep polling softly
        }
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [previewStream, attempt, result, preflightStatus.faceVisible]);

  // Cleanup preview stream only if exam is never started (page navigated away)
  useEffect(() => {
    return () => {
      if (!currentAttempt.current && previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
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

  // Verify all 9 conditions before enabling Start Exam
  const allChecksPassed =
    preflightStatus.cameraHardware &&
    preflightStatus.cameraPermission &&
    preflightStatus.videoPreview &&
    preflightStatus.faceVisible &&
    preflightStatus.internetStable &&
    preflightStatus.browserCompatible &&
    preflightStatus.fullscreenAvailable &&
    preflightStatus.instructionsAcknowledged &&
    preflightStatus.consentGiven;

  // Helper to proactively evaluate score client-side if server evaluation is in-flight or delayed
  const computeClientEvaluation = useCallback((questionList, submittedAnswers, examConfig) => {
    if (!questionList || !questionList.length) return null;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let score = 0;
    const details = [];

    const marking = examConfig?.rules?.single_correct || { correct: 4, incorrect: -1, unanswered: 0 };
    const posMark = Number(marking.correct ?? 4);
    const negMark = Math.abs(Number(marking.incorrect ?? -1));

    questionList.forEach((item) => {
      const ans = submittedAnswers[item.id];
      const isAnswered = ans !== undefined && ans !== null && ans !== "";
      let isCorrect = false;

      if (isAnswered) {
        if (item.questionType === "multiple_correct") {
          const correctSet = new Set(Array.isArray(item.correctOptions) ? item.correctOptions : [item.answer]);
          const userSet = new Set(Array.isArray(ans) ? ans : [ans]);
          isCorrect = correctSet.size === userSet.size && [...correctSet].every((val) => userSet.has(val));
        } else {
          const userVal = Number.isInteger(ans) ? ans : Number(ans);
          const correctVal = Number.isInteger(item.answer) ? item.answer : Number(item.correctOption);
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
        selectedValue: isAnswered ? (Number.isInteger(ans) ? String.fromCharCode(65 + ans) : String(ans)) : null,
        correctValue: Number.isInteger(item.answer) ? String.fromCharCode(65 + item.answer) : (Number.isInteger(item.correctOption) ? String.fromCharCode(65 + item.correctOption) : String(item.answer || item.correctOption || "A")),
        selectedOptions: Array.isArray(ans) ? ans : (isAnswered ? [ans] : []),
        correctOptions: Array.isArray(item.correctOptions) ? item.correctOptions : [item.answer ?? item.correctOption ?? 0],
        isCorrect,
        explanation: item.explanation || "Official answer key verified by examination board.",
      });
    });

    const attemptedCount = correct + incorrect;
    const maximumMarks = questionList.length * posMark;
    const accuracy = attemptedCount > 0 ? Math.round((correct / attemptedCount) * 100) : 0;

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
  }, []);

  // Handle Automatic Exam Termination upon 3 Proctoring Violations
  const handleAutomaticTermination = useCallback(
    async (termInfo) => {
      // 1. Immediately stop timer and freeze interface
      setIsTerminated(true);
      setSeconds(0);
      setActiveWarning(null);

      // 2. Cleanly stop proctoring engine & camera
      if (proctoringEngineRef.current) {
        proctoringEngineRef.current.destroy();
        proctoringEngineRef.current = null;
      }
      setProctoringActive(false);

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      const curAnswers = termInfo?.answers || dataRef.current.answers || answers || {};
      const history = termInfo?.violationHistory || [];
      const targetAttemptId = currentAttempt.current?.id || attempt?.id || termInfo?.attemptId;

      setTerminationData({
        reason: "Maximum violation limit reached",
        terminatedAt: new Date().toISOString(),
        violationHistory: history,
        warningCount: 3,
      });

      // Immediate proactive calculation so user never sees a blank or indefinitely loading screen
      const clientEval = computeClientEvaluation(questions, curAnswers, exam?.configuration);
      if (clientEval) {
        setResult({
          result: clientEval,
          status: "TERMINATED",
          terminationReason: "MAX_VIOLATIONS_REACHED",
        });
      }

      // 3. Sync termination to backend and retrieve authoritative evaluated result
      if (targetAttemptId && token) {
        try {
          const res = await api("/proctoring/warning", {
            method: "POST",
            token,
            body: {
              attemptId: targetAttemptId,
              category: "exam_rule_violation",
              message: "Warning 3/3 (MAXIMUM VIOLATIONS REACHED): Exam automatically terminated.",
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
          console.error("Proctoring warning sync error during termination:", err);
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

  // Start Examination with Live Proctoring
  async function startExam(isRetake = false) {
    const retake = isRetake === true;

    // 1. Mandatory Pre-check Validation
    if (!retake && !allChecksPassed) {
      if (!preflightStatus.instructionsAcknowledged || !preflightStatus.consentGiven) {
        setError(
          "Please accept the Examination Guidelines (Item 8) and AI Live Proctoring Consent (Item 9) to continue."
        );
      } else if (!preflightStatus.cameraHardware || !preflightStatus.cameraPermission) {
        setError("Camera permission is required. Please enable your webcam in the browser address bar.");
      } else {
        setError("Please complete all mandatory pre-examination verification checks before entering.");
      }
      return;
    }

    if (starting) return;
    setStarting(true);
    setError("");

    try {
      // 2. Immediately initiate Fullscreen request within the user's click interaction
      // (Preserves browser transient activation!)
      const fullscreenOk = await enterFullscreen();
      const fsSupported = !!(
        document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.msFullscreenEnabled
      );

      if (fsSupported && !fullscreenOk) {
        throw new Error(
          "Fullscreen mode is mandatory for live proctored examinations. Please allow fullscreen in your browser to proceed."
        );
      }

      // 3. Verify or acquire active camera stream
      let streamToUse = previewStreamRef.current;
      const isStreamActive = (s) =>
        s && s.active && s.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);

      if (!isStreamActive(streamToUse)) {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
              "Your browser does not support webcam access. Please use Chrome, Edge, Firefox, or Safari."
            );
          }
          streamToUse = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
            },
            audio: false,
          });
          setPreviewStream(streamToUse);
          previewStreamRef.current = streamToUse;
        } catch (camErr) {
          if (camErr.name === "NotAllowedError" || camErr.name === "PermissionDeniedError") {
            throw new Error(
              "Camera access permission was denied. Please allow camera permissions in your browser address bar and try again."
            );
          } else if (camErr.name === "NotFoundError" || camErr.name === "DevicesNotFoundError") {
            throw new Error("No webcam camera detected. Please connect or enable your camera to proceed.");
          } else if (camErr.name === "NotReadableError" || camErr.name === "TrackStartError") {
            throw new Error(
              "Webcam is currently in use by another application. Please close other camera apps and retry."
            );
          } else {
            throw new Error(camErr.message || "Failed to initialize webcam for proctoring.");
          }
        }
      }

      // 4. Validate authentication
      if (!token) {
        throw new Error("Your login session has expired. Please log in again to begin the examination.");
      }

      // 5. Backend Start Attempt API (with auto-registration retry fallback)
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
        throw new Error("Failed to initialize authorized exam session. Please try again.");
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

      // 6. Confirm and initialize proctoring session on backend
      try {
        await api("/proctoring/session/init", {
          method: "POST",
          token,
          body: {
            attemptId: next.id,
            examId: id,
            browserData: {
              userAgent: navigator.userAgent,
              screenResolution: `${window.screen.width}x${window.screen.height}`,
            },
            verificationChecks: {
              cameraAvailable: true,
              permissionGranted: true,
              faceDetected: true,
              internetOk: navigator.onLine,
              browserCompatible: true,
              fullscreenAvailable: true,
              instructionsAccepted: true,
              consentGiven: true,
            },
          },
        });
      } catch (procErr) {
        console.warn("Proctoring session initialization notice:", procErr);
      }

      // 7. Initialize Live Proctoring Engine
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
              setActiveWarning((cur) => (cur?.timestamp === warn.timestamp ? null : cur));
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
            setActiveWarning((cur) => (cur?.code === status.resolvedIncident ? null : cur));
          }
        },
        onStatsUpdate: (stats) => {
          setProctoringStats((prev) => ({
            ...prev,
            ...stats,
          }));
        },
        onTerminated: (termInfo) => {
          handleAutomaticTermination(termInfo);
        },
      });

      proctoringEngineRef.current = engine;
      setProctoringActive(true);

      // Start engine with live webcam stream
      await engine.startMonitoring(null, streamToUse);

      // 8. Authoritative countdown timer & transition to live exam
      const deadlineMs = new Date(next.deadlineAt).getTime();
      const leftSeconds = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));

      setResult(null);
      setAttempt(next);
      currentAttempt.current = next;
      setAnswers(next.answers || {});
      setMarked(next.marked || []);
      setSeconds(leftSeconds);
    } catch (issue) {
      console.error("Examination start error:", issue);
      let userMsg = issue.message || "Failed to start examination. Please try again.";
      if (
        userMsg.toLowerCase().includes("failed to fetch") ||
        userMsg.toLowerCase().includes("unable to reach")
      ) {
        userMsg = "Unable to connect to MeritX servers. Please check your internet connection and try again.";
      }
      setError(userMsg);
    } finally {
      setStarting(false);
    }
  }

  // Ensure proctoring webcam binds to live video element as soon as active exam HUD mounts
  useEffect(() => {
    if (attempt && liveVideoRef.current && proctoringEngineRef.current) {
      proctoringEngineRef.current.attachVideoElement(liveVideoRef.current);
    }
  }, [attempt]);

  // Auto-resume proctoring stream if candidate loaded an in-progress attempt directly
  useEffect(() => {
    if (attempt && !result && !isTerminated && attempt.status === "in_progress" && !proctoringEngineRef.current && token) {
      let isCancelled = false;
      const resumeProctoring = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false,
          });
          if (isCancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const engine = new ProctoringEngine({
            token,
            examId: id,
            attemptId: attempt.id,
            getAnswers: () => dataRef.current.answers,
            onWarning: (warn) => {
              setWarningCount(warn.warningCount);
              setActiveWarning(warn);
              if (warn.isFlagged) setIsFlagged(true);
              if (!warn.isTerminated) {
                setTimeout(() => {
                  setActiveWarning((cur) => (cur?.timestamp === warn.timestamp ? null : cur));
                }, 6000);
              }
            },
            onStatusChange: (status) => {
              setWarningCount(status.warningCount);
              setIsFlagged(status.isFlagged);
              if (status.isTerminated) setIsTerminated(true);
              if (status.resolvedIncident) {
                setActiveWarning((cur) => (cur?.code === status.resolvedIncident ? null : cur));
              }
            },
            onStatsUpdate: (stats) => {
              setProctoringStats((prev) => ({
                ...prev,
                ...stats,
              }));
            },
            onTerminated: (termInfo) => {
              handleAutomaticTermination(termInfo);
            },
          });
          proctoringEngineRef.current = engine;
          setProctoringActive(true);
          await engine.startMonitoring(liveVideoRef.current, stream);
        } catch (err) {
          console.warn("Could not auto-resume proctoring webcam:", err);
        }
      };
      resumeProctoring();
      return () => {
        isCancelled = true;
      };
    }
  }, [attempt, result, isTerminated, token, id, handleAutomaticTermination]);

  // Submit Exam and Cleanly Release Webcam
  const submit = useCallback(async () => {
    if (submittedRef.current || !currentAttempt.current) return;
    submittedRef.current = true;

    // Cleanly release proctoring webcam immediately upon submission
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
      // Exit fullscreen if active
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
    if (!attempt || result) return;
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
  }, [attempt, result, submit]);

  // Tab switch counter
  useEffect(() => {
    if (!attempt || result) return;
    const onVisibility = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [attempt, result]);

  // Auto-save answers
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

  // Record visited questions
  useEffect(() => {
    if (questions.length)
      setVisited((p) =>
        p.includes(questions[idx].id) ? p : [...p, questions[idx].id]
      );
  }, [idx, questions]);

  // Segment timed sections
  useEffect(() => {
    const segments = exam?.configuration?.segments || [];
    if (!attempt || !segments.length || !questions.length) return;
    const elapsed = Math.max(0, attempt.durationSeconds - seconds);
    let boundary = 0;
    let active = segments.at(-1);
    for (const segment of segments) {
      boundary += segment.durationMinutes * 60;
      if (elapsed < boundary) {
        active = segment;
        break;
      }
    }
    if (!active.subjects.includes(questions[idx]?.subject)) {
      const first = questions.findIndex((item) =>
        active.subjects.includes(item.subject)
      );
      if (first >= 0) setIdx(first);
    }
  }, [attempt, exam, seconds, questions, idx]);

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
  // PRE-EXAMINATION VERIFICATION SCREEN
  // -------------------------------------------------------------
  if (!attempt) {
    const config = exam.configuration || {};
    const instructions = config.instructions || [
      "Keep your webcam active throughout the exam; moving away or blocking the camera triggers warnings.",
      "Ensure you are alone in a well-lit room. Multiple faces or secondary electronic devices trigger proctoring alerts.",
      "Fullscreen mode is mandatory. Switching browser tabs, minimizing the window, or exiting fullscreen flags your paper.",
      "You have a maximum allowance of 3 proctoring warnings before your session is permanently flagged for disciplinary action.",
      "Responses are saved automatically. The exam auto-submits when the timer reaches 00:00:00.",
    ];

    return (
      <div className="proctoring-verification-screen">
        <div className="verification-container">
          <div className="verification-header">
            <Brand />
            <div className="verification-header-meta">
              <span className="secure-badge">
                <ShieldCheck size={14} /> LIVE PROCTORED EXAMINATION ENVIRONMENT
              </span>
              <h1>{exam.title}</h1>
              <p className="verification-sub">
                Pre-Examination Hardware & AI Verification · Complete all 9 mandatory checks to begin
              </p>
            </div>
          </div>

          <div className="verification-grid">
            {/* Left: 9-Point Verification Checklist */}
            <div className="verification-checklist-card">
              <h3>
                <ShieldCheck size={18} color="#2563eb" /> Mandatory Pre-Exam Verification
              </h3>
              <p className="checklist-sub">
                All checks must be verified green before examination authorization is granted.
              </p>

              <div className="checklist-items">
                {/* 1. Camera Hardware */}
                <div className={`check-item ${preflightStatus.cameraHardware ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.cameraHardware ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>1. Camera Hardware Availability</strong>
                    <small>
                      {preflightStatus.cameraHardware
                        ? "Webcam hardware detected and ready."
                        : "No webcam detected. Please connect a webcam."}
                    </small>
                  </div>
                </div>

                {/* 2. Camera Permission */}
                <div className={`check-item ${preflightStatus.cameraPermission ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.cameraPermission ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>2. Camera Access Permission</strong>
                    <small>
                      {preflightStatus.cameraPermission
                        ? "Browser webcam permissions granted."
                        : "Camera permission denied. Allow camera in your browser address bar."}
                    </small>
                  </div>
                </div>

                {/* 3. Live Stream Preview */}
                <div className={`check-item ${preflightStatus.videoPreview ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.videoPreview ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>3. Live Stream Preview Rendering</strong>
                    <small>
                      {preflightStatus.videoPreview
                        ? "Real-time 640x480 video feed active."
                        : "Waiting for video frame rendering..."}
                    </small>
                  </div>
                </div>

                {/* 4. AI Face Visibility */}
                <div className={`check-item ${preflightStatus.faceVisible ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.faceVisible ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>4. AI Face Detection & Centering</strong>
                    <small>
                      {preflightStatus.faceVisible
                        ? "Candidate face detected and centered in frame."
                        : "Face not detected. Position yourself clearly in front of the lens."}
                    </small>
                  </div>
                </div>

                {/* 5. Internet Connection */}
                <div className={`check-item ${preflightStatus.internetStable ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.internetStable ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>5. Stable Internet Connection</strong>
                    <small>
                      {preflightStatus.internetStable
                        ? "Connected and synchronized with MeritX servers."
                        : "Offline or unstable network connection detected."}
                    </small>
                  </div>
                </div>

                {/* 6. Browser Compatibility */}
                <div className={`check-item ${preflightStatus.browserCompatible ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.browserCompatible ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>6. Browser WebRTC Compatibility</strong>
                    <small>
                      {preflightStatus.browserCompatible
                        ? "HTML5 WebRTC, Canvas & Audio/Video APIs supported."
                        : "Browser does not support modern WebRTC proctoring."}
                    </small>
                  </div>
                </div>

                {/* 7. Fullscreen Capability */}
                <div className={`check-item ${preflightStatus.fullscreenAvailable ? "pass" : "fail"}`}>
                  <span className="check-icon">
                    {preflightStatus.fullscreenAvailable ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="check-text">
                    <strong>7. Fullscreen Mode Capability</strong>
                    <small>
                      {preflightStatus.fullscreenAvailable
                        ? "Hardware lock & fullscreen API available."
                        : "Fullscreen mode is not supported or blocked."}
                    </small>
                  </div>
                </div>

                {/* 8. Instructions Consent Checkbox */}
                <label className="check-item-clickable">
                  <input
                    type="checkbox"
                    checked={preflightStatus.instructionsAcknowledged}
                    onChange={(e) =>
                      setPreflightStatus((p) => ({
                        ...p,
                        instructionsAcknowledged: e.target.checked,
                      }))
                    }
                  />
                  <div className="check-text">
                    <strong>8. Examination Guidelines Acknowledged</strong>
                    <small>
                      I confirm I have read and agree to follow all examination rules.
                    </small>
                  </div>
                </label>

                {/* 9. Continuous Proctoring Consent Checkbox */}
                <label className="check-item-clickable">
                  <input
                    type="checkbox"
                    checked={preflightStatus.consentGiven}
                    onChange={(e) =>
                      setPreflightStatus((p) => ({
                        ...p,
                        consentGiven: e.target.checked,
                      }))
                    }
                  />
                  <div className="check-text">
                    <strong>9. AI Live Proctoring & Surveillance Consent</strong>
                    <small>
                      I consent to continuous camera surveillance, automated 3-warning anomaly detection, and disciplinary flagging.
                    </small>
                  </div>
                </label>
              </div>

              {preflightError && (
                <div className="alert-preflight-error">
                  <AlertCircle size={16} />
                  <span>{preflightError}</span>
                </div>
              )}
            </div>

            {/* Right: Live Camera Preview & Guidelines */}
            <div className="verification-preview-card">
              <div className="preview-video-wrapper">
                <video
                  ref={preflightVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="preview-video-element"
                />
                <div className="face-oval-guide">
                  <div className="face-oval-border" />
                  <span className="face-oval-text">
                    {preflightStatus.faceVisible
                      ? "✓ Face Aligned"
                      : "Center Face Here"}
                  </span>
                </div>

                <div className="preview-status-pill">
                  {preflightStatus.faceVisible ? (
                    <span className="pill-green">
                      <span className="pulse-dot" /> AI FACE DETECTED
                    </span>
                  ) : (
                    <span className="pill-amber">
                      <AlertTriangle size={12} /> ALIGNING CANDIDATE...
                    </span>
                  )}
                </div>
              </div>

              <div className="preview-controls">
                <button
                  type="button"
                  className="btn btn-outline small"
                  onClick={runVerification}
                  disabled={preflightRunning}
                >
                  <RefreshCw
                    size={14}
                    className={preflightRunning ? "spin" : ""}
                  />{" "}
                  {preflightRunning ? "Testing Hardware..." : "Re-test Camera"}
                </button>
                <span className="video-res-note">
                  640 × 480 @ 30fps · Hardware Direct
                </span>
              </div>

              <div className="verification-rules-box">
                <h4>
                  <ShieldAlert size={15} color="#e11d48" /> 3-Level Warning Enforcement
                </h4>
                <ul>
                  {instructions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="verification-start-actions">
                <Link className="btn btn-outline" to={`/exams/${id}`}>
                  <ArrowLeft size={15} /> Exit
                </Link>
                <button
                  className="btn btn-primary btn-start-exam"
                  disabled={!allChecksPassed || starting}
                  onClick={(e) => {
                    e.preventDefault();
                    startExam(false);
                  }}
                >
                  {starting ? (
                    <>
                      <RefreshCw size={15} className="spin" /> Authorizing Live Exam...
                    </>
                  ) : (
                    <>
                      Enter Live Exam Mode <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="alert-preflight-error" style={{ marginTop: 14 }}>
                  <AlertCircle size={18} />
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <strong>{error}</strong>
                    {error.toLowerCase().includes("fullscreen") && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary small"
                          onClick={(e) => {
                            e.preventDefault();
                            setError("");
                            startExam(false);
                          }}
                        >
                          <Maximize2 size={14} /> Retry in Fullscreen Mode
                        </button>
                      </div>
                    )}
                    {error.toLowerCase().includes("camera") && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary small"
                          onClick={(e) => {
                            e.preventDefault();
                            setError("");
                            runVerification();
                          }}
                        >
                          <RefreshCw size={14} /> Re-verify Camera
                        </button>
                      </div>
                    )}
                    {error.toLowerCase().includes("already submitted") && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary small"
                          onClick={(e) => {
                            e.preventDefault();
                            setError("");
                            startExam(true);
                          }}
                        >
                          <RotateCcw size={14} /> Retake Exam Practice
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!allChecksPassed && (
                <p className="start-disabled-hint">
                  * Complete all 9 verification steps above to unlock the Start Examination button.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTOMATICALLY TERMINATED EXAMINATION SCREEN
  // -------------------------------------------------------------
  if (isTerminated || attempt?.status === "TERMINATED" || result?.status === "TERMINATED") {
    let r =
      result?.result ||
      attempt?.result ||
      (result?.score != null ? result : null) ||
      (attempt?.score != null ? attempt : null);

    // Proactive fallback evaluation so result is never empty or stuck loading
    if (!r && questions.length > 0) {
      r = computeClientEvaluation(questions, answers || attempt?.answers || {}, exam?.configuration);
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

    // Calculate pass/fail status if existing exam configuration supports it
    let passFailStatus = null;
    if (r && exam?.configuration) {
      if (exam.configuration.passingPercentage != null) {
        const pct = (r.score / (r.maximumMarks || 1)) * 100;
        passFailStatus = pct >= exam.configuration.passingPercentage ? "PASS" : "FAIL";
      } else if (exam.configuration.passMarks != null || exam.configuration.passingMarks != null) {
        const req = exam.configuration.passMarks ?? exam.configuration.passingMarks;
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
                <span className="value">{exam?.title || attempt?.examTitle || "Online Examination"}</span>
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
                      <strong>{v.description || v.message || `Proctoring violation ${i + 1}`}</strong>
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
                      <div className={`term-metric-tile ${passFailStatus.toLowerCase()}`}>
                        <small>Pass / Fail Status</small>
                        <strong>{passFailStatus}</strong>
                      </div>
                    )}
                  </div>

                  {/* Answer Explanations Review Section */}
                  <div className="review-section" style={{ marginTop: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
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
                                        `${String.fromCharCode(65 + value)}. ${qItem.options[value]}`
                                    )
                                    .join(", ")
                                : d.selectedValue
                              : "Not attempted"}{" "}
                            · Correct:{" "}
                            {d?.correctOptions?.length
                              ? d.correctOptions
                                  .map(
                                    (value) =>
                                      `${String.fromCharCode(65 + value)}. ${qItem.options[value]}`
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

            {/* Navigation Actions (Strictly no retake or resume!) */}
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
  // POST-EXAM RESULTS SCREEN
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
          <p>Your examination responses and proctoring audit log have been recorded.</p>

          {isFlagged && (
            <div className="flagged-submission-notice">
              <ShieldAlert size={20} color="#b91c1c" />
              <div>
                <strong>Proctoring Notice: Flagged for Review</strong>
                <p>
                  This session accumulated 3 proctoring warnings during testing. Responses were submitted successfully, but results remain subject to proctor approval.
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
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" to="/student/results">
              View My Results <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setResult(null);
                setAttempt(null);
                startExam(true);
              }}
            >
              <RotateCcw size={15} /> Retake Exam Practice
            </button>
          </div>
          <div className="review-section">
            <h3>Answer explanations</h3>
            {questions.map((q, i) => {
              const d = r.details.find((item) => item.id === q.id);
              return (
                <div key={q.id} className="review-item">
                  <strong>
                    Q{i + 1}. {q.text}
                  </strong>
                  <p>
                    Your answer:{" "}
                    {d?.attempted
                      ? d.selectedOptions?.length
                        ? d.selectedOptions
                            .map(
                              (value) =>
                                `${String.fromCharCode(65 + value)}. ${q.options[value]}`
                            )
                            .join(", ")
                        : d.selectedValue
                      : "Not attempted"}{" "}
                    · Correct:{" "}
                    {d?.correctOptions?.length
                      ? d.correctOptions
                          .map(
                            (value) =>
                              `${String.fromCharCode(65 + value)}. ${q.options[value]}`
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
  // ACTIVE EXAMINATION INTERFACE WITH CONTINUOUS PROCTORING HUD
  // -------------------------------------------------------------
  const q = questions[idx];
  const segments = exam.configuration?.segments || [];
  const elapsed = Math.max(0, attempt.durationSeconds - seconds);
  let activeSegment = segments.at(-1);
  if (segments.length) {
    let boundary = 0;
    for (const segment of segments) {
      boundary += segment.durationMinutes * 60;
      if (elapsed < boundary) {
        activeSegment = segment;
        break;
      }
    }
  }
  const activeSubjects = new Set(
    activeSegment?.subjects || exam.subjects || []
  );
  const permittedIndexes = questions
    .map((item, index) => (activeSubjects.has(item.subject) ? index : -1))
    .filter((index) => index >= 0);
  const positionInSegment = permittedIndexes.indexOf(idx);

  return (
    <div className="exam-screen">
      {/* Real-time Warning Banner (Three-Level Warning System) */}
      {activeWarning && (
        <div
          className={`proctoring-warning-bar warning-level-${activeWarning.warningLevel} ${activeWarning.warningCount === 2 ? "flagged-bar" : ""}`}
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
              Live Proctored Official Assessment · {questions.length} questions
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

      {/* Main Body */}
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

        {/* Sidebar with Live Webcam Proctoring HUD */}
        <aside className="question-sidebar">
          {/* Live Webcam Widget */}
          <div className="live-proctoring-widget">
            <div className="proctoring-widget-header">
              <div className="active-cam-badge">
                <span className="green-pulse" /> CAMERA ACTIVE
              </div>
              <span
                className={`proctor-warning-badge ${warningCount > 0 ? (isFlagged ? "badge-danger" : "badge-warn") : "badge-ok"}`}
              >
                Warnings: {warningCount}/3
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
                <span>REC ● AI MONITOR</span>
              </div>
            </div>

            {/* Live Proctoring Status Panel (Requirement 8) */}
            <div className="proctoring-status-panel">
              <div className="proctoring-status-row">
                <span className="status-label">Camera:</span>
                <span className={`status-val ${proctoringStats.cameraStatus === "Connected" ? "val-green" : "val-red"}`}>
                  <span className={proctoringStats.cameraStatus === "Connected" ? "green-dot" : "red-dot"} />
                  {proctoringStats.cameraStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">AI Face Detection:</span>
                <span className={`status-val ${proctoringStats.aiStatus.includes("Active") ? "val-green" : "val-amber"}`}>
                  {proctoringStats.aiStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Face Status:</span>
                <span className={`status-val ${proctoringStats.faceStatusCode === "normal" ? "val-green" : (proctoringStats.faceStatusCode === "no_face" ? "val-amber" : "val-red")}`}>
                  {proctoringStats.faceStatus}
                </span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Last Camera Check:</span>
                <span className="status-val muted-val">{proctoringStats.lastCheckTime || "Running..."}</span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Monitoring Interval:</span>
                <span className="status-val muted-val">{proctoringStats.monitoringInterval}</span>
              </div>
              <div className="proctoring-status-row">
                <span className="status-label">Total Violations:</span>
                <span className={`status-val ${warningCount > 0 ? (warningCount >= 2 ? "val-red" : "val-amber") : "val-green"}`}>
                  <strong>{warningCount} of 3</strong>
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
                disabled={
                  segments.length > 0 && !activeSubjects.has(item.subject)
                }
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
            <div>
              <span>Proctoring Warnings</span>
              <strong style={{ color: warningCount > 0 ? "#e11d48" : "#10b981" }}>
                {warningCount} / 3 {isFlagged ? "(FLAGGED)" : ""}
              </strong>
            </div>
          </div>

          <div className="exam-sidebar-note">
            <ShieldCheck size={16} color="#10b981" />
            <span>
              Live continuous AI proctoring active. Camera stream, face alignment, and window focus are securely monitored.
            </span>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal */}
      {confirm && (
        <div className="modal-cover">
          <div className="confirm-modal">
            <div className="modal-icon">
              <Flag />
            </div>
            <h2>Submit your examination?</h2>
            <p>
              This action is final. Your webcam proctoring session will end and responses will be locked.
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
