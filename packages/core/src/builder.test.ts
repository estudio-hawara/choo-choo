import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  choice,
  comment,
  diagram,
  end,
  group,
  nonTerminal,
  oneOrMore,
  optional,
  sequence,
  skip,
  special,
  start,
  terminal,
  zeroOrMore,
} from "./builder.js";

describe("builder / leaves", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("terminal produces a minimal node with no extra fields", () => {
    const n = terminal("if");
    expect(n).toEqual({ kind: "terminal", text: "if" });
    expect("href" in n).toBe(false);
    expect("title" in n).toBe(false);
    expect("source" in n).toBe(false);
  });

  it("terminal attaches meta fields only when provided", () => {
    expect(terminal("if", { href: "/r#if" })).toEqual({
      kind: "terminal",
      text: "if",
      href: "/r#if",
    });
    expect(terminal("if", { title: "keyword" })).toEqual({
      kind: "terminal",
      text: "if",
      title: "keyword",
    });
    expect(terminal("if", { href: "/x", title: "y" })).toEqual({
      kind: "terminal",
      text: "if",
      href: "/x",
      title: "y",
    });
  });

  it("nonTerminal / special / comment follow the same shape", () => {
    expect(nonTerminal("expr")).toEqual({ kind: "nonterminal", name: "expr" });
    expect(special("?regex?")).toEqual({ kind: "special", text: "?regex?" });
    expect(comment("note")).toEqual({ kind: "comment", text: "note" });
  });

  it("rejects non-string leaf text with TypeError", () => {
    expect(() => terminal(123 as unknown as string)).toThrow(TypeError);
    expect(() => terminal(123 as unknown as string)).toThrow(
      /terminal: text must be a string, got number/,
    );
    expect(() => nonTerminal(null as unknown as string)).toThrow(/nonTerminal: name must be/);
  });

  it("warns on empty leaves but still returns a node", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    terminal("");
    nonTerminal("");
    special("");
    comment("");
    expect(warnSpy).toHaveBeenCalledTimes(4);
  });
});

describe("builder / start & end", () => {
  it("start accepts a variant and an optional label", () => {
    expect(start("simple")).toEqual({ kind: "start", variant: "simple" });
    expect(start("complex", "if-statement")).toEqual({
      kind: "start",
      variant: "complex",
      label: "if-statement",
    });
  });

  it("end accepts only the variant", () => {
    expect(end("simple")).toEqual({ kind: "end", variant: "simple" });
    expect(end("complex")).toEqual({ kind: "end", variant: "complex" });
  });

  it("rejects invalid variants", () => {
    expect(() => start("weird" as unknown as "simple")).toThrow(TypeError);
    expect(() => end("weird" as unknown as "simple")).toThrow(TypeError);
  });
});

describe("builder / sequence", () => {
  it("throws when called with zero children", () => {
    expect(() => sequence()).toThrow(/sequence: requires at least 1 child, got 0/);
  });

  it("unwraps a single child", () => {
    const t = terminal("x");
    expect(sequence(t)).toBe(t);
  });

  it("preserves order for 2+ children", () => {
    const a = terminal("a");
    const b = terminal("b");
    const c = terminal("c");
    const seq = sequence(a, b, c);
    expect(seq).toEqual({ kind: "sequence", children: [a, b, c] });
  });

  it("does not flatten nested sequences", () => {
    const inner = sequence(terminal("b"), terminal("c"));
    const outer = sequence(terminal("a"), inner);
    expect(outer.kind).toBe("sequence");
    if (outer.kind === "sequence") {
      expect(outer.children).toHaveLength(2);
      expect(outer.children[1]).toBe(inner);
    }
  });
});

