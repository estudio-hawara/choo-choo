import type { Node } from "@choo-choo/core";
import { GrammarSyntaxError } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { ebnfParser } from "./parser.js";

function parse(source: string) {
  return ebnfParser.parse(source);
}

function stripSource(node: Node): unknown {
  const { source: _source, ...rest } = node as Node & { source?: unknown };
  const clone: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(clone)) {
    if (Array.isArray(value)) {
      clone[key] = value.map((child) => stripSource(child as Node));
    } else if (value && typeof value === "object" && "kind" in (value as object)) {
      clone[key] = stripSource(value as Node);
    }
  }
  return clone;
}

describe("EBNF parser / single rules", () => {
  it("parses a minimal rule with one terminal", () => {
    const grammar = parse(`zero = "0";`);
    expect(grammar.rules).toHaveLength(1);
    const rule = grammar.rules[0];
    expect(rule?.name).toBe("zero");
    expect(stripSource(rule!.diagram)).toEqual({
      kind: "diagram",
      child: { kind: "terminal", text: "0" },
    });
  });

  it("strips quotes from terminals (both double and single)", () => {
    const grammar = parse(`both = "a" | 'b';`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "terminal", text: "a" },
        { kind: "terminal", text: "b" },
      ],
    });
  });

  it("treats an identifier as a nonterminal reference", () => {
    const grammar = parse(`expression = primary;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "primary",
    });
  });

  it("preserves the ? … ? contents verbatim (no trim)", () => {
    const grammar = parse(`atom = ? any regex ?;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "special",
      text: " any regex ",
    });
  });
});

describe("EBNF parser / sequence and choice", () => {
  it("flattens a three-element sequence into a single sequence node", () => {
    const grammar = parse(`triple = a , b , c;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("flattens a three-branch choice", () => {
    const grammar = parse(`tri = a | b | c;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("applies ISO precedence: | is outer, , is inner", () => {
    // a , b | c , d   →  (a , b) | (c , d)
    const grammar = parse(`expr = a , b | c , d;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "choice",
      children: [
        {
          kind: "sequence",
          children: [
            { kind: "nonterminal", name: "a" },
            { kind: "nonterminal", name: "b" },
          ],
        },
        {
          kind: "sequence",
          children: [
            { kind: "nonterminal", name: "c" },
            { kind: "nonterminal", name: "d" },
          ],
        },
      ],
    });
  });
});

describe("EBNF parser / optional, repetition, grouped", () => {
  it("maps [ A ] to optional with skip='top'", () => {
    const grammar = parse(`opt = [ a ];`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps { A } to optional(repetition(A)) — zero-or-more", () => {
    const grammar = parse(`zom = { a };`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: {
        kind: "repetition",
        child: { kind: "nonterminal", name: "a" },
      },
    });
  });

  it("treats ( A ) as transparent — no group node in the IR", () => {
    const grammar = parse(`grp = ( a | b );`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
      ],
    });
  });

  it("lets parentheses change precedence where needed", () => {
    // a , ( b | c ) , d   →  sequence with a three-child body whose middle is a choice
    const grammar = parse(`rule = a , ( b | c ) , d;`);
    expect(stripSource(grammar.rules[0]!.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "a" },
        {
          kind: "choice",
          children: [
            { kind: "nonterminal", name: "b" },
            { kind: "nonterminal", name: "c" },
          ],
        },
        { kind: "nonterminal", name: "d" },
      ],
    });
  });
});

describe("EBNF parser / multi-rule grammars and comments", () => {
  it("parses several rules in order", () => {
    const grammar = parse(`
      (* a two-rule grammar *)
      digit = "0" | "1";
      pair = digit , digit;
    `);
    expect(grammar.rules.map((rule) => rule.name)).toEqual(["digit", "pair"]);
  });

  it("accepts identifiers with internal spaces", () => {
    const grammar = parse(`right hand side = "x";`);
    expect(grammar.rules[0]?.name).toBe("right hand side");
  });
});

describe("EBNF parser / source ranges", () => {
  it("populates source on every produced node", () => {
    const grammar = parse(`zero = "0";`);
    const diagram = grammar.rules[0]!.diagram;
    expect(diagram.source).toBeDefined();
    expect(diagram.child.source).toBeDefined();
  });

  it("the rule source spans from the identifier through the terminating ;", () => {
    const grammar = parse(`a = "x";`);
    expect(grammar.rules[0]?.source).toEqual({
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 8, line: 1, column: 9 },
    });
  });

  it("a composite's source spans from its first to its last token", () => {
    const grammar = parse(`r = [ a , b ];`);
    const optionalNode = grammar.rules[0]!.diagram.child;
    expect(optionalNode.kind).toBe("optional");
    expect(optionalNode.source?.start.offset).toBe(4); // position of '['
    expect(optionalNode.source?.end.offset).toBe(13); // position just after ']'
  });
});

describe("EBNF parser / errors", () => {
  it("raises on a missing rule terminator", () => {
    let error: unknown;
    try {
      parse(`a = "x"`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unexpected end of input");
      expect(error.message).toContain("expected ;");
    }
  });

  it("raises on an unclosed optional", () => {
    let error: unknown;
    try {
      parse(`a = [ "x" ;`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("expected ]");
    }
  });

  it("raises on an invalid right-hand side start", () => {
    let error: unknown;
    try {
      parse(`a = ;`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unexpected ;");
      expect(error.message).toContain("expected an identifier, terminal");
    }
  });
});

describe("EBNF parser / end-to-end rendering", () => {
  it("produces IR that the core renderer accepts (integration smoke test)", async () => {
    const { render } = await import("@choo-choo/core");
    const grammar = parse(`expr = a , b | c , d;`);
    const svg = render(grammar.rules[0]!.diagram);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(`class="choice"`);
    expect(svg).toContain(`class="sequence"`);
  });
});
