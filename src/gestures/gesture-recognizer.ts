import type {
  GestureSnapshot,
  HandObservation,
  NormalizedLandmark,
  Point2D,
} from "../types";

const pinchEnterRatio = 0.32;
const pinchExitRatio = 0.44;

export class GestureRecognizer {
  private isPinching = false;

  public analyze(observation: HandObservation | null): GestureSnapshot {
    if (!observation) {
      const pinchEnded = this.isPinching;
      this.isPinching = false;
      return emptySnapshot(pinchEnded);
    }

    const landmarks = observation.landmarks;
    const palmWidth = distance(landmarks[5], landmarks[17]);
    const pinchDistance = distance(landmarks[4], landmarks[8]);
    const pinchRatio = palmWidth > 0 ? pinchDistance / palmWidth : 1;
    const wasPinching = this.isPinching;

    this.isPinching = this.isPinching
      ? pinchRatio < pinchExitRatio
      : pinchRatio < pinchEnterRatio;

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
        !this.isPinching,
      isIndexPointing:
        indexExtended &&
        !middleExtended &&
        !ringExtended &&
        !pinkyExtended &&
        !this.isPinching,
      isPinching: this.isPinching,
      pinchStarted: !wasPinching && this.isPinching,
      pinchEnded: wasPinching && !this.isPinching,
      pointer: toPoint(landmarks[8]),
      pinchPoint: midpoint(landmarks[4], landmarks[8]),
      pinchRatio,
    };
  }

  public reset(): void {
    this.isPinching = false;
  }
}

function emptySnapshot(pinchEnded: boolean): GestureSnapshot {
  return {
    hasHand: false,
    isOpenPalm: false,
    isIndexPointing: false,
    isPinching: false,
    pinchStarted: false,
    pinchEnded,
    pointer: null,
    pinchPoint: null,
    pinchRatio: null,
  };
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

