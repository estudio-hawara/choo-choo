import type {
  Choice,
  Comment,
  End,
  Group,
  NonTerminal,
  Node,
  Optional,
  Repetition,
  Sequence,
  Skip,
  Special,
  Start,
  Terminal,
} from "../ir.js";
import {
  GROUP_PADDING_X,
  GROUP_PADDING_Y,
  LEAF_HALF_HEIGHT,
  type MeasureCache,
  type Measurements,
  measure,
} from "./measure.js";
import type { ResolvedOptions } from "./options.js";
import { escape, formatNumber, sourceAttributes } from "./svg.js";

export interface EmitContext {
  options: ResolvedOptions;
  cache: MeasureCache;
}

export function emit(node: Node, context: EmitContext): string {
  switch (node.kind) {
    case "diagram":
      throw new TypeError("render: Diagram cannot appear inside another node");
    case "start":
      return emitStart(node, context);
    case "end":
      return emitEnd(node, context);
    case "terminal":
      return emitTerminal(node, context);
    case "nonterminal":
      return emitNonTerminal(node, context);
    case "special":
      return emitSpecial(node, context);
    case "comment":
      return emitComment(node, context);
    case "skip":
      return emitSkip(node, context);
    case "sequence":
      return emitSequence(node, context);
    case "choice":
      return emitChoice(node, context);
    case "optional":
      return emitOptional(node, context);
    case "repetition":
      return emitRepetition(node, context);
    case "group":
      return emitGroup(node, context);
  }
}

function wrapLink(body: string, href: string | undefined): string {
  if (href === undefined) return body;
  return `<a xlink:href="${escape(href)}">${body}</a>`;
}

function titleElement(title: string | undefined): string {
  return title === undefined ? "" : `<title>${escape(title)}</title>`;
}

function emitStart(node: Start, context: EmitContext): string {
  const width = 20;
  const source = sourceAttributes(node, context.options);
  const bars =
    node.variant === "complex"
      ? `<path d="M0 -10 v20"/><path d="M5 -10 v20"/>`
      : `<path d="M0 -10 v20"/>`;
  const rail = `<path d="M0 0 h${width}"/>`;
  const label =
    node.label !== undefined
      ? `<text x="0" y="-15" class="diagram-label">${escape(node.label)}</text>`
      : "";
  return `<g class="start"${source}>${bars}${rail}${label}</g>`;
}

function emitEnd(node: End, context: EmitContext): string {
  const width = 20;
  const source = sourceAttributes(node, context.options);
  const rail = `<path d="M0 0 h${width}"/>`;
  const bars =
    node.variant === "complex"
      ? `<path d="M${width} -10 v20"/><path d="M${width - 5} -10 v20"/>`
      : `<path d="M${width} -10 v20"/>`;
  return `<g class="end"${source}>${rail}${bars}</g>`;
}

function emitLeafBox(
  cssClass: "terminal" | "non-terminal" | "special",
  width: number,
  text: string,
  href: string | undefined,
  title: string | undefined,
  source: string,
): string {
  const height = LEAF_HALF_HEIGHT * 2;
  const top = -LEAF_HALF_HEIGHT;
  let shape: string;
  if (cssClass === "terminal") {
    shape = `<rect x="0" y="${top}" width="${formatNumber(width)}" height="${height}" rx="10" ry="10"/>`;
  } else if (cssClass === "non-terminal") {
    shape = `<rect x="0" y="${top}" width="${formatNumber(width)}" height="${height}"/>`;
  } else {
    const slant = 5;
    shape =
      `<path d="M0 0 L${slant} ${top} H${formatNumber(width - slant)} ` +
      `L${formatNumber(width)} 0 L${formatNumber(width - slant)} ${LEAF_HALF_HEIGHT} ` +
      `H${slant} Z"/>`;
  }
  const label = `<text x="${formatNumber(width / 2)}" y="5" text-anchor="middle">${escape(text)}</text>`;
  const body = `${shape}${label}`;
  const wrapped = wrapLink(body, href);
  return `<g class="${cssClass}"${source}>${titleElement(title)}${wrapped}</g>`;
}

