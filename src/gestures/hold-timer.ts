export class HoldTimer {
  private startedAtMs: number | null = null;

  public constructor(private readonly durationMs: number) {}

  public update(isActive: boolean, nowMs: number): number {
    if (!isActive) {
      this.reset();
      return 0;
    }

    this.startedAtMs ??= nowMs;
    return Math.min(1, (nowMs - this.startedAtMs) / this.durationMs);
  }

  public reset(): void {
    this.startedAtMs = null;
  }
}

