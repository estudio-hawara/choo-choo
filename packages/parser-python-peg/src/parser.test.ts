import type { Node } from "@choo-choo/core";
import { GrammarSyntaxError } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { pythonPegParser } from "./parser.js";

function parse(source: string) {
  return pythonPegParser.parse(source);
}

function stripSource(node: Node | undefined): unknown {
  if (node === undefined) return undefined;
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

describe("Python PEG parser / identity", () => {
  it("exposes id = 'python-peg'", () => {
    expect(pythonPegParser.id).toBe("python-peg");
  });
});

describe("Python PEG parser / single rules", () => {
  it("parses a minimal rule with one hard keyword (no terminator)", () => {
    const grammar = parse(`one: 'one'`);
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("one");
    expect(stripSource(grammar.rules[0]?.diagram)).toEqual({
      kind: "diagram",
      child: { kind: "terminal", text: "one" },
    });
  });

  it('treats a soft keyword ("...") as a terminal with the same shape as a hard keyword', () => {
    const hard = parse(`r: 'match'`);
    const soft = parse(`r: "match"`);
    expect(stripSource(hard.rules[0]?.diagram.child)).toEqual(
      stripSource(soft.rules[0]?.diagram.child),
    );
  });

  it("decodes standard escapes in string literals", () => {
    const grammar = parse(`esc: '\\n\\t'`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "\n\t",
    });
  });

  it("treats an identifier as a nonterminal — both lowercase rules and uppercase tokens", () => {
    const lower = parse("start: expr");
    const upper = parse("start: NAME");
    expect(stripSource(lower.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "expr",
    });
    expect(stripSource(upper.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "NAME",
    });
  });
});

describe("Python PEG parser / multi-rule grammars", () => {
  it("collects all rules in source order without requiring terminators", () => {
    const grammar = parse(`
      start: expr
      expr:  'a' | 'b'
      nop:   'x'
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["start", "expr", "nop"]);
  });

  it("distinguishes an element identifier from the next rule head", () => {
    const grammar = parse(`
      a: b c
      b: '1'
      c: '2'
    `);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });
});

describe("Python PEG parser / sequence, choice, grouping", () => {
  it("builds a sequence from juxtaposed elements", () => {
    const grammar = parse("r: a b c");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("builds a choice across | alternatives", () => {
    const grammar = parse("r: a | b | c");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("accepts a leading | in front of the first alternative", () => {
    const grammar = parse(`
      boolean:
          | 'True'
          | 'False'
          | 'None'
    `);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "terminal", text: "True" },
        { kind: "terminal", text: "False" },
        { kind: "terminal", text: "None" },
      ],
    });
  });

  it("treats parentheses as transparent grouping", () => {
    const grammar = parse("r: a (b c) d");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "a" },
        {
          kind: "sequence",
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

describe("Python PEG parser / cardinalities", () => {
  it("maps a? to optional", () => {
    const grammar = parse("r: a?");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps [a] to optional (same shape as a?)", () => {
    const grammar = parse("r: [a]");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps a* to optional(repetition(a)) — zero-or-more", () => {
    const grammar = parse("r: a*");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "repetition", child: { kind: "nonterminal", name: "a" } },
    });
  });

  it("maps a+ to repetition — one-or-more", () => {
    const grammar = parse("r: a+");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps sep.elem+ to repetition with a separator", () => {
    const grammar = parse(`r: ','.NAME+`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "nonterminal", name: "NAME" },
      separator: { kind: "terminal", text: "," },
    });
  });

  it("supports [s.e+] (zero-or-more with separator) by wrapping in optional", () => {
    const grammar = parse(`r: [','.NAME+]`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: {
        kind: "repetition",
        child: { kind: "nonterminal", name: "NAME" },
        separator: { kind: "terminal", text: "," },
      },
    });
  });
});

describe("Python PEG parser / lookahead, eager parse, cut", () => {
  it("wraps &expr in a labelled group", () => {
    const grammar = parse(`r: &'x' a`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "group", label: "&", child: { kind: "terminal", text: "x" } },
        { kind: "nonterminal", name: "a" },
      ],
    });
  });

  it("wraps !expr in a labelled group", () => {
    const grammar = parse(`r: !'x' a`);
    const child = grammar.rules[0]?.diagram.child as { children: Node[] };
    expect(stripSource(child.children[0]!)).toEqual({
      kind: "group",
      label: "!",
      child: { kind: "terminal", text: "x" },
    });
  });

  it("wraps &&expr in a labelled group with the && label", () => {
    const grammar = parse(`r: &&'x' a`);
    const child = grammar.rules[0]?.diagram.child as { children: Node[] };
    expect(stripSource(child.children[0]!)).toEqual({
      kind: "group",
      label: "&&",
      child: { kind: "terminal", text: "x" },
    });
  });

  it("silently drops the cut operator (~)", () => {
    const grammar = parse(`r: 'for' ~ 'in'`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "terminal", text: "for" },
        { kind: "terminal", text: "in" },
      ],
    });
  });

  it("rejects a stray ~ that leaves the alt empty", () => {
    expect(() => parse("r: ~")).toThrow(GrammarSyntaxError);
  });
});

describe("Python PEG parser / comments", () => {
  it("skips comments between tokens", () => {
    const grammar = parse(`
      # the only rule
      r: 'x'  # trailing
    `);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "x",
    });
  });
});

describe("Python PEG parser / errors", () => {
  it("throws on a rule with no body", () => {
    expect(() => parse("r:")).toThrow(GrammarSyntaxError);
  });

  it("throws on a missing colon", () => {
    expect(() => parse(`r 'x'`)).toThrow(GrammarSyntaxError);
  });

  it("throws on an empty alternative", () => {
    expect(() => parse(`r: 'x' | `)).toThrow(GrammarSyntaxError);
  });

  it("throws on s.e* (separator with star is not supported)", () => {
    expect(() => parse(`r: ','.NAME*`)).toThrow(GrammarSyntaxError);
  });

  it("throws on s.e? (separator with question mark is not supported)", () => {
    expect(() => parse(`r: ','.NAME?`)).toThrow(GrammarSyntaxError);
  });

  it("throws on a return-type annotation (deferred construct)", () => {
    expect(() => parse(`start[mod_ty]: 'x'`)).toThrow(GrammarSyntaxError);
  });
});
