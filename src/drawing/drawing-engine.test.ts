import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawingEngine } from "./drawing-engine";

describe("DrawingEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the brush configuration of each stroke", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const canvas = {
      width: 1000,
      height: 500,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    const engine = new DrawingEngine(canvas);

    engine.beginStroke({ x: 100, y: 100 }, { color: "#fff", width: 4 }, 0);
    engine.endStroke();
    engine.beginStroke({ x: 200, y: 200 }, { color: "#f00", width: 18 }, 1);

    expect(engine.getStrokes()).toMatchObject([
      { brush: { color: "#fff", width: 4 } },
      { brush: { color: "#f00", width: 18 } },
    ]);
  });

  it("clears every stroke", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const canvas = {
      width: 1000,
      height: 500,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    const engine = new DrawingEngine(canvas);
    engine.beginStroke({ x: 100, y: 100 }, { color: "#fff", width: 4 }, 0);
    engine.clear();
    expect(engine.getStrokeCount()).toBe(0);
  });

  it("limits sudden one-frame jumps while drawing", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const canvas = {
      width: 1000,
      height: 500,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    const engine = new DrawingEngine(canvas);

    engine.beginStroke({ x: 0, y: 0 }, { color: "#fff", width: 4 }, 0);
    engine.appendPoint({ x: 1000, y: 0 }, 16);

    const [, secondPoint] = engine.getStrokes()[0]?.points ?? [];
    expect(secondPoint?.x).toBeLessThan(0.2);
  });
});
