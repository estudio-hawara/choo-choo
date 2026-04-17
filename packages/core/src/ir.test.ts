import { describe, expect, it } from "vitest";
import { ALL_NODE_KINDS, type Node, type NodeKind } from "./ir.js";

function kindOf(node: Node): NodeKind {
  switch (node.kind) {
    case "diagram":
      return node.kind;
    case "start":
      return node.kind;
    case "end":
      return node.kind;
    case "terminal":
      return node.kind;
    case "nonterminal":
      return node.kind;
    case "special":
      return node.kind;
    case "comment":
      return node.kind;
    case "sequence":
      return node.kind;
    case "choice":
      return node.kind;
    case "optional":
      return node.kind;
    case "repetition":
      return node.kind;
    case "group":
      return node.kind;
    case "skip":
      return node.kind;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

describe("IR", () => {
  it("ALL_NODE_KINDS contains every kind exactly once", () => {
    expect(new Set(ALL_NODE_KINDS).size).toBe(ALL_NODE_KINDS.length);
    expect(ALL_NODE_KINDS.length).toBe(13);
  });

  it("discriminates every kind via the `kind` field", () => {
    const samples: Node[] = [
      { kind: "diagram", child: { kind: "terminal", text: "x" } },
      { kind: "start", variant: "simple" },
      { kind: "end", variant: "complex" },
      { kind: "terminal", text: "x" },
      { kind: "nonterminal", name: "x" },
      { kind: "special", text: "x" },
      { kind: "comment", text: "x" },
      {
        kind: "sequence",
        children: [
          { kind: "terminal", text: "a" },
          { kind: "terminal", text: "b" },
        ],
      },
      {
        kind: "choice",
        children: [
          { kind: "terminal", text: "a" },
          { kind: "terminal", text: "b" },
        ],
      },
      { kind: "optional", child: { kind: "terminal", text: "x" }, skip: "top" },
      { kind: "repetition", child: { kind: "terminal", text: "x" } },
      { kind: "group", child: { kind: "terminal", text: "x" } },
      { kind: "skip" },
    ];

    const observed = samples.map(kindOf);
    expect(new Set(observed)).toEqual(new Set(ALL_NODE_KINDS));
  });

  it("accepts optional source metadata on any node", () => {
    const t: Node = {
      kind: "terminal",
      text: "x",
      source: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    };
    expect(t.source?.end.offset).toBe(1);
  });

  it("models a realistic grammar production as IR", () => {
    // assignment = identifier "=" expression
    const ir: Node = {
      kind: "diagram",
      child: {
        kind: "sequence",
        children: [
          { kind: "nonterminal", name: "identifier" },
          { kind: "terminal", text: "=" },
          { kind: "nonterminal", name: "expression" },
        ],
      },
    };
    expect(kindOf(ir)).toBe("diagram");
    if (ir.kind === "diagram" && ir.child.kind === "sequence") {
      expect(ir.child.children).toHaveLength(3);
    } else {
      throw new Error("narrowing failed");
    }
  });
});
