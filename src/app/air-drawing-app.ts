import {
  CameraController,
  type CameraState,
  type CameraStatus,
} from "../camera/camera-controller";
import {
  calculateCoverTransform,
  mapNormalizedPointToViewport,
  type CoverTransform,
} from "../camera/cover-mapping";
import { DrawingEngine } from "../drawing/drawing-engine";
import { GestureRecognizer } from "../gestures/gesture-recognizer";
import { HoldTimer } from "../gestures/hold-timer";
import { DiagnosticRenderer } from "../hand-tracking/diagnostic-renderer";
import {
  HandTracker,
  type TrackingStats,
} from "../hand-tracking/hand-tracker";
import {
  initialAppState,
  transitionAppState,
} from "../state/app-state-machine";
import { HoverTargetTracker } from "../ui/hover-target";
import type {
  AppEvent,
  AppState,
  BrushConfig,
  GestureSnapshot,
  HandObservation,
  Point2D,
} from "../types";

const colors = [
  { id: "white", label: "白色", value: "#ffffff" },
  { id: "red", label: "红色", value: "#ff3344" },
  { id: "blue", label: "蓝色", value: "#2563eb" },
  { id: "green", label: "绿色", value: "#19c95b" },
  { id: "yellow", label: "黄色", value: "#ffd12f" },
] as const;

const widths = [4, 8, 12, 18, 26] as const;
const openPalmDurationMs = 600;
const selectionHoverDurationMs = 800;
const clearArmDurationMs = 600;
const drawingLossGraceMs = 120;

export class AirDrawingApp {
  private readonly videoElement: HTMLVideoElement;
  private readonly drawingCanvas: HTMLCanvasElement;
  private readonly diagnosticCanvas: HTMLCanvasElement;
  private readonly cameraPanel: HTMLElement;
  private readonly cameraAction: HTMLButtonElement;
  private readonly cameraMessage: HTMLElement;
  private readonly statusPill: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly modeHint: HTMLElement;
  private readonly handSummary: HTMLElement;
  private readonly performanceSummary: HTMLElement;
  private readonly brushColor: HTMLElement;
  private readonly brushWidth: HTMLElement;
  private readonly configPanel: HTMLElement;
  private readonly clearButton: HTMLButtonElement;
  private readonly diagnosticButton: HTMLButtonElement;
  private readonly exitButton: HTMLButtonElement;
  private readonly openConfigButton: HTMLButtonElement;
  private readonly gesturePointer: HTMLElement;
  private readonly openPalmProgress: HTMLElement;

  private readonly cameraController: CameraController;
  private readonly handTracker: HandTracker;
  private readonly diagnosticRenderer: DiagnosticRenderer;
  private readonly drawingEngine: DrawingEngine;
  private readonly gestureRecognizer = new GestureRecognizer();
  private readonly openPalmTimer = new HoldTimer(openPalmDurationMs);
  private readonly selectionHover = new HoverTargetTracker(
    selectionHoverDurationMs,
  );
  private readonly clearHover = new HoverTargetTracker(clearArmDurationMs);

  private appState: AppState = { ...initialAppState };
  private brush: BrushConfig = { color: "#ffffff", width: 12 };
  private pendingBrush: BrushConfig = { ...this.brush };
  private coverTransform: CoverTransform | null = null;
  private lastObservation: HandObservation | null = null;
  private lastGesture: GestureSnapshot | null = null;
  private isDiagnosticsVisible = true;
  private isClearArmed = false;
  private isTrackingReady = false;
  private lastDrawingHandSeenAtMs: number | null = null;

