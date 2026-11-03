/**
 * MeritX Live Examination Proctoring Engine
 * Upgraded AI Computer Vision & Continuous Monitoring System
 *
 * Implements:
 * - Google MediaPipe FaceDetector in VIDEO running mode
 * - Continuous 3-second recursive camera and frame analysis
 * - Reliable Black Screen & Camera Hardware Interruption detection
 * - Incident State Machine: Each continuous incident counts once;
 *   resolves when normalized; subsequent incidents trigger next violation
 * - 10-second startup grace period to prevent initialization false strikes
 * - Real-time proctoring HUD stats reporting
 * - Automatic exam termination on 3 violations with answer sync
 */
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import { api } from "./api.js";

/**
 * Individual Incident Tracker for Violation State Machine
 */
class IncidentTracker {
  constructor({
    code,
    category,
    baseDescription,
    threshold,
    passThreshold = 1,
    onTrigger,
    onResolved,
  }) {
    this.code = code;
    this.category = category;
    this.baseDescription = baseDescription;
    this.threshold = threshold; // consecutive failures required to trigger
    this.passThreshold = passThreshold; // consecutive passes required to resolve
    this.isActive = false;
    this.consecutiveFailures = 0;
    this.consecutivePasses = 0;
    this.onTrigger = onTrigger;
    this.onResolved = onResolved;
  }

  recordFailure(metadata = {}) {
    this.consecutivePasses = 0;
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.threshold && !this.isActive) {
      this.isActive = true;
      if (this.onTrigger) {
        this.onTrigger({
          code: this.code,
          category: this.category,
          baseDescription: this.baseDescription,
          metadata: {
            ...metadata,
            consecutiveFailures: this.consecutiveFailures,
            threshold: this.threshold,
          },
        });
      }
    }
  }

  recordPass() {
    this.consecutiveFailures = 0;
    this.consecutivePasses++;

    if (this.consecutivePasses >= this.passThreshold && this.isActive) {
      this.isActive = false;
      if (this.onResolved) {
        this.onResolved(this.code);
      }
    }
  }

  reset() {
    this.isActive = false;
    this.consecutiveFailures = 0;
    this.consecutivePasses = 0;
  }
}

