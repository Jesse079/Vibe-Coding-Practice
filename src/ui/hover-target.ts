import { HoldTimer } from "../gestures/hold-timer";
import type { Point2D } from "../types";

export interface HoverResult {
  target: HTMLElement | null;
  targetId: string | null;
  progress: number;
  completed: boolean;
}

export class HoverTargetTracker {
  private targetId: string | null = null;
  private readonly timer: HoldTimer;

  public constructor(durationMs: number) {
    this.timer = new HoldTimer(durationMs);
  }

  public update(
    pointer: Point2D | null,
    selector: string,
    nowMs: number,
  ): HoverResult {
    const target = pointer ? findTargetAtPoint(pointer, selector) : null;
    const nextTargetId = target?.dataset.gestureTarget ?? null;

    if (nextTargetId !== this.targetId) {
      this.targetId = nextTargetId;
      this.timer.reset();
    }

    const progress = this.timer.update(Boolean(target), nowMs);
    return {
      target,
      targetId: nextTargetId,
      progress,
      completed: progress >= 1,
    };
  }

  public reset(): void {
    this.targetId = null;
    this.timer.reset();
  }
}

function findTargetAtPoint(
  point: Point2D,
  selector: string,
): HTMLElement | null {
  return (
    document
      .elementsFromPoint(point.x, point.y)
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.matches(selector),
      ) ?? null
  );
}