  public constructor(private readonly rootElement: HTMLElement) {
    this.rootElement.innerHTML = createAppTemplate();
    this.videoElement = getRequiredElement("[data-camera-feed]");
    this.drawingCanvas = getRequiredElement("[data-drawing-layer]");
    this.diagnosticCanvas = getRequiredElement("[data-diagnostic-layer]");
    this.cameraPanel = getRequiredElement("[data-camera-panel]");
    this.cameraAction = getRequiredElement("[data-camera-action]");
    this.cameraMessage = getRequiredElement("[data-camera-message]");
    this.statusPill = getRequiredElement("[data-status-pill]");
    this.statusLabel = getRequiredElement("[data-status-label]");
    this.modeHint = getRequiredElement("[data-mode-hint]");
    this.handSummary = getRequiredElement("[data-hand-summary]");
    this.performanceSummary = getRequiredElement("[data-performance-summary]");
    this.brushColor = getRequiredElement("[data-brush-color-label]");
    this.brushWidth = getRequiredElement("[data-brush-width-label]");
    this.configPanel = getRequiredElement("[data-config-panel]");
    this.clearButton = getRequiredElement("[data-clear-action]");
    this.diagnosticButton = getRequiredElement("[data-diagnostic-action]");
    this.exitButton = getRequiredElement("[data-exit-action]");
    this.openConfigButton = getRequiredElement("[data-open-config]");
    this.gesturePointer = getRequiredElement("[data-gesture-pointer]");
    this.openPalmProgress = getRequiredElement("[data-open-palm-progress]");

    this.drawingEngine = new DrawingEngine(this.drawingCanvas);
    this.diagnosticRenderer = new DiagnosticRenderer(this.diagnosticCanvas);
    this.cameraController = new CameraController(
      this.videoElement,
      this.handleCameraState,
    );
    this.handTracker = new HandTracker(this.videoElement, {
      onObservation: this.handleObservation,
      onStats: this.handleTrackingStats,
      onError: this.handleTrackingError,
    });

    this.bindEvents();
    this.renderBrush();
    this.updateCoordinateSpace();
    this.renderAppState();
    document.body.dataset.cameraStatus = "idle";
  }

