import type { Node } from "@choo-choo/core";
import { GrammarSyntaxError } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { pegParser } from "./parser.js";

function parse(source: string) {
  return pegParser.parse(source);
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

describe("PEG parser / identity", () => {
  it("exposes id = 'peg'", () => {
    expect(pegParser.id).toBe("peg");
  });
});

describe("PEG parser / single rules", () => {
  it("parses a minimal rule with one string literal (no terminator)", () => {
    const grammar = parse(`one = "1"`);
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("one");
    expect(stripSource(grammar.rules[0]?.diagram)).toEqual({
      kind: "diagram",
      child: { kind: "terminal", text: "1" },
    });
  });

  it("accepts single-quoted and double-quoted strings equivalently", () => {
    const singleQuoted = parse(`a = 'x'`);
    const doubleQuoted = parse(`a = "x"`);
    expect(stripSource(singleQuoted.rules[0]?.diagram.child)).toEqual(
      stripSource(doubleQuoted.rules[0]?.diagram.child),
    );
  });

  it("decodes standard escapes in string literals", () => {
    const grammar = parse(`esc = "\\n\\t"`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "\n\t",
    });
  });

  it("decodes \\uHHHH and \\u{...} escapes", () => {
    const grammar = parse(`u = "\\u00e9 \\u{1F600}"`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "é 😀",
    });
  });

  it("treats an identifier as a nonterminal rule reference", () => {
    const grammar = parse("start = expr");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "expr",
    });
  });
});

describe("PEG parser / multi-rule grammars", () => {
  it("collects all rules in source order without requiring terminators", () => {
    const grammar = parse(`
      start = expr
      expr  = "1" / "2"
      nop   = "x"
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["start", "expr", "nop"]);
  });

  it("distinguishes an element identifier from the next rule head", () => {
    const grammar = parse(`
      a = b c
      b = "1"
      c = "2"
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

describe("PEG parser / sequence, choice, grouping", () => {
  it("builds a sequence from juxtaposed elements", () => {
    const grammar = parse("r = a b c");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("builds a choice across / alternatives", () => {
    const grammar = parse("r = a / b / c");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "nonterminal", name: "a" },
        { kind: "nonterminal", name: "b" },
        { kind: "nonterminal", name: "c" },
      ],
    });
  });

  it("treats parentheses as transparent grouping", () => {
    const grammar = parse("r = a (b c) d");
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

describe("PEG parser / cardinalities", () => {
  it("maps a? to optional", () => {
    const grammar = parse("r = a?");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps a* to optional(repetition(a)) — zero-or-more", () => {
    const grammar = parse("r = a*");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "repetition", child: { kind: "nonterminal", name: "a" } },
    });
  });

  it("maps a+ to repetition — one-or-more", () => {
    const grammar = parse("r = a+");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "nonterminal", name: "a" },
    });
  });
});

describe("PEG parser / lookahead predicates", () => {
  it("wraps &expr in a labelled group", () => {
    const grammar = parse(`r = &"x" .`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "sequence",
      children: [
        {
          kind: "group",
          label: "&",
          child: { kind: "terminal", text: "x" },
        },
        { kind: "special", text: "." },
      ],
    });
  });

  it("wraps !expr in a labelled group", () => {
    const grammar = parse(`r = !"x" .`);
    const child = grammar.rules[0]?.diagram.child as { children: Node[] };
    // biome-ignore lint/style/noNonNullAssertion: sequence has two children by construction
    expect(stripSource(child.children[0]!)).toEqual({
      kind: "group",
      label: "!",
      child: { kind: "terminal", text: "x" },
    });
  });
});

describe("PEG parser / lexer-style atoms", () => {
  it("keeps a charset as a special node with its literal text", () => {
    const grammar = parse("r = [a-z]");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "[a-z]",
    });
  });

  it("keeps a negated charset", () => {
    const grammar = parse("r = [^abc]");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "[^abc]",
    });
  });

  it("renders wildcard . as special", () => {
    const grammar = parse("r = .");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: ".",
    });
  });

  it("appends /i to a case-insensitive string atom", () => {
    const grammar = parse(`r = "hello"i`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "hello/i",
    });
  });

  it("appends /i to a case-insensitive charset atom", () => {
    const grammar = parse("r = [a-z]i");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "[a-z]/i",
    });
  });
});

describe("PEG parser / strip-without-rendering", () => {
  it("strips element labels", () => {
    const grammar = parse(`r = x:"1"`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "1",
    });
  });

  it("strips @ pluck prefix", () => {
    const grammar = parse(`r = @"1"`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "1",
    });
  });

  it("strips @name:expr (pluck with label)", () => {
    const grammar = parse(`r = @x:"1"`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "1",
    });
  });

  it("drops semantic actions after an alt", () => {
    const grammar = parse(`r = "1" { return 1; }`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "1",
    });
  });

  it("drops per-parse and global initializers at top of file", () => {
    const grammar = parse(`
      {{ const g = 0; }}
      { let x = 0; }
      r = "1"
    `);
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("r");
  });

  it("skips comments between tokens", () => {
    const grammar = parse(`
      // the only rule
      r = /* inline */ "1"
    `);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "1",
    });
  });
});

describe("PEG parser / named rule display", () => {
  it('accepts and silently drops peggy\'s `name "display" = …` form', () => {
    const grammar = parse(`Integer "integer" = [0-9]+`);
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("Integer");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "special", text: "[0-9]" },
    });
  });
});

describe("PEG parser / errors", () => {
  it("throws on a rule with no body", () => {
    expect(() => parse("r =")).toThrow(GrammarSyntaxError);
  });

  it("throws on a missing `=`", () => {
    expect(() => parse(`r "x"`)).toThrow(GrammarSyntaxError);
  });

  it("throws on unterminated braced actions", () => {
    expect(() => parse(`r = "x" { still open`)).toThrow(GrammarSyntaxError);
  });

  it("throws on an empty alternative", () => {
    expect(() => parse(`r = "x" / `)).toThrow(GrammarSyntaxError);
  });
});
