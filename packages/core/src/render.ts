import type { Diagram, End, Start } from "./ir.js";
import { emit } from "./render/emit.js";
import { type MeasureCache, measure } from "./render/measure.js";
import { type RenderOptions, resolveOptions } from "./render/options.js";
import { formatNumber, sourceAttributes } from "./render/svg.js";

export type { RenderOptions } from "./render/options.js";

const DEFAULT_START: Start = { kind: "start", variant: "simple" };
const DEFAULT_END: End = { kind: "end", variant: "simple" };

export function render(diagram: Diagram, options?: RenderOptions): string {
  if (diagram === null || typeof diagram !== "object" || !("kind" in diagram)) {
    throw new TypeError(`render: expected a Diagram node, got ${typeof diagram}`);
  }
  if (diagram.kind !== "diagram") {
    throw new TypeError(`render: root must be a Diagram, got kind="${diagram.kind}"`);
  }

  const resolvedOptions = resolveOptions(options);
  const cache: MeasureCache = new Map();

  const startNode = diagram.start ?? DEFAULT_START;
  const endNode = diagram.end ?? DEFAULT_END;

  const startMeasurement = measure(startNode, resolvedOptions, cache);
  const childMeasurement = measure(diagram.child, resolvedOptions, cache);
  const endMeasurement = measure(endNode, resolvedOptions, cache);

  const padding = resolvedOptions.diagramPadding;
  const up = Math.max(startMeasurement.up, childMeasurement.up, endMeasurement.up);
  const down = Math.max(startMeasurement.down, childMeasurement.down, endMeasurement.down);
  const totalWidth =
    startMeasurement.width + childMeasurement.width + endMeasurement.width + 2 * padding;
  const totalHeight = up + down + 2 * padding;
  const railY = padding + up;

  const context = { options: resolvedOptions, cache };
  const startSvg = translateGroup(emit(startNode, context), padding, railY);
  const childSvg = translateGroup(
    emit(diagram.child, context),
    padding + startMeasurement.width,
    railY,
  );
  const endSvg = translateGroup(
    emit(endNode, context),
    padding + startMeasurement.width + childMeasurement.width,
    railY,
  );

  const diagramSource = sourceAttributes(diagram, resolvedOptions);

  return `<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 ${formatNumber(totalWidth)} ${formatNumber(totalHeight)}" width="${formatNumber(totalWidth)}" height="${formatNumber(totalHeight)}"><g class="diagram"${diagramSource}>${startSvg}${childSvg}${endSvg}</g></svg>`;
}

function translateGroup(childSvg: string, x: number, y: number): string {
  return `<g transform="translate(${formatNumber(x)} ${formatNumber(y)})">${childSvg}</g>`;
}