  private bindEvents(): void {
    this.cameraAction.addEventListener("click", () => {
      void this.cameraController.start();
    });
    this.videoElement.addEventListener("loadedmetadata", this.updateCoordinateSpace);
    window.addEventListener("resize", this.updateCoordinateSpace);
    window.addEventListener("pagehide", this.destroy);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    this.configPanel.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        "[data-gesture-target]",
      );
      if (target) this.activateConfigTarget(target.dataset.gestureTarget ?? "");
    });
    this.clearButton.addEventListener("click", this.clearCanvas);
    this.diagnosticButton.addEventListener("click", this.toggleDiagnostics);
    this.exitButton.addEventListener("click", this.exitDrawingSession);
    this.openConfigButton.addEventListener("click", () => {
      if (this.appState.mode === "idle") {
        this.dispatch({ type: "OPEN_PALM_READY" });
      }
    });
  }

  private readonly handleCameraState = (state: CameraState): void => {
    document.body.dataset.cameraStatus = state.status;
    this.statusPill.dataset.status = state.status;
    this.cameraMessage.textContent = state.message;
    this.cameraAction.textContent = getCameraActionLabel(state.status);
    this.cameraAction.disabled = state.status === "requesting";

    const isActive = state.status === "active";
    this.cameraPanel.hidden = isActive;
    this.exitButton.hidden = !isActive;
    this.videoElement.classList.toggle("camera-feed--active", isActive);

    if (isActive) {
      this.statusLabel.textContent = "正在加载手部识别";
      void this.startHandTracking();
    } else {
      this.handTracker.stop();
      this.isTrackingReady = false;
      this.lastObservation = null;
      this.gestureRecognizer.reset();
      this.cancelCurrentInteraction();
      this.handSummary.textContent = getCameraSummary(state.status);
      this.performanceSummary.textContent = "等待识别";
      this.statusLabel.textContent = getCameraStatusLabel(state.status);
      this.modeHint.textContent = state.message;
    }
  };

  private async startHandTracking(): Promise<void> {
    try {
      await this.handTracker.initialize();
      this.isTrackingReady = true;
      this.statusLabel.textContent = "空闲";
      this.modeHint.textContent = "张开手掌配置，或捏合开始绘制";
      this.handTracker.start();
    } catch {
      this.handleTrackingError("手部识别模型加载失败，请刷新页面重试。");
    }
  }

  private readonly handleObservation = (
    observation: HandObservation | null,
  ): void => {
    this.lastObservation = observation;
    const gesture = this.gestureRecognizer.analyze(observation);
    this.lastGesture = gesture;
    const pointer = this.mapPoint(gesture.pointer);
    const drawingPoint = this.mapPoint(gesture.pointer);

    this.handSummary.textContent = observation
      ? `${observation.handedness === "Left" ? "左手" : observation.handedness === "Right" ? "右手" : "手部"} · 已识别`
      : "未识别到手";

    this.renderPointer(pointer, gesture);
    this.diagnosticRenderer.render(observation, this.coverTransform, pointer);
    this.processGesture(gesture, pointer, drawingPoint);
  };

  private processGesture(
    gesture: GestureSnapshot,
    pointer: Point2D | null,
    drawingPoint: Point2D | null,
  ): void {
    const nowMs = performance.now();

    if (this.appState.mode === "idle") {
      this.processIdleGesture(gesture, pointer, drawingPoint, nowMs);
    } else if (this.appState.mode === "configuring") {
      this.processConfigGesture(gesture, pointer, nowMs);
    } else {
      this.processDrawingGesture(gesture, drawingPoint, nowMs);
    }
  }

  private processIdleGesture(
    gesture: GestureSnapshot,
    pointer: Point2D | null,
    drawingPoint: Point2D | null,
    nowMs: number,
  ): void {
    if (
      this.isClearArmed &&
      gesture.pinchStarted &&
      pointer &&
      isPointInsideElement(pointer, this.clearButton)
    ) {
      this.clearCanvas();
      return;
    }

    const clearResult = this.clearHover.update(
      gesture.isIndexPointing ? pointer : null,
      "[data-clear-action]",
      nowMs,
    );
    this.isClearArmed = clearResult.completed;
    this.renderHoverProgress(clearResult.target, clearResult.progress);
    this.clearButton.classList.toggle("is-armed", this.isClearArmed);

    const openPalmProgress = this.openPalmTimer.update(
      gesture.isOpenPalm,
      nowMs,
    );
    this.renderOpenPalmProgress(openPalmProgress);

    if (openPalmProgress >= 1) {
      this.dispatch({ type: "OPEN_PALM_READY" });
      return;
    }

    if (
      gesture.pinchEnded &&
      this.appState.requiresPinchRelease
    ) {
      this.dispatch({ type: "PINCH_ENDED" });
      return;
    }

    if (
      gesture.pinchStarted &&
      drawingPoint &&
      !this.appState.requiresPinchRelease
    ) {
      this.dispatch({ type: "PINCH_STARTED" });
      this.lastDrawingHandSeenAtMs = nowMs;
      this.drawingEngine.beginStroke(drawingPoint, this.brush, nowMs);
    }
  }

  private processConfigGesture(
    gesture: GestureSnapshot,
    pointer: Point2D | null,
    nowMs: number,
  ): void {
    const hover = this.selectionHover.update(
      gesture.isIndexPointing ? pointer : null,
      "[data-config-panel] [data-gesture-target]",
      nowMs,
    );
    this.renderHoverProgress(hover.target, hover.progress);

    if (hover.completed && hover.targetId) {
      this.activateConfigTarget(hover.targetId);
      this.selectionHover.reset();
      return;
    }

    if (gesture.pinchStarted && pointer) {
      const target = document
        .elementsFromPoint(pointer.x, pointer.y)
        .find(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            element.matches(
              "[data-config-panel] [data-gesture-target]:not([data-gesture-target='complete'])",
            ),
        );
      if (target) this.activateConfigTarget(target.dataset.gestureTarget ?? "");
    }
  }

  private processDrawingGesture(
    gesture: GestureSnapshot,
    drawingPoint: Point2D | null,
    nowMs: number,
  ): void {
    if (gesture.hasHand) {
      this.lastDrawingHandSeenAtMs = nowMs;
    }

    if (gesture.isPinching && drawingPoint) {
      this.drawingEngine.appendPoint(drawingPoint, nowMs);
    }

    const handLossExceededGrace =
      !gesture.hasHand &&
      this.lastDrawingHandSeenAtMs !== null &&
      nowMs - this.lastDrawingHandSeenAtMs > drawingLossGraceMs;

    if (gesture.pinchEnded || handLossExceededGrace) {
      this.drawingEngine.endStroke();
      this.lastDrawingHandSeenAtMs = null;
      this.dispatch({ type: "PINCH_ENDED" });
    }
  }

  private activateConfigTarget(targetId: string): void {
    if (targetId.startsWith("color:")) {
      const color = colors.find((item) => item.id === targetId.slice(6));
      if (color) this.pendingBrush.color = color.value;
    } else if (targetId.startsWith("width:")) {
      const width = Number(targetId.slice(6));
      if (widths.includes(width as (typeof widths)[number])) {
        this.pendingBrush.width = width;
      }
    } else if (targetId === "complete") {
      this.brush = { ...this.pendingBrush };
      this.renderBrush();
      this.dispatch({ type: "CONFIG_COMPLETED" });
      if (!this.lastGesture?.isPinching) {
        this.dispatch({ type: "PINCH_ENDED" });
      }
      return;
    }

    this.renderConfigSelection();
  }

  private dispatch(event: AppEvent): void {
    const previousMode = this.appState.mode;
    this.appState = transitionAppState(this.appState, event);

    if (previousMode !== this.appState.mode) {
      if (this.appState.mode === "configuring") {
        this.pendingBrush = { ...this.brush };
        this.openPalmTimer.reset();
        this.clearHover.reset();
      } else {
        this.selectionHover.reset();
      }
      this.renderAppState();
    }
  }

  private renderAppState(): void {
    document.body.dataset.appMode = this.appState.mode;
    this.configPanel.hidden = this.appState.mode !== "configuring";
    this.clearButton.disabled = this.appState.mode !== "idle";
    this.openConfigButton.disabled = this.appState.mode !== "idle";

    const labels = {
      idle: "空闲",
      configuring: "正在配置画笔",
      drawing: "正在绘制",
    };
    const hints = {
      idle: "张开手掌配置，或捏合开始绘制",
      configuring: "伸出食指选择，悬停或捏合确认",
      drawing: "保持捏合绘制，松开完成这一笔",
    };
    this.statusLabel.textContent = labels[this.appState.mode];
    this.modeHint.textContent = hints[this.appState.mode];

    if (this.appState.mode === "configuring") {
      this.renderConfigSelection();
    }
  }

  private renderBrush(): void {
    this.brushColor.textContent =
      colors.find((color) => color.value === this.brush.color)?.label ?? "自定义";
    this.brushWidth.textContent = `${this.brush.width}px`;
    getRequiredElement<HTMLElement>("[data-brush-color-sample]").style.setProperty(
      "--brush-color",
      this.brush.color,
    );
    getRequiredElement<HTMLElement>("[data-brush-width-sample]").style.setProperty(
      "--brush-width",
      `${this.brush.width}px`,
    );
  }

  private renderConfigSelection(): void {
    for (const element of this.configPanel.querySelectorAll<HTMLElement>(
      "[data-color-value]",
    )) {
      element.classList.toggle(
        "is-selected",
        element.dataset.colorValue === this.pendingBrush.color,
      );
    }
    for (const element of this.configPanel.querySelectorAll<HTMLElement>(
      "[data-width-value]",
    )) {
      element.classList.toggle(
        "is-selected",
        Number(element.dataset.widthValue) === this.pendingBrush.width,
      );
    }
  }

  private renderPointer(
    pointer: Point2D | null,
    gesture: GestureSnapshot,
  ): void {
    if (!pointer || !gesture.hasHand) {
      this.gesturePointer.hidden = true;
      return;
    }

    this.gesturePointer.hidden = false;
    this.gesturePointer.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
    this.gesturePointer.classList.toggle("is-pinching", gesture.isPinching);
  }

  private renderOpenPalmProgress(progress: number): void {
    this.openPalmProgress.hidden = progress <= 0 || progress >= 1;
    this.openPalmProgress.style.setProperty(
      "--gesture-progress",
      `${progress * 100}%`,
    );
  }

  private renderHoverProgress(
    target: HTMLElement | null,
    progress: number,
  ): void {
    for (const active of document.querySelectorAll<HTMLElement>(
      ".has-gesture-hover",
    )) {
      if (active !== target) {
        active.classList.remove("has-gesture-hover");
        active.style.removeProperty("--hover-progress");
      }
    }

    if (target) {
      target.classList.add("has-gesture-hover");
      target.style.setProperty("--hover-progress", `${progress * 100}%`);
    }
  }

  private readonly handleTrackingStats = (stats: TrackingStats): void => {
    this.performanceSummary.textContent = `${stats.framesPerSecond} FPS · ${stats.inferenceMs.toFixed(0)}ms`;
  };

  private readonly handleTrackingError = (message: string): void => {
    this.statusPill.dataset.status = "error";
    this.statusLabel.textContent = "手部识别不可用";
    this.modeHint.textContent = message;
    this.performanceSummary.textContent = "识别已停止";
  };

  private readonly updateCoordinateSpace = (): void => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const pixelRatio = window.devicePixelRatio || 1;

    for (const canvas of [this.drawingCanvas, this.diagnosticCanvas]) {
      canvas.width = Math.round(viewport.width * pixelRatio);
      canvas.height = Math.round(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
    }

    this.coverTransform = calculateCoverTransform(
      {
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight,
      },
      viewport,
    );
    this.drawingEngine?.resize();

    const pointer = this.mapPoint(this.lastGesture?.pointer ?? null);
    this.diagnosticRenderer?.render(
      this.lastObservation,
      this.coverTransform,
      pointer,
    );
  };

  private mapPoint(point: Point2D | null): Point2D | null {
    if (!point || !this.coverTransform) return null;
    return mapNormalizedPointToViewport(point, this.coverTransform, true);
  }

  private readonly clearCanvas = (): void => {
    if (this.appState.mode !== "idle") {
      return;
    }

    this.drawingEngine.clear();
    this.clearButton.classList.add("is-cleared");
    window.setTimeout(() => this.clearButton.classList.remove("is-cleared"), 500);
    this.isClearArmed = false;
    this.clearHover.reset();
  };

  private readonly toggleDiagnostics = (): void => {
    this.isDiagnosticsVisible = !this.isDiagnosticsVisible;
    this.diagnosticRenderer.setVisible(this.isDiagnosticsVisible);
    this.diagnosticButton.setAttribute(
      "aria-pressed",
      String(this.isDiagnosticsVisible),
    );
    this.diagnosticButton.textContent = this.isDiagnosticsVisible
      ? "隐藏关键点"
      : "显示关键点";
  };

  private readonly exitDrawingSession = (): void => {
    this.drawingEngine.clear();
    this.diagnosticRenderer.clear();
    this.gesturePointer.hidden = true;
    this.openPalmProgress.hidden = true;
    this.lastObservation = null;
    this.lastGesture = null;
    this.isClearArmed = false;
    this.handTracker.stop();
    this.cameraController.stop();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.cancelCurrentInteraction();
      this.handTracker.stop();
    } else if (this.isTrackingReady) {
      this.handTracker.start();
    }
  };

  private cancelCurrentInteraction(): void {
    this.drawingEngine.endStroke();
    this.lastDrawingHandSeenAtMs = null;
    this.appState = transitionAppState(this.appState, { type: "CANCEL" });
    this.openPalmTimer.reset();
    this.selectionHover.reset();
    this.clearHover.reset();
    this.renderAppState();
  }

  private readonly destroy = (): void => {
    this.handTracker.close();
    this.cameraController.stop(false);
  };
}