function emitTerminal(node: Terminal, context: EmitContext): string {
  const measurements = measure(node, context.options, context.cache);
  return emitLeafBox(
    "terminal",
    measurements.width,
    node.text,
    node.href,
    node.title,
    sourceAttributes(node, context.options),
  );
}

function emitNonTerminal(node: NonTerminal, context: EmitContext): string {
  const measurements = measure(node, context.options, context.cache);
  return emitLeafBox(
    "non-terminal",
    measurements.width,
    node.name,
    node.href,
    node.title,
    sourceAttributes(node, context.options),
  );
}

function emitSpecial(node: Special, context: EmitContext): string {
  const measurements = measure(node, context.options, context.cache);
  return emitLeafBox(
    "special",
    measurements.width,
    node.text,
    node.href,
    node.title,
    sourceAttributes(node, context.options),
  );
}

function emitComment(node: Comment, context: EmitContext): string {
  const measurements = measure(node, context.options, context.cache);
  const source = sourceAttributes(node, context.options);
  const rail = `<path d="M0 0 h${formatNumber(measurements.width)}"/>`;
  const label = `<text x="${formatNumber(measurements.width / 2)}" y="5" text-anchor="middle" class="comment-text">${escape(node.text)}</text>`;
  const body = wrapLink(`${rail}${label}`, node.href);
  return `<g class="comment"${source}>${titleElement(node.title)}${body}</g>`;
}

function emitSkip(node: Skip, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  return `<g class="skip"${source}></g>`;
}

function emitSequence(node: Sequence, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  let cursor = 0;
  const parts: string[] = [];
  for (const child of node.children) {
    const childSvg = emit(child, context);
    parts.push(`<g transform="translate(${formatNumber(cursor)} 0)">${childSvg}</g>`);
    cursor += measure(child, context.options, context.cache).width;
  }
  return `<g class="sequence"${source}>${parts.join("")}</g>`;
}

function computeChoiceOffsets(
  childMeasurements: readonly Measurements[],
  normalIndex: number,
  verticalSeparation: number,
): number[] {
  const offsets = new Array<number>(childMeasurements.length);
  offsets[normalIndex] = 0;
  for (let index = normalIndex - 1; index >= 0; index--) {
    const below = childMeasurements[index + 1];
    const current = childMeasurements[index];
    const nextOffset = offsets[index + 1];
    if (!below || !current || nextOffset === undefined) throw new Error("unreachable");
    offsets[index] = nextOffset - (below.up + verticalSeparation + current.down);
  }
  for (let index = normalIndex + 1; index < childMeasurements.length; index++) {
    const above = childMeasurements[index - 1];
    const current = childMeasurements[index];
    const previousOffset = offsets[index - 1];
    if (!above || !current || previousOffset === undefined) throw new Error("unreachable");
    offsets[index] = previousOffset + (above.down + verticalSeparation + current.up);
  }
  return offsets;
}

function sCurve(x: number, y: number, dy: number, arcRadius: number): string {
  // Draws a rail from (x, y) to (x + 2 * arcRadius, y + dy) as two quarter-arcs
  // joined by a vertical segment.
  if (dy === 0) return `M${formatNumber(x)} ${formatNumber(y)} h${formatNumber(2 * arcRadius)}`;
  const downward = dy > 0;
  const arcDy = downward ? arcRadius : -arcRadius;
  const firstSweep = downward ? 1 : 0;
  const secondSweep = downward ? 0 : 1;
  const middleSegment = dy - 2 * arcDy;
  return (
    `M${formatNumber(x)} ${formatNumber(y)} ` +
    `a${arcRadius} ${arcRadius} 0 0 ${firstSweep} ${arcRadius} ${arcDy} ` +
    `v${formatNumber(middleSegment)} ` +
    `a${arcRadius} ${arcRadius} 0 0 ${secondSweep} ${arcRadius} ${arcDy}`
  );
}

