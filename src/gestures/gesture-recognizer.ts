import type {
  GestureSnapshot,
  HandObservation,
  NormalizedLandmark,
  Point2D,
} from "../types";

const pinchEnterRatio = 0.32;
const pinchExitRatio = 0.44;
const pinchEnterConfirmFrames = 2;
const pinchExitConfirmFrames = 3;

export class GestureRecognizer {
  private readonly selectionPinch = new PinchTracker();
  private readonly drawingPinch = new PinchTracker();

  public analyze(observation: HandObservation | null): GestureSnapshot {
    if (!observation) {
      this.selectionPinch.handleMissingObservation();
      this.drawingPinch.handleMissingObservation();
      return emptySnapshot(false, false);
    }

    const landmarks = observation.landmarks;
    const palmWidth = distance(landmarks[5], landmarks[17]);
    const pinchRatio = getRelativeDistance(landmarks[4], landmarks[8], palmWidth);
    const drawingPinchRatio = getRelativeDistance(
      landmarks[4],
      landmarks[12],
      palmWidth,
    );
    const selectionPinch = this.selectionPinch.update(pinchRatio);
    const drawingPinch = this.drawingPinch.update(drawingPinchRatio);

    const indexExtended = isFingerExtended(landmarks, 5, 6, 8);
    const middleExtended = isFingerExtended(landmarks, 9, 10, 12);
    const ringExtended = isFingerExtended(landmarks, 13, 14, 16);
    const pinkyExtended = isFingerExtended(landmarks, 17, 18, 20);
    const thumbExtended =
      distance(landmarks[4], landmarks[5]) >
      distance(landmarks[3], landmarks[5]) * 1.08;

    return {
      hasHand: true,
      isOpenPalm:
        thumbExtended &&
        indexExtended &&
        middleExtended &&
        ringExtended &&
        pinkyExtended &&
        !selectionPinch.isPinching &&
        !drawingPinch.isPinching,
      isIndexPointing:
        indexExtended &&
        !middleExtended &&
        !ringExtended &&
        !pinkyExtended &&
        !selectionPinch.isPinching &&
        !drawingPinch.isPinching,
      isPinching: selectionPinch.isPinching,
      pinchStarted: selectionPinch.started,
      pinchEnded: selectionPinch.ended,
      isDrawingPinching: drawingPinch.isPinching,
      drawingPinchStarted: drawingPinch.started,
      drawingPinchEnded: drawingPinch.ended,
      pointer: toPoint(landmarks[8]),
      pinchPoint: midpoint(landmarks[4], landmarks[8]),
      pinchRatio,
      drawingPinchRatio,
    };
  }

  public reset(): void {
    this.selectionPinch.reset();
    this.drawingPinch.reset();
  }
}

function emptySnapshot(
  pinchEnded: boolean,
  drawingPinchEnded: boolean,
): GestureSnapshot {
  return {
    hasHand: false,
    isOpenPalm: false,
    isIndexPointing: false,
    isPinching: false,
    pinchStarted: false,
    pinchEnded,
    isDrawingPinching: false,
    drawingPinchStarted: false,
    drawingPinchEnded,
    pointer: null,
    pinchPoint: null,
    pinchRatio: null,
    drawingPinchRatio: null,
  };
}

class PinchTracker {
  private isActive = false;
  private enterFrames = 0;
  private exitFrames = 0;

  public update(ratio: number): {
    isPinching: boolean;
    started: boolean;
    ended: boolean;
  } {
    const wasActive = this.isActive;

    if (this.isActive) {
      this.enterFrames = 0;

      if (ratio >= pinchExitRatio) {
        this.exitFrames += 1;
        if (this.exitFrames >= pinchExitConfirmFrames) {
          this.isActive = false;
          this.exitFrames = 0;
        }
      } else {
        this.exitFrames = 0;
      }
    } else {
      this.exitFrames = 0;

      if (ratio < pinchEnterRatio) {
        this.enterFrames += 1;
        if (this.enterFrames >= pinchEnterConfirmFrames) {
          this.isActive = true;
          this.enterFrames = 0;
        }
      } else {
        this.enterFrames = 0;
      }
    }

    return {
      isPinching: this.isActive,
      started: !wasActive && this.isActive,
      ended: wasActive && !this.isActive,
    };
  }

  public handleMissingObservation(): void {
    this.enterFrames = 0;
    this.exitFrames = 0;
  }

  public reset(): void {
    this.isActive = false;
    this.enterFrames = 0;
    this.exitFrames = 0;
  }
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  mcpIndex: number,
  pipIndex: number,
  tipIndex: number,
): boolean {
  const wrist = landmarks[0];
  const mcp = landmarks[mcpIndex];
  const pip = landmarks[pipIndex];
  const tip = landmarks[tipIndex];
  if (!wrist || !mcp || !pip || !tip) return false;

  return (
    distance(tip, wrist) > distance(pip, wrist) * 1.12 &&
    distance(tip, mcp) > distance(pip, mcp) * 1.25
  );
}

function distance(
  first: NormalizedLandmark | undefined,
  second: NormalizedLandmark | undefined,
): number {
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getRelativeDistance(
  first: NormalizedLandmark | undefined,
  second: NormalizedLandmark | undefined,
  palmWidth: number,
): number {
  return palmWidth > 0 ? distance(first, second) / palmWidth : 1;
}

function midpoint(
  first: NormalizedLandmark | undefined,
  second: NormalizedLandmark | undefined,
): Point2D | null {
  if (!first || !second) return null;
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function toPoint(landmark: NormalizedLandmark | undefined): Point2D | null {
  return landmark ? { x: landmark.x, y: landmark.y } : null;
}
