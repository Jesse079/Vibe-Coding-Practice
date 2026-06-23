import { describe, expect, it } from "vitest";
import type { HandObservation, NormalizedLandmark } from "../types";
import { GestureRecognizer } from "./gesture-recognizer";

describe("GestureRecognizer pinch hysteresis", () => {
  it("uses separate enter and exit thresholds", () => {
    const recognizer = new GestureRecognizer();

    const pendingEnter = recognizer.analyze(createObservation(0.05));
    expect(pendingEnter.pinchStarted).toBe(false);
    expect(pendingEnter.isPinching).toBe(false);

    const entered = recognizer.analyze(createObservation(0.05));
    expect(entered.pinchStarted).toBe(true);
    expect(entered.isPinching).toBe(true);

    const heldInHysteresis = recognizer.analyze(createObservation(0.08));
    expect(heldInHysteresis.isPinching).toBe(true);
    expect(heldInHysteresis.pinchStarted).toBe(false);

    const pendingExitOne = recognizer.analyze(createObservation(0.1));
    const pendingExitTwo = recognizer.analyze(createObservation(0.1));
    expect(pendingExitOne.isPinching).toBe(true);
    expect(pendingExitTwo.isPinching).toBe(true);

    const released = recognizer.analyze(createObservation(0.1));
    expect(released.isPinching).toBe(false);
    expect(released.pinchEnded).toBe(true);
  });

  it("does not release on a single missing-hand frame", () => {
    const recognizer = new GestureRecognizer();
    recognizer.analyze(createObservation(0.05));
    recognizer.analyze(createObservation(0.05));

    const missingFrame = recognizer.analyze(null);
    expect(missingFrame.pinchEnded).toBe(false);

    const recovered = recognizer.analyze(createObservation(0.05));
    expect(recovered.isPinching).toBe(true);
    expect(recovered.pinchEnded).toBe(false);
  });

  it("ignores one-frame pinch threshold spikes", () => {
    const recognizer = new GestureRecognizer();
    recognizer.analyze(createObservation(0.05));
    expect(recognizer.analyze(createObservation(0.1)).isPinching).toBe(false);

    recognizer.analyze(createObservation(0.05));
    const entered = recognizer.analyze(createObservation(0.05));
    expect(entered.isPinching).toBe(true);

    expect(recognizer.analyze(createObservation(0.1)).isPinching).toBe(true);
    expect(recognizer.analyze(createObservation(0.08)).isPinching).toBe(true);
  });

  it("recognizes an open palm and a single index finger", () => {
    const recognizer = new GestureRecognizer();
    expect(recognizer.analyze(createOpenPalm()).isOpenPalm).toBe(true);
    expect(recognizer.analyze(createIndexPoint()).isIndexPointing).toBe(true);
  });
});

function createObservation(tipDistance: number): HandObservation {
  const landmarks: NormalizedLandmark[] = Array.from(
    { length: 21 },
    () => ({ x: 0.5, y: 0.5, z: 0 }),
  );
  landmarks[5] = { x: 0.4, y: 0.5, z: 0 };
  landmarks[17] = { x: 0.6, y: 0.5, z: 0 };
  landmarks[4] = { x: 0.5 - tipDistance / 2, y: 0.4, z: 0 };
  landmarks[8] = { x: 0.5 + tipDistance / 2, y: 0.4, z: 0 };

  return {
    landmarks,
    handedness: "Right",
    confidence: 1,
    timestampMs: 0,
  };
}

function createOpenPalm(): HandObservation {
  const landmarks = createBaseLandmarks();
  setFinger(landmarks, 5, 6, 8, 0.38, 0.24);
  setFinger(landmarks, 9, 10, 12, 0.47, 0.18);
  setFinger(landmarks, 13, 14, 16, 0.56, 0.22);
  setFinger(landmarks, 17, 18, 20, 0.65, 0.28);
  landmarks[3] = { x: 0.32, y: 0.58, z: 0 };
  landmarks[4] = { x: 0.18, y: 0.52, z: 0 };
  return toObservation(landmarks);
}

function createIndexPoint(): HandObservation {
  const landmarks = createBaseLandmarks();
  setFinger(landmarks, 5, 6, 8, 0.38, 0.24);
  setFoldedFinger(landmarks, 9, 10, 12, 0.47);
  setFoldedFinger(landmarks, 13, 14, 16, 0.56);
  setFoldedFinger(landmarks, 17, 18, 20, 0.65);
  landmarks[4] = { x: 0.25, y: 0.64, z: 0 };
  return toObservation(landmarks);
}

function createBaseLandmarks(): NormalizedLandmark[] {
  const landmarks = Array.from(
    { length: 21 },
    () => ({ x: 0.5, y: 0.7, z: 0 }),
  );
  landmarks[0] = { x: 0.5, y: 0.9, z: 0 };
  landmarks[5] = { x: 0.38, y: 0.66, z: 0 };
  landmarks[9] = { x: 0.47, y: 0.63, z: 0 };
  landmarks[13] = { x: 0.56, y: 0.65, z: 0 };
  landmarks[17] = { x: 0.65, y: 0.7, z: 0 };
  return landmarks;
}

function setFinger(
  landmarks: NormalizedLandmark[],
  mcp: number,
  pip: number,
  tip: number,
  x: number,
  tipY: number,
): void {
  landmarks[mcp] = { x, y: 0.65, z: 0 };
  landmarks[pip] = { x, y: 0.48, z: 0 };
  landmarks[tip] = { x, y: tipY, z: 0 };
}

function setFoldedFinger(
  landmarks: NormalizedLandmark[],
  mcp: number,
  pip: number,
  tip: number,
  x: number,
): void {
  landmarks[mcp] = { x, y: 0.65, z: 0 };
  landmarks[pip] = { x, y: 0.55, z: 0 };
  landmarks[tip] = { x, y: 0.62, z: 0 };
}

function toObservation(landmarks: NormalizedLandmark[]): HandObservation {
  return {
    landmarks,
    handedness: "Right",
    confidence: 1,
    timestampMs: 0,
  };
}
