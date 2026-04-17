import type { Node } from "../ir.js";
import type { ResolvedOptions } from "./options.js";

export interface Measurements {
  width: number;
  up: number;
  down: number;
}

export type MeasureCache = Map<Node, Measurements>;

export const CHARACTER_WIDTH = 8;
export const LEAF_PADDING_X = 10;
export const LEAF_HALF_HEIGHT = 11;
export const COMMENT_HALF_HEIGHT = 8;
export const MARKER_WIDTH = 20;
export const GROUP_PADDING_X = 10;
export const GROUP_PADDING_Y = 4;
export const GROUP_LABEL_HEIGHT = 14;

function leafMeasurement(textLength: number): Measurements {
  return {
    width: textLength * CHARACTER_WIDTH + LEAF_PADDING_X * 2,
    up: LEAF_HALF_HEIGHT,
    down: LEAF_HALF_HEIGHT,
  };
}

export function measure(
  node: Node,
  options: ResolvedOptions,
  cache: MeasureCache,
): Measurements {
  const cached = cache.get(node);
  if (cached) return cached;
  const measurements = compute(node, options, cache);
  cache.set(node, measurements);
  return measurements;
}

function compute(
  node: Node,
  options: ResolvedOptions,
  cache: MeasureCache,
): Measurements {
  switch (node.kind) {
    case "diagram":
      throw new TypeError("render: Diagram cannot appear inside another node");
    case "start":
    case "end":
      return { width: MARKER_WIDTH, up: LEAF_HALF_HEIGHT, down: LEAF_HALF_HEIGHT };
    case "terminal":
      return leafMeasurement(node.text.length);
    case "nonterminal":
      return leafMeasurement(node.name.length);
    case "special":
      return leafMeasurement(node.text.length);
    case "comment":
      return {
        width: node.text.length * CHARACTER_WIDTH + LEAF_PADDING_X,
        up: COMMENT_HALF_HEIGHT,
        down: COMMENT_HALF_HEIGHT,
      };
    case "skip":
      return { width: 0, up: 0, down: 0 };
    case "sequence": {
      const childMeasurements = node.children.map((child) => measure(child, options, cache));
      return {
        width: childMeasurements.reduce((sum, current) => sum + current.width, 0),
        up: Math.max(...childMeasurements.map((current) => current.up)),
        down: Math.max(...childMeasurements.map((current) => current.down)),
      };
    }
    case "choice": {
      const { arcRadius, verticalSeparation } = options;
      const childMeasurements = node.children.map((child) => measure(child, options, cache));
      const normalIndex = node.normal ?? Math.floor((childMeasurements.length - 1) / 2);
      const innerWidth = Math.max(...childMeasurements.map((current) => current.width));
      const width = innerWidth + 4 * arcRadius;

      // biome-ignore lint/style/noNonNullAssertion: normalIndex is validated in-range by the builder / parser contract.
      let up = childMeasurements[normalIndex]!.up;
      for (let index = normalIndex - 1; index >= 0; index--) {
        // biome-ignore lint/style/noNonNullAssertion: index is a valid array position.
        up += verticalSeparation + childMeasurements[index]!.up + childMeasurements[index]!.down;
      }

      // biome-ignore lint/style/noNonNullAssertion: normalIndex is validated in-range.
      let down = childMeasurements[normalIndex]!.down;
      for (let index = normalIndex + 1; index < childMeasurements.length; index++) {
        // biome-ignore lint/style/noNonNullAssertion: index is a valid array position.
        down += verticalSeparation + childMeasurements[index]!.up + childMeasurements[index]!.down;
      }

      return { width, up, down };
    }
    case "optional": {
      const { arcRadius, verticalSeparation } = options;
      const childMeasurement = measure(node.child, options, cache);
      const width = childMeasurement.width + 4 * arcRadius;
      if (node.skip === "top") {
        return {
          width,
          up: childMeasurement.up + 2 * arcRadius + verticalSeparation,
          down: childMeasurement.down,
        };
      }
      return {
        width,
        up: childMeasurement.up,
        down: childMeasurement.down + 2 * arcRadius + verticalSeparation,
      };
    }
    case "repetition": {
      const { arcRadius, verticalSeparation } = options;
      const childMeasurement = measure(node.child, options, cache);
      const separatorMeasurement = node.separator
        ? measure(node.separator, options, cache)
        : { width: 0, up: 0, down: 0 };
      const contentWidth = Math.max(childMeasurement.width, separatorMeasurement.width);
      return {
        width: contentWidth + 4 * arcRadius,
        up: childMeasurement.up,
        down:
          childMeasurement.down +
          verticalSeparation +
          2 * arcRadius +
          separatorMeasurement.up +
          separatorMeasurement.down,
      };
    }
    case "group": {
      const childMeasurement = measure(node.child, options, cache);
      const labelRoom = node.label ? GROUP_LABEL_HEIGHT : 0;
      return {
        width: childMeasurement.width + GROUP_PADDING_X * 2,
        up: childMeasurement.up + GROUP_PADDING_Y + labelRoom,
        down: childMeasurement.down + GROUP_PADDING_Y,
      };
    }
  }
}
