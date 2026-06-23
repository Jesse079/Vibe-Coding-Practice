import { describe, expect, it } from "vitest";
import { HoldTimer } from "./hold-timer";

describe("HoldTimer", () => {
  it("progresses and resets when the condition breaks", () => {
    const timer = new HoldTimer(600);
    expect(timer.update(true, 1000)).toBe(0);
    expect(timer.update(true, 1300)).toBe(0.5);
    expect(timer.update(false, 1400)).toBe(0);
    expect(timer.update(true, 1500)).toBe(0);
  });

  it("caps progress at one", () => {
    const timer = new HoldTimer(600);
    timer.update(true, 0);
    expect(timer.update(true, 1000)).toBe(1);
  });
});

