import type { BrushConfig, Point, Point2D, Stroke } from "../types";

export class DrawingEngine {
  private strokes: Stroke[] = [];
  private activeStroke: Stroke | null = null;
  private filteredPoint: Point2D | null = null;

  public constructor(private readonly canvas: HTMLCanvasElement) {}

  public beginStroke(
    point: Point2D,
    brush: BrushConfig,
    timestampMs: number,
  ): void {
    const stroke: Stroke = {
      brush: { ...brush },
      points: [this.toNormalizedPoint(point, timestampMs)],
    };
    this.activeStroke = stroke;
    this.filteredPoint = point;
    this.strokes.push(stroke);
    this.render();
  }

  public appendPoint(point: Point2D, timestampMs: number): void {
    if (!this.activeStroke) return;

    const smoothedPoint = this.smooth(point);
    const previous = this.activeStroke.points.at(-1);
    const normalizedPoint = this.toNormalizedPoint(smoothedPoint, timestampMs);

    if (
      previous &&
      Math.hypot(
        normalizedPoint.x - previous.x,
        normalizedPoint.y - previous.y,
      ) < 0.0015
    ) {
      return;
    }

    this.activeStroke.points.push(normalizedPoint);
    this.render();
  }

  public endStroke(): void {
    this.activeStroke = null;
    this.filteredPoint = null;
  }

  public clear(): void {
    this.strokes = [];
    this.endStroke();
    this.render();
  }

  public resize(): void {
    this.render();
  }

  public getStrokeCount(): number {
    return this.strokes.length;
  }

  public getStrokes(): readonly Stroke[] {
    return this.strokes;
  }

  public render(): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.width / pixelRatio;
    const height = this.canvas.height / pixelRatio;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.save();
    context.scale(pixelRatio, pixelRatio);
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const stroke of this.strokes) {
      this.renderStroke(context, stroke, width, height);
    }

    context.restore();
  }

  private renderStroke(
    context: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number,
  ): void {
    const [firstPoint] = stroke.points;
    if (!firstPoint) return;

    context.strokeStyle = stroke.brush.color;
    context.fillStyle = stroke.brush.color;
    context.lineWidth = stroke.brush.width;
    context.shadowColor = stroke.brush.color;
    context.shadowBlur = Math.min(12, stroke.brush.width * 0.9);

    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(
        firstPoint.x * width,
        firstPoint.y * height,
        stroke.brush.width / 2,
        0,
        Math.PI * 2,
      );
      context.fill();
      return;
    }

    context.beginPath();
    context.moveTo(firstPoint.x * width, firstPoint.y * height);

    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const current = stroke.points[index];
      const next = stroke.points[index + 1];
      if (!current || !next) continue;

      context.quadraticCurveTo(
        current.x * width,
        current.y * height,
        ((current.x + next.x) / 2) * width,
        ((current.y + next.y) / 2) * height,
      );
    }

    const lastPoint = stroke.points.at(-1);
    if (lastPoint) context.lineTo(lastPoint.x * width, lastPoint.y * height);
    context.stroke();
  }

  private smooth(point: Point2D): Point2D {
    if (!this.filteredPoint) {
      this.filteredPoint = point;
      return point;
    }

    const distance = Math.hypot(
      point.x - this.filteredPoint.x,
      point.y - this.filteredPoint.y,
    );
    const alpha = Math.min(0.72, Math.max(0.34, distance / 80));
    this.filteredPoint = {
      x: this.filteredPoint.x + (point.x - this.filteredPoint.x) * alpha,
      y: this.filteredPoint.y + (point.y - this.filteredPoint.y) * alpha,
    };
    return this.filteredPoint;
  }

  private toNormalizedPoint(point: Point2D, timestampMs: number): Point {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.width / pixelRatio;
    const height = this.canvas.height / pixelRatio;
    return {
      x: width > 0 ? point.x / width : 0,
      y: height > 0 ? point.y / height : 0,
      timestampMs,
    };
  }
}

