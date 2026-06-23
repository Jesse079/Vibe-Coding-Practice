export type AppMode = "idle" | "configuring" | "drawing";

export interface Point2D {
  x: number;
  y: number;
}

export interface NormalizedLandmark extends Point2D {
  z: number;
}

export interface HandObservation {
  landmarks: NormalizedLandmark[];
  handedness: "Left" | "Right" | "Unknown";
  confidence: number;
  timestampMs: number;
}

export interface GestureSnapshot {
  hasHand: boolean;
  isOpenPalm: boolean;
  isIndexPointing: boolean;
  isPinching: boolean;
  pinchStarted: boolean;
  pinchEnded: boolean;
  pointer: Point2D | null;
  pinchPoint: Point2D | null;
  pinchRatio: number | null;
}

export interface BrushConfig {
  color: string;
  width: number;
}

export interface Point {
  x: number;
  y: number;
  timestampMs: number;
}

export interface Stroke {
  brush: BrushConfig;
  points: Point[];
}

export type AppEvent =
  | { type: "OPEN_PALM_READY" }
  | { type: "PINCH_STARTED" }
  | { type: "PINCH_ENDED" }
  | { type: "CONFIG_COMPLETED" }
  | { type: "CANCEL" };

export interface AppState {
  mode: AppMode;
  requiresPinchRelease: boolean;
}