function sCurveTailToZero(currentOffset: number, arcRadius: number): string {
  // Continues from the current pen position (assumed at y = currentOffset) back to y = 0.
  if (currentOffset === 0) return `h${formatNumber(2 * arcRadius)}`;
  const returningDown = currentOffset < 0;
  const arcDy = returningDown ? arcRadius : -arcRadius;
  const firstSweep = returningDown ? 1 : 0;
  const secondSweep = returningDown ? 0 : 1;
  const middleSegment = -currentOffset - 2 * arcDy;
  return (
    `a${arcRadius} ${arcRadius} 0 0 ${firstSweep} ${arcRadius} ${arcDy} ` +
    `v${formatNumber(middleSegment)} ` +
    `a${arcRadius} ${arcRadius} 0 0 ${secondSweep} ${arcRadius} ${arcDy}`
  );
}

function emitChoice(node: Choice, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  const { arcRadius, verticalSeparation } = context.options;
  const childMeasurements = node.children.map((child) =>
    measure(child, context.options, context.cache),
  );
  const normalIndex = node.normal ?? Math.floor((childMeasurements.length - 1) / 2);
  const innerWidth = Math.max(...childMeasurements.map((current) => current.width));
  const totalWidth = innerWidth + 4 * arcRadius;
  const offsets = computeChoiceOffsets(childMeasurements, normalIndex, verticalSeparation);

  const parts: string[] = [];

  for (let index = 0; index < childMeasurements.length; index++) {
    const childMeasurement = childMeasurements[index];
    const childOffset = offsets[index];
    const child = node.children[index];
    if (!childMeasurement || childOffset === undefined || !child) {
      throw new Error("unreachable");
    }
    const childLeft = 2 * arcRadius;
    const childRight = childLeft + childMeasurement.width;

    if (index === normalIndex) {
      parts.push(`<path d="M0 0 h${formatNumber(childLeft)}"/>`);
    } else {
      parts.push(`<path d="${sCurve(0, 0, childOffset, arcRadius)}"/>`);
    }

    const childSvg = emit(child, context);
    parts.push(
      `<g transform="translate(${formatNumber(childLeft)} ${formatNumber(childOffset)})">${childSvg}</g>`,
    );

    const rightPadding = innerWidth - childMeasurement.width;
    if (index === normalIndex) {
      parts.push(
        `<path d="M${formatNumber(childRight)} 0 h${formatNumber(totalWidth - childRight)}"/>`,
      );
    } else {
      if (rightPadding > 0) {
        parts.push(
          `<path d="M${formatNumber(childRight)} ${formatNumber(childOffset)} h${formatNumber(rightPadding)}"/>`,
        );
      }
      parts.push(
        `<path d="${sCurve(childRight + rightPadding, childOffset, -childOffset, arcRadius)}"/>`,
      );
    }
  }

  return `<g class="choice"${source}>${parts.join("")}</g>`;
}

function emitOptional(node: Optional, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  const { arcRadius, verticalSeparation } = context.options;
  const childMeasurement = measure(node.child, context.options, context.cache);
  const totalWidth = childMeasurement.width + 4 * arcRadius;
  const childLeft = 2 * arcRadius;
  const skipOffset =
    node.skip === "top"
      ? -(childMeasurement.up + verticalSeparation + arcRadius)
      : childMeasurement.down + verticalSeparation + arcRadius;

  const leftRail = `<path d="M0 0 h${formatNumber(childLeft)}"/>`;
  const rightRail = `<path d="M${formatNumber(childLeft + childMeasurement.width)} 0 h${formatNumber(2 * arcRadius)}"/>`;
  const skipPath =
    `<path d="${sCurve(0, 0, skipOffset, arcRadius)} ` +
    `H${formatNumber(totalWidth - 2 * arcRadius)} ` +
    `${sCurveTailToZero(skipOffset, arcRadius)}"/>`;
  const childSvg = emit(node.child, context);
  const childGroup = `<g transform="translate(${formatNumber(childLeft)} 0)">${childSvg}</g>`;

  return `<g class="optional"${source}>${leftRail}${rightRail}${childGroup}${skipPath}</g>`;
}

