import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { HandObservation, NormalizedLandmark } from "../types";

export interface TrackingStats {
  framesPerSecond: number;
  inferenceMs: number;
}

export interface HandTrackerCallbacks {
  onObservation: (observation: HandObservation | null) => void;
  onStats: (stats: TrackingStats) => void;
  onError: (message: string) => void;
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;
  private frameTimes: number[] = [];

  public constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly callbacks: HandTrackerCallbacks,
  ) {}

  public async initialize(): Promise<void> {
    if (this.handLandmarker) {
      return;
    }

    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const options = {
      runningMode: "VIDEO" as const,
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    };

    try {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: "/models/hand_landmarker.task",
          delegate: "GPU",
        },
      });
    } catch {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: "/models/hand_landmarker.task",
          delegate: "CPU",
        },
      });
    }
  }

  public start(): void {
    if (!this.handLandmarker || this.animationFrameId !== null) {
      return;
    }

    this.lastVideoTime = -1;
    this.frameTimes = [];
    this.animationFrameId = requestAnimationFrame(this.processFrame);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.callbacks.onObservation(null);
  }

  public close(): void {
    this.stop();
    this.handLandmarker?.close();
    this.handLandmarker = null;
  }

  private readonly processFrame = (): void => {
    if (!this.handLandmarker) {
      this.animationFrameId = null;
      return;
    }

    if (
      this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.videoElement.currentTime !== this.lastVideoTime
    ) {
      const startedAt = performance.now();

      try {
        const result = this.handLandmarker.detectForVideo(
          this.videoElement,
          startedAt,
        );
        const finishedAt = performance.now();
        this.lastVideoTime = this.videoElement.currentTime;
        this.callbacks.onObservation(toObservation(result, finishedAt));
        this.callbacks.onStats({
          framesPerSecond: this.updateFramesPerSecond(finishedAt),
          inferenceMs: finishedAt - startedAt,
        });
      } catch {
        this.callbacks.onError("手部识别暂时失败，请重新连接摄像头。");
        this.stop();
        return;
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  private updateFramesPerSecond(nowMs: number): number {
    this.frameTimes.push(nowMs);

    while (this.frameTimes[0] !== undefined && nowMs - this.frameTimes[0] > 1000) {
      this.frameTimes.shift();
    }

    return this.frameTimes.length;
  }
}

function toObservation(
  result: HandLandmarkerResult,
  timestampMs: number,
): HandObservation | null {
  const landmarks = result.landmarks[0];

  if (!landmarks || landmarks.length !== 21) {
    return null;
  }

  const handednessCategory = result.handedness[0]?.[0];
  const handedness = handednessCategory?.categoryName;

  return {
    landmarks: landmarks.map(
      (landmark): NormalizedLandmark => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
      }),
    ),
    handedness:
      handedness === "Left" || handedness === "Right"
        ? handedness
        : "Unknown",
    confidence: handednessCategory?.score ?? 0,
    timestampMs,
  };
}
