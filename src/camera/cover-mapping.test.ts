import { describe, expect, it } from "vitest";
import {
  calculateCoverTransform,
  mapNormalizedPointToViewport,
} from "./cover-mapping";

describe("cover mapping", () => {
  it("calculates horizontal cropping for a square viewport", () => {
    const transform = calculateCoverTransform(
      { width: 640, height: 480 },
      { width: 900, height: 900 },
    );

    expect(transform).toMatchObject({
      scale: 1.875,
      renderedWidth: 1200,
      renderedHeight: 900,
      offsetX: -150,
      offsetY: 0,
    });
  });

  it("mirrors normalized x coordinates", () => {
    const transform = calculateCoverTransform(
      { width: 640, height: 480 },
      { width: 900, height: 900 },
    );
    expect(transform).not.toBeNull();

    const point = mapNormalizedPointToViewport(
      { x: 0, y: 0.5 },
      transform!,
      true,
    );
    expect(point).toEqual({ x: 1050, y: 450 });
  });
});