export class ProctoringEngine {
  constructor({
    token,
    examId,
    attemptId,
    onWarning,
    onStatusChange,
    onStatsUpdate,
    onTerminated,
    getAnswers,
  }) {
    this.token = token;
    this.examId = examId;
    this.attemptId = attemptId;
    this.onWarning = onWarning || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.onStatsUpdate = onStatsUpdate || (() => {});
    this.onTerminated = onTerminated || (() => {});
    this.getAnswers = getAnswers || (() => ({}));

    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.checkTimer = null;
    this.heartbeatTimer = null;
    this.faceDetector = null;

    this.warningCount = 0;
    this.maxWarnings = 3;
    this.isFlagged = false;
    this.isTerminated = false;
    this.isProcessingViolation = false;
    this.proctoringStatus = "active";
    this.violationHistory = [];
    this.wasFullscreen = false;

    this.aiModelStatus = "initializing"; // "initializing" | "active" | "fallback" | "failed"
    this.monitoringStartedAt = Date.now();
    this.startupGraceUntil = Date.now() + 10000; // 10-second startup grace period
    this.lastCheckTimestamp = null;
    this.isDestroyed = false;

    // Initialize incident state trackers for each violation type
    this.incidentTrackers = {
      BLACK_SCREEN: new IncidentTracker({
        code: "BLACK_SCREEN",
        category: "exam_rule_violation",
        baseDescription: "Black, obscured, or unusable camera feed detected",
        threshold: 2, // 2 checks = 6s
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      FACE_NOT_DETECTED: new IncidentTracker({
        code: "FACE_NOT_DETECTED",
        category: "face_not_visible",
        baseDescription: "Face not detected in camera frame",
        threshold: 3, // 3 checks = 9s
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      MULTIPLE_FACES: new IncidentTracker({
        code: "MULTIPLE_FACES",
        category: "multiple_faces_or_device",
        baseDescription: "Multiple faces detected in camera view",
        threshold: 2, // 2 checks = 6s
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      CAMERA_MUTED: new IncidentTracker({
        code: "CAMERA_MUTED",
        category: "exam_rule_violation",
        baseDescription: "Webcam video track muted or blocked",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      CAMERA_DISABLED: new IncidentTracker({
        code: "CAMERA_DISABLED",
        category: "exam_rule_violation",
        baseDescription: "Webcam video track was disabled",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      CAMERA_INTERRUPTED: new IncidentTracker({
        code: "CAMERA_INTERRUPTED",
        category: "exam_rule_violation",
        baseDescription: "Webcam video track ended or disconnected",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      CAMERA_UNAVAILABLE: new IncidentTracker({
        code: "CAMERA_UNAVAILABLE",
        category: "exam_rule_violation",
        baseDescription: "No active webcam stream available",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      TAB_SWITCH: new IncidentTracker({
        code: "TAB_SWITCH",
        category: "exam_rule_violation",
        baseDescription: "Switching browser tabs or minimizing the window",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      WINDOW_BLUR: new IncidentTracker({
        code: "WINDOW_BLUR",
        category: "exam_rule_violation",
        baseDescription: "Leaving or unfocusing the exam window",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
      FULLSCREEN_EXIT: new IncidentTracker({
        code: "FULLSCREEN_EXIT",
        category: "exam_rule_violation",
        baseDescription: "Exiting fullscreen mode",
        threshold: 1,
        passThreshold: 1,
        onTrigger: (data) => this.recordViolation(data),
        onResolved: (code) => this.handleIncidentResolved(code),
      }),
    };
  }

  setAttemptId(attemptId) {
    this.attemptId = attemptId;
  }

  /**
   * Run 9-point pre-examination verification checks
   */
  static async runPreflightChecks(videoElement) {
    const results = {
      cameraHardware: false,
      cameraPermission: false,
      videoPreview: false,
      faceVisible: false,
      internetStable: false,
      browserCompatible: false,
      fullscreenAvailable: false,
      instructionsAcknowledged: false,
      consentGiven: false,
      stream: null,
      errorMessage: null,
    };

    const hasMedia = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
    const hasFullscreen = !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled
    );
    results.browserCompatible = hasMedia && typeof window !== "undefined";
    results.fullscreenAvailable = hasFullscreen;
    results.internetStable = navigator.onLine;

    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInput = devices.some((d) => d.kind === "videoinput");
        results.cameraHardware = videoInput;
      } else {
        results.cameraHardware = hasMedia;
      }
    } catch {
      results.cameraHardware = hasMedia;
    }

    if (!results.cameraHardware) {
      results.errorMessage =
        "No webcam camera detected. Please plug in or enable a camera to proceed.";
      return results;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      results.cameraPermission = true;
      results.stream = stream;

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        await videoElement.play().catch(() => {});
        results.videoPreview = true;

        if (videoElement.readyState < 2) {
          await new Promise((resolve) => {
            const onLoaded = () => {
              videoElement.removeEventListener("loadeddata", onLoaded);
              resolve();
            };
            videoElement.addEventListener("loadeddata", onLoaded);
            setTimeout(resolve, 800);
          });
        }

        const faceCheck = await ProctoringEngine.detectFaceOptical(videoElement);
        results.faceVisible = faceCheck.count >= 1 || faceCheck.status === "normal";
      }
    } catch (err) {
      results.cameraPermission = false;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        results.errorMessage =
          "Camera access permission was denied. Please allow camera permissions in your browser address bar.";
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        results.errorMessage =
          "No webcam camera detected. Please plug in or enable a camera to proceed.";
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        results.errorMessage =
          "Webcam is currently in use by another application or tab. Please close other camera apps and retry.";
      } else {
        results.errorMessage = `Webcam initialization error: ${err.message}`;
      }
    }

    return results;
  }

  /**
   * Initialize Google MediaPipe FaceDetector in VIDEO mode
   */
  async initMediaPipe() {
    this.aiModelStatus = "initializing";
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      try {
        this.faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        this.aiModelStatus = "active";
      } catch (gpuErr) {
        console.warn("MediaPipe GPU delegate failed, retrying CPU delegate:", gpuErr);
        this.faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        this.aiModelStatus = "active";
      }
    } catch (err) {
      console.warn(
        "MediaPipe Tasks Vision unavailable. Activating Optical Face Vision fallback:",
        err
      );
      this.faceDetector = null;
      this.aiModelStatus = "fallback";
    }
  }

  /**
   * Optical / Chrominance Fallback Face and Presence Detection
   */
  static detectFaceOptical(videoElement, canvasElement = null) {
    if (!videoElement || videoElement.readyState < 2) {
      return { count: 0, confidence: 0, status: "unusable" };
    }

    const canvas = canvasElement || document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { count: 1, confidence: 0.8, status: "normal" };

    try {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let skinPixels = 0;
      let centerSkinPixels = 0;
      let leftQuadrantSkin = 0;
      let rightQuadrantSkin = 0;
      let centerLumSum = 0;
      let centerLumSqSum = 0;
      let centerSampleCount = 0;
      const totalPixels = canvas.width * canvas.height;

      const minX = Math.floor(canvas.width * 0.15);
      const maxX = Math.floor(canvas.width * 0.85);
      const minY = Math.floor(canvas.height * 0.10);
      const maxY = Math.floor(canvas.height * 0.90);

      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cbVal = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const crVal = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          const isSkinYCbCr = cbVal >= 75 && cbVal <= 138 && crVal >= 128 && crVal <= 180;
          const rgbSum = r + g + b;
          const normR = rgbSum > 0 ? r / rgbSum : 0;
          const normG = rgbSum > 0 ? g / rgbSum : 0;
          const isSkinNormRGB = normR > 0.32 && normR < 0.62 && normG > 0.23 && normG < 0.45 && r > g;
          const isSkinRGB = r > 50 && g > 30 && b > 15 && (r > b || Math.abs(r - b) < 20) && (r - g > -15);
          const isSkin = isSkinYCbCr || isSkinNormRGB || isSkinRGB;

          if (isSkin) {
            skinPixels += 4;
            if (x < canvas.width * 0.38) leftQuadrantSkin += 4;
            if (x > canvas.width * 0.62) rightQuadrantSkin += 4;
          }

          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            centerSampleCount++;
            centerLumSum += yVal;
            centerLumSqSum += yVal * yVal;
            if (isSkin) centerSkinPixels += 4;
          }
        }
      }

      const skinRatio = skinPixels / totalPixels;
      const centerTotalPixels = (maxX - minX) * (maxY - minY);
      const centerSkinRatio = centerSkinPixels / (centerTotalPixels || 1);

      const centerMean = centerLumSum / (centerSampleCount || 1);
      const centerVariance = Math.max(0, (centerLumSqSum / (centerSampleCount || 1)) - (centerMean * centerMean));
      const centerStdDev = Math.sqrt(centerVariance);

      const isPitchDark = centerMean < 10;
      const isBlindedByGlare = centerMean > 248 && centerStdDev < 6;
      const isCoveredLens = centerStdDev < 5 && (centerMean < 30 || centerMean > 220);

      if (isPitchDark || isBlindedByGlare || isCoveredLens) {
        return { count: 0, confidence: 0.1, status: "no_face" };
      }

      const hasSkinPresence = centerSkinRatio >= 0.02 || skinRatio >= 0.03;
      const hasHeadAndTorsoContours =
        centerStdDev >= 12 &&
        centerMean >= 25 &&
        centerMean <= 235 &&
        (centerSkinRatio >= 0.01 || skinRatio >= 0.015);

      if (!hasSkinPresence && !hasHeadAndTorsoContours) {
        return { count: 0, confidence: 0.2, status: "no_face" };
      }

      const leftQuadRatio = leftQuadrantSkin / totalPixels;
      const rightQuadRatio = rightQuadrantSkin / totalPixels;
      if (leftQuadRatio > 0.14 && rightQuadRatio > 0.14 && centerSkinRatio < 0.05) {
        return { count: 2, confidence: 0.85, status: "multiple_faces" };
      }

      return { count: 1, confidence: 0.92, status: "normal" };
    } catch {
      return { count: 1, confidence: 0.7, status: "normal" };
    }
  }

  /**
   * Detect faces using MediaPipe VIDEO mode or optical fallback
   */
  detectFaces(videoElement) {
    if (
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0
    ) {
      return { count: 0, status: "unusable", confidence: 0 };
    }

    if (this.faceDetector && this.aiModelStatus === "active") {
      try {
        const result = this.faceDetector.detectForVideo(
          videoElement,
          performance.now()
        );
        const count = result.detections ? result.detections.length : 0;
        const confidence =
          count > 0 && result.detections[0]?.categories?.[0]
            ? result.detections[0].categories[0].score
            : count > 0
              ? 0.95
              : 0;

        return {
          count,
          confidence,
          status:
            count === 0 ? "no_face" : count === 1 ? "normal" : "multiple_faces",
        };
      } catch (err) {
        console.warn("MediaPipe detectForVideo error, using optical analyzer:", err);
      }
    }

    // Optical fallback analyzer
    return ProctoringEngine.detectFaceOptical(videoElement, this.canvasElement);
  }

  /**
   * Separate and reliable Black Screen & Frame Usability Analyzer
   */
  analyzeVideoFrameQuality(videoElement) {
    if (
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0
    ) {
      return {
        isBlackScreen: false,
        isUnusable: true,
        meanLuminance: 0,
        stdDev: 0,
        reason: "VIDEO_NOT_READY",
      };
    }

    const canvas = this.canvasElement || document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { isBlackScreen: false, isUnusable: false, meanLuminance: 128, stdDev: 50 };
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let lumSum = 0;
    let lumSqSum = 0;
    const sampleCount = (canvas.width * canvas.height) / 4; // Step 2x2

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        lumSum += yVal;
        lumSqSum += yVal * yVal;
      }
    }

    const meanLuminance = lumSum / (sampleCount || 1);
    const variance = Math.max(
      0,
      lumSqSum / (sampleCount || 1) - meanLuminance * meanLuminance
    );
    const stdDev = Math.sqrt(variance);

    // Reliable Black Screen Classification:
    // 1. Pitch dark (covered camera, lens blocked, tape, black cloth) -> meanLuminance < 8
    // 2. Solid uniform surface with almost zero spatial texture -> stdDev < 3.2 and (meanLuminance < 25 || meanLuminance > 235)
    // Dark room with face and monitor has meanLuminance > 15 and stdDev > 8, so it is NOT flagged.
    const isBlackScreen =
      meanLuminance < 8 ||
      (stdDev < 3.2 && (meanLuminance < 25 || meanLuminance > 235));

    return {
      isBlackScreen,
      isUnusable: isBlackScreen,
      meanLuminance: Math.round(meanLuminance * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
    };
  }

  /**
   * Bind an active video element dynamically when it mounts in the DOM
   */
  attachVideoElement(videoElement) {
    if (!videoElement) return;
    this.videoElement = videoElement;
    if (this.stream) {
      try {
        if (this.videoElement.srcObject !== this.stream) {
          this.videoElement.srcObject = this.stream;
        }
        this.videoElement.muted = true;
        this.videoElement.play().catch(() => {});
      } catch (err) {
        console.warn("Failed to attach video element:", err);
      }
    }
  }

  /**
   * Start live proctoring monitoring session with continuous 3-second checks
   */
  async startMonitoring(videoElement = null, existingStream = null) {
    this.monitoringStartedAt = Date.now();
    this.startupGraceUntil = Date.now() + 10000; // 10-second startup grace period

    if (existingStream) {
      this.stream = existingStream;
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
    }

    if (videoElement) {
      this.attachVideoElement(videoElement);
    }

    this.canvasElement = document.createElement("canvas");

    // Initialize backend proctoring session if attemptId is present
    if (this.attemptId && this.token) {
      try {
        await api("/proctoring/session/init", {
          method: "POST",
          token: this.token,
          body: {
            attemptId: this.attemptId,
            examId: this.examId,
            browserData: {
              userAgent: navigator.userAgent,
              screenResolution: `${window.screen.width}x${window.screen.height}`,
            },
          },
        });
      } catch (err) {
        console.error("Failed to init proctoring session on backend:", err);
      }
    }

    // Initialize Google MediaPipe AI Model
    await this.initMediaPipe();

    // Setup hardware track and browser event listeners
    this.setupTrackListeners();
    this.setupWindowListeners();

    // Start recursive 3-second monitoring loop
    this.scheduleNextCheck(1000);

    // Start server heartbeat timer (every 12s)
    this.startHeartbeatLoop();
  }

  setupTrackListeners() {
    const videoTrack = this.stream?.getVideoTracks()[0];
    if (!videoTrack) return;

    this.handleTrackEnded = () => {
      if (!this.isDestroyed && !this.isTerminated) {
        this.incidentTrackers.CAMERA_INTERRUPTED.recordFailure();
      }
    };
    videoTrack.addEventListener("ended", this.handleTrackEnded);

    this.handleTrackMute = () => {
      if (!this.isDestroyed && !this.isTerminated) {
        this.incidentTrackers.CAMERA_MUTED.recordFailure();
      }
    };
    videoTrack.addEventListener("mute", this.handleTrackMute);

    this.handleTrackUnmute = () => {
      if (!this.isDestroyed && !this.isTerminated) {
        this.incidentTrackers.CAMERA_MUTED.recordPass();
      }
    };
    videoTrack.addEventListener("unmute", this.handleTrackUnmute);
  }

  setupWindowListeners() {
    this.wasFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    this.handleVisibilityChange = () => {
      if (this.isDestroyed || this.isTerminated) return;
      if (document.hidden) {
        this.incidentTrackers.TAB_SWITCH.recordFailure({
          code: "tab_switch",
          hidden: true,
        });
      } else {
        this.incidentTrackers.TAB_SWITCH.recordPass();
      }
    };
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    this.handleWindowBlur = () => {
      if (this.isDestroyed || this.isTerminated) return;
      if (!document.hidden) {
        this.incidentTrackers.WINDOW_BLUR.recordFailure({
          code: "window_blur",
          blurred: true,
        });
      }
    };
    window.addEventListener("blur", this.handleWindowBlur);

    this.handleWindowFocus = () => {
      if (this.isDestroyed || this.isTerminated) return;
      this.incidentTrackers.WINDOW_BLUR.recordPass();
    };
    window.addEventListener("focus", this.handleWindowFocus);

    this.handleFullscreenChange = () => {
      if (this.isDestroyed || this.isTerminated) return;
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      if (isFs) {
        this.wasFullscreen = true;
        this.incidentTrackers.FULLSCREEN_EXIT.recordPass();
      } else if (this.wasFullscreen) {
        this.wasFullscreen = false;
        this.incidentTrackers.FULLSCREEN_EXIT.recordFailure({
          code: "fullscreen_exit",
        });
      }
    };
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", this.handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", this.handleFullscreenChange);
  }

  /**
   * Schedule the next 3-second camera and face check recursively
   */
  scheduleNextCheck(delayMs = 3000) {
    if (this.isDestroyed || this.isTerminated) return;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    this.checkTimer = setTimeout(async () => {
      if (this.isDestroyed || this.isTerminated) return;
      try {
        await this.runCameraAndFaceCheck();
      } catch (err) {
        console.error("Proctoring 3-second check error:", err);
      } finally {
        if (!this.isDestroyed && !this.isTerminated) {
          this.scheduleNextCheck(3000);
        }
      }
    }, delayMs);
  }

  /**
   * Continuous Camera & Face Check executed every 3 seconds
   * Evaluates all 8 independent requirements.
   */
  async runCameraAndFaceCheck() {
    if (this.isDestroyed || this.isTerminated) return;

    this.lastCheckTimestamp = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const isStartupGrace = Date.now() < this.startupGraceUntil;

    // 1. Is camera stream available?
    if (!this.stream) {
      this.incidentTrackers.CAMERA_UNAVAILABLE.recordFailure();
      this.updateLiveStats({
        cameraStatus: "Disconnected",
        faceStatus: "Camera stream unavailable. Please reconnect your webcam.",
        faceStatusCode: "camera_unavailable",
        faceCount: 0,
      });
      return;
    }
    this.incidentTrackers.CAMERA_UNAVAILABLE.recordPass();

    // 2. Is video track live?
    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState === "ended") {
      this.incidentTrackers.CAMERA_INTERRUPTED.recordFailure();
      this.updateLiveStats({
        cameraStatus: "Disconnected",
        faceStatus: "Webcam video track ended or interrupted.",
        faceStatusCode: "camera_interrupted",
        faceCount: 0,
      });
      return;
    }
    this.incidentTrackers.CAMERA_INTERRUPTED.recordPass();

    // 3. Is video track muted?
    if (videoTrack.muted) {
      this.incidentTrackers.CAMERA_MUTED.recordFailure();
      this.updateLiveStats({
        cameraStatus: "Disconnected",
        faceStatus: "Webcam video is muted or blocked by the operating system.",
        faceStatusCode: "camera_muted",
        faceCount: 0,
      });
      return;
    }
    this.incidentTrackers.CAMERA_MUTED.recordPass();

    // 4. Is video track enabled?
    if (!videoTrack.enabled) {
      this.incidentTrackers.CAMERA_DISABLED.recordFailure();
      this.updateLiveStats({
        cameraStatus: "Disconnected",
        faceStatus: "Webcam video track is disabled.",
        faceStatusCode: "camera_disabled",
        faceCount: 0,
      });
      return;
    }
    this.incidentTrackers.CAMERA_DISABLED.recordPass();

    // 5. Is video element receiving frames?
    if (
      !this.videoElement ||
      this.videoElement.readyState < 2 ||
      this.videoElement.videoWidth === 0
    ) {
      this.updateLiveStats({
        cameraStatus: "Connected",
        faceStatus: isStartupGrace
          ? "Camera initializing frames..."
          : "Waiting for camera video frames...",
        faceStatusCode: "initializing",
        faceCount: 0,
      });
      return;
    }

    // 6. Is frame black, obstructed, or unusable?
    const frameQuality = this.analyzeVideoFrameQuality(this.videoElement);
    if (frameQuality.isBlackScreen) {
      this.incidentTrackers.BLACK_SCREEN.recordFailure(frameQuality);
      // Suppress face absence counting while black screen is active (black screen is root cause)
      this.incidentTrackers.FACE_NOT_DETECTED.recordPass();
      this.incidentTrackers.MULTIPLE_FACES.recordPass();

      this.updateLiveStats({
        cameraStatus: "Connected",
        faceStatus: "Black screen detected. Please uncover your camera lens.",
        faceStatusCode: "black_screen",
        faceCount: 0,
        frameQuality,
      });
      return;
    }
    // Normal usable frame - resolve black screen incident
    this.incidentTrackers.BLACK_SCREEN.recordPass();

    // 7 & 8. Face detection check (0 faces, 1 face, multiple faces)
    const faceResult = this.detectFaces(this.videoElement);

    if (faceResult.count === 0) {
      this.incidentTrackers.FACE_NOT_DETECTED.recordFailure(faceResult);
      this.incidentTrackers.MULTIPLE_FACES.recordPass();

      this.updateLiveStats({
        cameraStatus: "Connected",
        faceStatus: "Face not detected. Please look at the camera.",
        faceStatusCode: "no_face",
        faceCount: 0,
        frameQuality,
      });
    } else if (faceResult.count === 1) {
      this.incidentTrackers.FACE_NOT_DETECTED.recordPass();
      this.incidentTrackers.MULTIPLE_FACES.recordPass();

      this.updateLiveStats({
        cameraStatus: "Connected",
        faceStatus: "Face detected. Monitoring active.",
        faceStatusCode: "normal",
        faceCount: 1,
        frameQuality,
      });
    } else {
      // Multiple faces detected
      this.incidentTrackers.MULTIPLE_FACES.recordFailure(faceResult);
      this.incidentTrackers.FACE_NOT_DETECTED.recordPass();

      this.updateLiveStats({
        cameraStatus: "Connected",
        faceStatus: "Multiple faces detected. Please ensure only one candidate is visible.",
        faceStatusCode: "multiple_faces",
        faceCount: faceResult.count,
        frameQuality,
      });
    }
  }

  /**
   * Handle when a violation condition is resolved by candidate
   */
  handleIncidentResolved(code) {
    // Notify UI that active warning can be cleared if matching
    this.onStatusChange({
      status: this.proctoringStatus,
      warningCount: this.warningCount,
      isFlagged: this.isFlagged,
      isTerminated: this.isTerminated,
      resolvedIncident: code,
    });
  }

  /**
   * Centralized Violation Recording Function (Violation State Machine)
   */
  async recordViolation({ code, baseDescription, category, metadata = {} }) {
    if (this.isDestroyed || this.isTerminated || this.isProcessingViolation) return;

    // Suppress violations during the 10-second startup grace period
    if (Date.now() < this.startupGraceUntil) {
      console.info(
        `[Proctoring] Violation '${code}' suppressed during 10s startup grace period.`
      );
      return;
    }

    this.isProcessingViolation = true;

    try {
      this.warningCount = Math.min(this.maxWarnings, this.warningCount + 1);
      const currentWarningNum = this.warningCount;

      let categoryType = category || "exam_rule_violation";
      if (code === "FACE_NOT_DETECTED" || code === "face_not_visible") {
        categoryType = "face_not_visible";
      } else if (code === "MULTIPLE_FACES" || code === "multiple_faces") {
        categoryType = "multiple_faces_or_device";
      }

      let formattedMessage = "";
      if (currentWarningNum === 1) {
        formattedMessage = `Warning 1/3: ${baseDescription}. Navigating away or rule infractions are prohibited.`;
      } else if (currentWarningNum === 2) {
        formattedMessage = `Warning 2/3 (FINAL WARNING): ${baseDescription}. One more violation will automatically terminate your examination.`;
      } else {
        formattedMessage = `Warning 3/3 (MAXIMUM VIOLATIONS REACHED): ${baseDescription}. Examination is automatically terminated.`;
      }

      const violationRecord = {
        warningNumber: currentWarningNum,
        code,
        category: categoryType,
        description: formattedMessage,
        rawDescription: baseDescription,
        timestamp: new Date().toISOString(),
        metadata: {
          code,
          warningNumber: currentWarningNum,
          timestamp: Date.now(),
          ...metadata,
        },
      };

      this.violationHistory.push(violationRecord);

      if (currentWarningNum >= this.maxWarnings) {
        this.isFlagged = true;
        this.isTerminated = true;
        this.proctoringStatus = "terminated";
      }

      const warningPayload = {
        warningCount: currentWarningNum,
        warningNumber: currentWarningNum,
        warningLevel: currentWarningNum,
        isFinalWarning: currentWarningNum === 2,
        isTerminated: currentWarningNum >= this.maxWarnings,
        code,
        message: formattedMessage,
        isFlagged: this.isFlagged,
        timestamp: violationRecord.timestamp,
        violationHistory: [...this.violationHistory],
      };

      // Notify UI warning & status listeners
      this.onWarning(warningPayload);
      this.onStatusChange({
        status: this.proctoringStatus,
        warningCount: currentWarningNum,
        isFlagged: this.isFlagged,
        isTerminated: this.isTerminated,
      });

      // 3rd VIOLATION: IMMEDIATE AUTOMATIC TERMINATION
      if (currentWarningNum >= this.maxWarnings) {
        const currentAnswers = this.getAnswers ? this.getAnswers() : {};

        this.onTerminated({
          violationRecord,
          violationHistory: [...this.violationHistory],
          answers: currentAnswers,
          attemptId: this.attemptId,
          formattedMessage,
          categoryType,
        });

        this.destroy();
        return;
      }

      // Sync warning 1 or 2 to backend
      if (this.attemptId && this.token) {
        try {
          await api("/proctoring/warning", {
            method: "POST",
            token: this.token,
            body: {
              attemptId: this.attemptId,
              category: categoryType,
              message: formattedMessage,
              evidenceMetadata: violationRecord.metadata,
            },
          });
        } catch (err) {
          console.error("Failed to record warning on backend:", err);
        }
      }
    } finally {
      this.isProcessingViolation = false;
    }
  }

  /**
   * Helper to dispatch real-time stats to UI
   */
  updateLiveStats(stats) {
    this.onStatsUpdate({
      cameraStatus: stats.cameraStatus || "Connected",
      aiStatus:
        this.aiModelStatus === "active"
          ? "Active (MediaPipe Vision)"
          : this.aiModelStatus === "fallback"
            ? "Active (Vision Fallback)"
            : "Initializing...",
      faceStatus: stats.faceStatus || "Checking...",
      faceStatusCode: stats.faceStatusCode || "normal",
      faceCount: stats.faceCount ?? 1,
      lastCheckTime: this.lastCheckTimestamp || "Running...",
      monitoringInterval: "3 Seconds",
      violationCount: this.warningCount,
      frameQuality: stats.frameQuality,
    });
  }

  startHeartbeatLoop() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.isDestroyed || this.isTerminated || !this.attemptId || !this.token)
        return;

      const videoTrack = this.stream?.getVideoTracks()[0];
      const cameraStatus =
        videoTrack && videoTrack.readyState === "live" ? "active" : "failed";
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      try {
        await api("/proctoring/heartbeat", {
          method: "POST",
          token: this.token,
          body: {
            attemptId: this.attemptId,
            status: this.isFlagged ? "flagged" : "active",
            cameraStatus,
            tabStatus: document.hidden ? "hidden" : "visible",
            fullScreenStatus: isFs,
            warningCount: this.warningCount,
            lastAnomalyCode: null,
          },
        });
      } catch {
        // Heartbeat failure shouldn't disrupt candidate
      }
    }, 12000);
  }

  /**
   * Cleanly stop camera, timer, and event listeners
   */
  destroy() {
    this.isDestroyed = true;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {
        // Stream stopped
      }
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.removeListeners();
  }

  removeListeners() {
    if (this.handleVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
    }
    if (this.handleWindowBlur) {
      window.removeEventListener("blur", this.handleWindowBlur);
    }
    if (this.handleWindowFocus) {
      window.removeEventListener("focus", this.handleWindowFocus);
    }
    if (this.handleFullscreenChange) {
      document.removeEventListener(
        "fullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        this.handleFullscreenChange
      );
    }
  }
}
