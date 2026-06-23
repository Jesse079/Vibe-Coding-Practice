import { describe, expect, it } from "vitest";
import { initialAppState, transitionAppState } from "./app-state-machine";

describe("transitionAppState", () => {
  it("enters configuration only from idle", () => {
    const configuring = transitionAppState(initialAppState, {
      type: "OPEN_PALM_READY",
    });
    expect(configuring.mode).toBe("configuring");
    expect(
      transitionAppState(configuring, { type: "PINCH_STARTED" }),
    ).toEqual(configuring);
  });

  it("draws on pinch and returns to idle on release", () => {
    const drawing = transitionAppState(initialAppState, {
      type: "PINCH_STARTED",
    });
    expect(drawing.mode).toBe("drawing");
    expect(transitionAppState(drawing, { type: "PINCH_ENDED" }).mode).toBe(
      "idle",
    );
  });

  it("requires pinch release after completing configuration", () => {
    const configuring = transitionAppState(initialAppState, {
      type: "OPEN_PALM_READY",
    });
    const idle = transitionAppState(configuring, {
      type: "CONFIG_COMPLETED",
    });

    expect(idle.requiresPinchRelease).toBe(true);
    expect(transitionAppState(idle, { type: "PINCH_STARTED" })).toEqual(idle);
    expect(
      transitionAppState(idle, { type: "PINCH_ENDED" }).requiresPinchRelease,
    ).toBe(false);
  });
});

