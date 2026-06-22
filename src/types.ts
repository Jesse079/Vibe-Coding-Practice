export type AppMode = "idle" | "configuring" | "drawing";

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