describe("builder / choice", () => {
  const a = terminal("a");
  const b = terminal("b");
  const c = terminal("c");

  it("requires at least 2 children", () => {
    expect(() => choice()).toThrow(/requires at least 2 children, got 0/);
    expect(() => choice(a)).toThrow(/requires at least 2 children, got 1/);
    expect(() => choice({ normal: 0 })).toThrow(/requires at least 2 children, got 0/);
  });

  it("defaults to no `normal` (renderer picks the middle)", () => {
    const ch = choice(a, b, c);
    expect(ch).toEqual({ kind: "choice", children: [a, b, c] });
    expect("normal" in ch).toBe(false);
  });

  it("accepts an explicit normal index via the options overload", () => {
    const ch = choice({ normal: 0 }, a, b, c);
    expect(ch).toEqual({ kind: "choice", children: [a, b, c], normal: 0 });
  });

  it("rejects out-of-range normal", () => {
    expect(() => choice({ normal: -1 }, a, b)).toThrow(/out of range/);
    expect(() => choice({ normal: 2 }, a, b)).toThrow(/out of range/);
    expect(() => choice({ normal: 1.5 }, a, b)).toThrow(/out of range/);
  });
});

describe("builder / optional and repetition", () => {
  const x = terminal("x");
  const comma = terminal(",");

  it("optional defaults skip to 'top'", () => {
    expect(optional(x)).toEqual({ kind: "optional", child: x, skip: "top" });
  });

  it("optional honours an explicit skip", () => {
    expect(optional(x, "bottom")).toEqual({ kind: "optional", child: x, skip: "bottom" });
  });

  it("optional rejects an invalid skip", () => {
    expect(() => optional(x, "upwards" as unknown as "top")).toThrow(TypeError);
  });

  it("oneOrMore accepts an optional separator", () => {
    expect(oneOrMore(x)).toEqual({ kind: "repetition", child: x });
    expect(oneOrMore(x, comma)).toEqual({ kind: "repetition", child: x, separator: comma });
  });

  it("zeroOrMore desugars to optional(oneOrMore(...))", () => {
    const zom = zeroOrMore(x, comma);
    expect(zom).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "repetition", child: x, separator: comma },
    });
  });
});

describe("builder / group and skip", () => {
  it("group accepts an optional label", () => {
    const x = terminal("x");
    expect(group(x)).toEqual({ kind: "group", child: x });
    expect(group(x, "hint")).toEqual({ kind: "group", child: x, label: "hint" });
  });

  it("skip has no fields other than its kind", () => {
    expect(skip()).toEqual({ kind: "skip" });
  });
});

describe("builder / diagram", () => {
  it("wraps a child with default (absent) endpoints", () => {
    const d = diagram(terminal("x"));
    expect(d.kind).toBe("diagram");
    expect("start" in d).toBe(false);
    expect("end" in d).toBe(false);
  });

  it("accepts custom start and end", () => {
    const d = diagram(terminal("x"), {
      start: start("complex", "rule"),
      end: end("complex"),
    });
    expect(d.start).toEqual({ kind: "start", variant: "complex", label: "rule" });
    expect(d.end).toEqual({ kind: "end", variant: "complex" });
  });

  it("rejects a nested diagram", () => {
    const inner = diagram(terminal("x"));
    expect(() => diagram(inner)).toThrow(/diagrams don't nest/);
  });
});

describe("builder / realistic productions", () => {
  it("models identifier `=` expression", () => {
    const ir = diagram(
      sequence(nonTerminal("identifier"), terminal("="), nonTerminal("expression")),
    );
    expect(ir.kind).toBe("diagram");
    if (ir.child.kind !== "sequence") throw new Error("narrowing failed");
    expect(ir.child.children.map((c) => c.kind)).toEqual([
      "nonterminal",
      "terminal",
      "nonterminal",
    ]);
  });

  it("models a function call with optional comma-separated arguments", () => {
    const ir = diagram(
      sequence(
        nonTerminal("identifier"),
        terminal("("),
        optional(oneOrMore(nonTerminal("argument"), terminal(","))),
        terminal(")"),
      ),
    );
    expect(ir.kind).toBe("diagram");
  });

  it("models an if-then-else with a labelled complex endpoint", () => {
    const ir = diagram(
      sequence(
        terminal("if"),
        nonTerminal("condition"),
        terminal("then"),
        nonTerminal("body"),
        optional(sequence(terminal("else"), nonTerminal("body"))),
      ),
      { start: start("complex", "if-statement"), end: end("complex") },
    );
    expect(ir.start?.label).toBe("if-statement");
    expect(ir.end?.variant).toBe("complex");
  });
});
