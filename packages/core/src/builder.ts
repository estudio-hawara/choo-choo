import type {
  Choice,
  Comment,
  Diagram,
  End,
  Group,
  Node,
  NonTerminal,
  Optional,
  Repetition,
  Sequence,
  Skip,
  Special,
  Start,
  Terminal,
} from "./ir.js";

interface LeafMeta {
  href?: string;
  title?: string;
}

interface DiagramOptions {
  start?: Start;
  end?: End;
}

interface ChoiceOptions {
  normal: number;
}

function requireString(factory: string, field: string, value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${factory}: ${field} must be a string, got ${typeof value}`);
  }
}

function warnIfEmpty(factory: string, value: string): void {
  if (value === "") {
    console.warn(`${factory}: empty string — the box will render as empty`);
  }
}

export function diagram(child: Node, options?: DiagramOptions): Diagram {
  if (child.kind === "diagram") {
    throw new TypeError("diagram: child must not itself be a Diagram (diagrams don't nest)");
  }
  const node: Diagram = { kind: "diagram", child };
  if (options?.start !== undefined) node.start = options.start;
  if (options?.end !== undefined) node.end = options.end;
  return node;
}

export function start(variant: "simple" | "complex", label?: string): Start {
  if (variant !== "simple" && variant !== "complex") {
    throw new TypeError(`start: variant must be "simple" or "complex", got ${String(variant)}`);
  }
  const node: Start = { kind: "start", variant };
  if (label !== undefined) node.label = label;
  return node;
}

export function end(variant: "simple" | "complex"): End {
  if (variant !== "simple" && variant !== "complex") {
    throw new TypeError(`end: variant must be "simple" or "complex", got ${String(variant)}`);
  }
  return { kind: "end", variant };
}

export function terminal(text: string, meta?: LeafMeta): Terminal {
  requireString("terminal", "text", text);
  warnIfEmpty("terminal", text);
  const node: Terminal = { kind: "terminal", text };
  if (meta?.href !== undefined) node.href = meta.href;
  if (meta?.title !== undefined) node.title = meta.title;
  return node;
}

export function nonTerminal(name: string, meta?: LeafMeta): NonTerminal {
  requireString("nonTerminal", "name", name);
  warnIfEmpty("nonTerminal", name);
  const node: NonTerminal = { kind: "nonterminal", name };
  if (meta?.href !== undefined) node.href = meta.href;
  if (meta?.title !== undefined) node.title = meta.title;
  return node;
}

export function special(text: string, meta?: LeafMeta): Special {
  requireString("special", "text", text);
  warnIfEmpty("special", text);
  const node: Special = { kind: "special", text };
  if (meta?.href !== undefined) node.href = meta.href;
  if (meta?.title !== undefined) node.title = meta.title;
  return node;
}

export function comment(text: string, meta?: LeafMeta): Comment {
  requireString("comment", "text", text);
  warnIfEmpty("comment", text);
  const node: Comment = { kind: "comment", text };
  if (meta?.href !== undefined) node.href = meta.href;
  if (meta?.title !== undefined) node.title = meta.title;
  return node;
}

export function sequence(...children: Node[]): Node {
  if (children.length === 0) {
    throw new TypeError("sequence: requires at least 1 child, got 0");
  }
  if (children.length === 1) {
    // biome-ignore lint/style/noNonNullAssertion: length === 1 guarantees index 0 exists
    return children[0]!;
  }
  const seq: Sequence = { kind: "sequence", children };
  return seq;
}

export function choice(...children: Node[]): Choice;
export function choice(options: ChoiceOptions, ...children: Node[]): Choice;
export function choice(first?: Node | ChoiceOptions, ...rest: Node[]): Choice {
  let normal: number | undefined;
  let children: Node[];

  if (first === undefined) {
    children = [];
  } else if ("kind" in first) {
    children = [first, ...rest];
  } else {
    normal = first.normal;
    children = rest;
  }

  if (children.length < 2) {
    throw new TypeError(`choice: requires at least 2 children, got ${children.length}`);
  }

  if (normal !== undefined) {
    if (!Number.isInteger(normal) || normal < 0 || normal >= children.length) {
      throw new TypeError(
        `choice: normal index ${normal} is out of range for ${children.length} children`,
      );
    }
    return { kind: "choice", children, normal };
  }
  return { kind: "choice", children };
}

export function optional(child: Node, skipPos: "top" | "bottom" = "top"): Optional {
  if (skipPos !== "top" && skipPos !== "bottom") {
    throw new TypeError(`optional: skip must be "top" or "bottom", got ${String(skipPos)}`);
  }
  return { kind: "optional", child, skip: skipPos };
}

export function oneOrMore(child: Node, separator?: Node): Repetition {
  const node: Repetition = { kind: "repetition", child };
  if (separator !== undefined) node.separator = separator;
  return node;
}

export function zeroOrMore(child: Node, separator?: Node): Optional {
  return optional(oneOrMore(child, separator));
}

export function group(child: Node, label?: string): Group {
  const node: Group = { kind: "group", child };
  if (label !== undefined) node.label = label;
  return node;
}

export function skip(): Skip {
  return { kind: "skip" };
}
