import { group } from "./builder.js";
import type { ParsedGrammar } from "./grammar.js";
import type { Diagram, Node } from "./ir.js";

export type ComposeMode = "no" | "yes" | "grouped";

export function composeRule(grammar: ParsedGrammar, ruleName: string, mode: ComposeMode): Diagram {
  if (mode !== "no" && mode !== "yes" && mode !== "grouped") {
    throw new TypeError(`composeRule: mode must be "no", "yes" or "grouped", got ${String(mode)}`);
  }

  if (mode === "no") {
    const target = grammar.rules.find((candidate) => candidate.name === ruleName);
    if (!target) {
      throw new Error(`composeRule: rule "${ruleName}" not found in parsed grammar`);
    }
    return target.diagram;
  }

  const composed = new Map<string, Diagram>();
  let result: Diagram | undefined;
  for (const rule of grammar.rules) {
    const composedDiagram: Diagram = {
      ...rule.diagram,
      child: substitute(rule.diagram.child, composed, mode),
    };
    composed.set(rule.name, composedDiagram);
    if (rule.name === ruleName) result = composedDiagram;
  }

  if (!result) {
    throw new Error(`composeRule: rule "${ruleName}" not found in parsed grammar`);
  }
  return result;
}

function substitute(node: Node, composed: Map<string, Diagram>, mode: "yes" | "grouped"): Node {
  switch (node.kind) {
    case "nonterminal": {
      const replacement = composed.get(node.name);
      if (!replacement) return node;
      const inner = cloneNode(replacement.child);
      return mode === "grouped" ? group(inner, node.name) : inner;
    }
    case "sequence":
      return {
        ...node,
        children: node.children.map((child) => substitute(child, composed, mode)),
      };
    case "choice":
      return {
        ...node,
        children: node.children.map((child) => substitute(child, composed, mode)),
      };
    case "optional":
      return { ...node, child: substitute(node.child, composed, mode) };
    case "repetition": {
      const next: Node = { ...node, child: substitute(node.child, composed, mode) };
      if (node.separator !== undefined) {
        (next as { separator: Node }).separator = substitute(node.separator, composed, mode);
      }
      return next;
    }
    case "group":
      return { ...node, child: substitute(node.child, composed, mode) };
    case "diagram":
      throw new TypeError("composeRule: encountered nested Diagram node — IR invariant violated");
    case "terminal":
    case "special":
    case "comment":
    case "start":
    case "end":
    case "skip":
      return node;
  }
}

function cloneNode(node: Node): Node {
  switch (node.kind) {
    case "sequence":
      return { ...node, children: node.children.map(cloneNode) };
    case "choice":
      return { ...node, children: node.children.map(cloneNode) };
    case "optional":
      return { ...node, child: cloneNode(node.child) };
    case "repetition": {
      const next: Node = { ...node, child: cloneNode(node.child) };
      if (node.separator !== undefined) {
        (next as { separator: Node }).separator = cloneNode(node.separator);
      }
      return next;
    }
    case "group":
      return { ...node, child: cloneNode(node.child) };
    case "diagram":
      return { ...node, child: cloneNode(node.child) };
    case "terminal":
    case "nonterminal":
    case "special":
    case "comment":
    case "start":
    case "end":
    case "skip":
      return { ...node };
  }
}
