import {
  mapNormalizedPointToViewport,
  type CoverTransform,
} from "../camera/cover-mapping";
import type { HandObservation, Point2D } from "../types";

const handConnections: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class DiagnosticRenderer {
  private isVisible = true;

  public constructor(private readonly canvas: HTMLCanvasElement) {}

  public setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    if (!isVisible) this.clear();
  }

  public render(
    observation: HandObservation | null,
    transform: CoverTransform | null,
    pointer: Point2D | null,
  ): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;

    this.clear();
    if (!this.isVisible || !observation || !transform) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const points = observation.landmarks.map((landmark) =>
      mapNormalizedPointToViewport(landmark, transform, true),
    );

    context.save();
    context.scale(pixelRatio, pixelRatio);
    context.lineWidth = 1.4;
    context.strokeStyle = "rgba(71, 211, 245, 0.72)";
    context.fillStyle = "rgba(205, 248, 255, 0.95)";

    for (const [startIndex, endIndex] of handConnections) {
      const start = points[startIndex];
      const end = points[endIndex];
      if (!start || !end) continue;

      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }

    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      context.fill();
    }

    if (pointer) {
      context.lineWidth = 3;
      context.strokeStyle = "#45d8fa";
      context.beginPath();
      context.arc(pointer.x, pointer.y, 15, 0, Math.PI * 2);
      context.stroke();
    }

    context.restore();
  }

  public clear(): void {
    this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

