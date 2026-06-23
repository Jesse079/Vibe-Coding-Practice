import type { Point2D } from "../types";

export interface CoverTransform {
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface Size {
  width: number;
  height: number;
}

export function calculateCoverTransform(
  source: Size,
  viewport: Size,
): CoverTransform | null {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    viewport.width / source.width,
    viewport.height / source.height,
  );
  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;

  return {
    scale,
    renderedWidth,
    renderedHeight,
    offsetX: (viewport.width - renderedWidth) / 2,
    offsetY: (viewport.height - renderedHeight) / 2,
  };
}

export function mapNormalizedPointToViewport(
  point: Point2D,
  transform: CoverTransform,
  isMirrored = true,
): Point2D {
  const normalizedX = isMirrored ? 1 - point.x : point.x;

  return {
    x: transform.offsetX + normalizedX * transform.renderedWidth,
    y: transform.offsetY + point.y * transform.renderedHeight,
  };
}