function emitRepetition(node: Repetition, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  const { arcRadius, verticalSeparation } = context.options;
  const childMeasurement = measure(node.child, context.options, context.cache);
  const separatorMeasurement = node.separator
    ? measure(node.separator, context.options, context.cache)
    : { width: 0, up: 0, down: 0 };
  const contentWidth = Math.max(childMeasurement.width, separatorMeasurement.width);
  const totalWidth = contentWidth + 4 * arcRadius;
  const childLeft = 2 * arcRadius;
  const childRight = childLeft + childMeasurement.width;
  const returnY = childMeasurement.down + verticalSeparation + arcRadius;
  const separatorCenterX = childLeft + contentWidth / 2;

  const leftRail = `<path d="M0 0 h${formatNumber(childLeft)}"/>`;
  const rightRail = `<path d="M${formatNumber(childRight)} 0 h${formatNumber(totalWidth - childRight)}"/>`;
  const childSvg = emit(node.child, context);
  const childGroup = `<g transform="translate(${formatNumber(childLeft)} 0)">${childSvg}</g>`;

  const returnPath =
    `<path d="M${formatNumber(childRight)} 0 ` +
    `a${arcRadius} ${arcRadius} 0 0 1 ${arcRadius} ${arcRadius} ` +
    `v${formatNumber(returnY - 2 * arcRadius)} ` +
    `a${arcRadius} ${arcRadius} 0 0 1 -${arcRadius} ${arcRadius} ` +
    `H${formatNumber(childLeft - arcRadius)} ` +
    `a${arcRadius} ${arcRadius} 0 0 1 -${arcRadius} -${arcRadius} ` +
    `v-${formatNumber(returnY - 2 * arcRadius)} ` +
    `a${arcRadius} ${arcRadius} 0 0 1 ${arcRadius} -${arcRadius} Z"/>`;

  let separatorSvg = "";
  if (node.separator) {
    const separatorX = separatorCenterX - separatorMeasurement.width / 2;
    const separatorY = returnY;
    const separatorBody = emit(node.separator, context);
    separatorSvg = `<g transform="translate(${formatNumber(separatorX)} ${formatNumber(separatorY)})">${separatorBody}</g>`;
  }

  return `<g class="repetition"${source}>${leftRail}${rightRail}${childGroup}${returnPath}${separatorSvg}</g>`;
}

function emitGroup(node: Group, context: EmitContext): string {
  const source = sourceAttributes(node, context.options);
  const childMeasurement = measure(node.child, context.options, context.cache);
  const boxX = 0;
  const boxY = -(childMeasurement.up + GROUP_PADDING_Y);
  const boxWidth = childMeasurement.width + GROUP_PADDING_X * 2;
  const boxHeight = childMeasurement.up + childMeasurement.down + GROUP_PADDING_Y * 2;
  const childSvg = emit(node.child, context);
  const childGroup = `<g transform="translate(${formatNumber(GROUP_PADDING_X)} 0)">${childSvg}</g>`;
  const rail = `<path d="M0 0 h${formatNumber(GROUP_PADDING_X)} M${formatNumber(GROUP_PADDING_X + childMeasurement.width)} 0 h${formatNumber(GROUP_PADDING_X)}"/>`;
  const rect = `<rect x="${formatNumber(boxX)}" y="${formatNumber(boxY)}" width="${formatNumber(boxWidth)}" height="${formatNumber(boxHeight)}" class="group-box"/>`;
  const label =
    node.label !== undefined
      ? `<text x="${formatNumber(GROUP_PADDING_X)}" y="${formatNumber(boxY - 4)}" class="group-label">${escape(node.label)}</text>`
      : "";
  return `<g class="group"${source}>${rect}${label}${rail}${childGroup}</g>`;
}