function createAppTemplate(): string {
  return `
    <main class="app-shell" aria-labelledby="app-title">
      <video class="camera-feed" data-camera-feed autoplay muted playsinline aria-label="镜像摄像头画面"></video>
      <div class="camera-veil" aria-hidden="true"></div>
      <canvas class="drawing-layer" data-drawing-layer aria-label="绘图区"></canvas>
      <canvas class="diagnostic-layer" data-diagnostic-layer aria-hidden="true"></canvas>
      <div class="gesture-pointer" data-gesture-pointer hidden aria-hidden="true"></div>
      <div class="open-palm-progress" data-open-palm-progress hidden aria-hidden="true"></div>

      <header class="status-pill" data-status-pill aria-live="polite">
        <span class="status-pill__dot" aria-hidden="true"></span>
        <span data-status-label>等待连接摄像头</span>
      </header>

      <p class="mode-hint" data-mode-hint>启用摄像头开始创作</p>

      <section class="welcome-panel" data-camera-panel>
        <p class="welcome-panel__eyebrow">AIR DRAWING CANVAS</p>
        <h1 id="app-title">隔空手写画板</h1>
        <p class="welcome-panel__description" data-camera-message>
          摄像头画面和手部关键点只在当前浏览器处理，不会上传或保存。
        </p>
        <button class="primary-action" type="button" data-camera-action>启用摄像头</button>
      </section>

      <section class="brush-config" data-config-panel hidden aria-label="配置画笔">
        <h2>配置画笔</h2>
        <div class="brush-config__row">
          <span class="brush-config__label">颜色</span>
          <div class="color-options">${colors.map(createColorOption).join("")}</div>
          <span class="brush-config__divider" aria-hidden="true"></span>
          <span class="brush-config__label">粗细</span>
          <div class="width-options">${widths.map(createWidthOption).join("")}</div>
        </div>
        <button class="complete-action gesture-target" type="button" data-gesture-target="complete">完成</button>
      </section>

      <footer class="stage-dock" aria-label="画板工具">
        <button class="brush-preview dock-button" type="button" data-open-config title="配置画笔">
          <span class="brush-preview__sample" data-brush-color-sample></span>
          <span class="dock-copy"><small>画笔</small><strong data-brush-color-label>白色</strong></span>
        </button>
        <span class="stage-dock__divider" aria-hidden="true"></span>
        <div class="width-preview">
          <span class="width-preview__sample" data-brush-width-sample aria-hidden="true"></span>
          <span class="dock-copy"><small>粗细</small><strong data-brush-width-label>12px</strong></span>
        </div>
        <span class="stage-dock__divider" aria-hidden="true"></span>
        <div class="dock-copy dock-copy--status">
          <small>手部状态</small><strong data-hand-summary>尚未连接</strong>
        </div>
        <div class="dock-copy dock-copy--status">
          <small>识别性能</small><strong data-performance-summary>等待识别</strong>
        </div>
        <span class="stage-dock__spacer"></span>
        <button class="dock-action" type="button" data-exit-action hidden>退出</button>
        <button class="dock-action" type="button" data-diagnostic-action aria-pressed="true">隐藏关键点</button>
        <button class="dock-action dock-action--danger gesture-target" type="button" data-clear-action data-gesture-target="clear">清除</button>
      </footer>
    </main>
  `;
}

function createColorOption(color: (typeof colors)[number]): string {
  return `<button class="color-option gesture-target" type="button" title="${color.label}" aria-label="${color.label}" data-gesture-target="color:${color.id}" data-color-value="${color.value}" style="--option-color:${color.value}"></button>`;
}

function createWidthOption(width: (typeof widths)[number]): string {
  return `<button class="width-option gesture-target" type="button" title="${width}px" aria-label="${width}px" data-gesture-target="width:${width}" data-width-value="${width}"><span style="--option-width:${width}px"></span></button>`;
}

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`界面初始化失败：缺少 ${selector}。`);
  return element;
}

function getCameraActionLabel(status: CameraStatus): string {
  if (status === "requesting") return "等待授权…";
  if (status === "idle") return "启用摄像头";
  return "重新连接";
}

function getCameraStatusLabel(status: CameraStatus): string {
  const labels: Record<CameraStatus, string> = {
    idle: "等待连接摄像头",
    requesting: "正在请求摄像头",
    active: "摄像头已连接",
    denied: "摄像头权限被拒绝",
    unavailable: "摄像头不可用",
    interrupted: "摄像头连接中断",
    unsupported: "浏览器不支持摄像头",
    error: "摄像头启动失败",
  };
  return labels[status];
}

function getCameraSummary(status: CameraStatus): string {
  const labels: Record<CameraStatus, string> = {
    idle: "尚未连接",
    requesting: "等待授权",
    active: "本机处理中",
    denied: "需要授权",
    unavailable: "设备不可用",
    interrupted: "连接已中断",
    unsupported: "浏览器不支持",
    error: "启动失败",
  };
  return labels[status];
}

function isPointInsideElement(point: Point2D, element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}
