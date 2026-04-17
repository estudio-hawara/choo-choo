import type { Node } from "@choo-choo/core";
import { GrammarSyntaxError } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { antlrParser } from "./parser.js";

function parse(source: string) {
  return antlrParser.parse(source);
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

describe("ANTLR parser / identity", () => {
  it("exposes id = 'antlr'", () => {
    expect(antlrParser.id).toBe("antlr");
  });
});

describe("ANTLR parser / single rules", () => {
  it("parses a minimal rule with one string literal", () => {
    const grammar = parse(`one : '1' ;`);
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("one");
    expect(stripSource(grammar.rules[0]?.diagram)).toEqual({
      kind: "diagram",
      child: { kind: "terminal", text: "1" },
    });
  });

  it("decodes standard escapes in string literals", () => {
    const grammar = parse(`esc : '\\n' ;`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "terminal",
      text: "\n",
    });
  });

  it("treats an uppercase identifier as a nonterminal (token ref)", () => {
    const grammar = parse("stat : INT ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "INT",
    });
  });

  it("treats a lowercase identifier as a nonterminal (rule ref)", () => {
    const grammar = parse("stat : expr ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "expr",
    });
  });
});

describe("ANTLR parser / sequence, choice, grouping", () => {
  it("builds a sequence from juxtaposed elements", () => {
    const grammar = parse("r : a b c ;");
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
    const grammar = parse("r : a | b | c ;");
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
    const grammar = parse("r : a (b c) d ;");
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

describe("ANTLR parser / cardinalities", () => {
  it("maps a? to optional", () => {
    const grammar = parse("r : a ? ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("maps a* to optional(repetition(a)) — zero-or-more", () => {
    const grammar = parse("r : a * ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "optional",
      skip: "top",
      child: { kind: "repetition", child: { kind: "nonterminal", name: "a" } },
    });
  });

  it("maps a+ to repetition — one-or-more", () => {
    const grammar = parse("r : a + ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "nonterminal", name: "a" },
    });
  });

  it("accepts non-greedy suffixes and treats them as greedy", () => {
    const greedy = stripSource(parse("r : a *? ;").rules[0]?.diagram.child);
    const baseline = stripSource(parse("r : a * ;").rules[0]?.diagram.child);
    expect(greedy).toEqual(baseline);
  });
});

describe("ANTLR parser / lexer constructs", () => {
  it("keeps a charset as a single special node with its literal text", () => {
    const grammar = parse("ID : [a-zA-Z_] ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "[a-zA-Z_]",
    });
  });

  it("represents a wildcard `.` as special", () => {
    const grammar = parse("r : . ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: ".",
    });
  });

  it("keeps a char range 'a'..'z' as special with literal text", () => {
    const grammar = parse(`LOW : 'a'..'z' ;`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "'a'..'z'",
    });
  });

  it("keeps a tilde-charset ~[abc] as special with literal text", () => {
    const grammar = parse("NOT : ~[abc] ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "~[abc]",
    });
  });

  it("keeps a tilde-string ~'x' as special with literal text", () => {
    const grammar = parse(`NOT : ~'x' ;`);
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "special",
      text: "~'x'",
    });
  });
});

describe("ANTLR parser / top-level items", () => {
  it("accepts a bare grammar header", () => {
    const grammar = parse(`grammar Foo; r : 'x' ;`);
    expect(grammar.rules.map((r) => r.name)).toEqual(["r"]);
  });

  it("accepts a parser grammar header", () => {
    const grammar = parse(`parser grammar Foo; r : 'x' ;`);
    expect(grammar.rules.map((r) => r.name)).toEqual(["r"]);
  });

  it("accepts a lexer grammar header", () => {
    const grammar = parse(`lexer grammar Foo; R : 'x' ;`);
    expect(grammar.rules.map((r) => r.name)).toEqual(["R"]);
  });

  it("collects parser, lexer, and fragment rules together in source order", () => {
    const grammar = parse(`
      grammar Mix;
      expr : INT ;
      INT  : DIGIT+ ;
      fragment DIGIT : [0-9] ;
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["expr", "INT", "DIGIT"]);
  });

  it("consumes options, tokens, channels blocks", () => {
    const grammar = parse(`
      grammar Blk;
      options { tokenVocab = Foo; }
      tokens { INDENT, DEDENT }
      channels { COMMENTS }
      r : 'x' ;
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["r"]);
  });

  it("consumes at-commands, including scoped ones", () => {
    const grammar = parse(`
      grammar At;
      @header { package foo; }
      @lexer::members { int n; }
      r : 'x' ;
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["r"]);
  });

  it("consumes import and mode statements", () => {
    const grammar = parse(`
      grammar Im;
      import X, Y;
      mode DEFAULT_MODE;
      r : 'x' ;
    `);
    expect(grammar.rules.map((r) => r.name)).toEqual(["r"]);
  });
});

describe("ANTLR parser / strip-without-rendering", () => {
  it("strips element labels and renders only the RHS", () => {
    const grammar = parse("r : x=INT ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "INT",
    });
  });

  it("strips list-element labels (+=)", () => {
    const grammar = parse("r : xs+=INT ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "INT",
    });
  });

  it("strips alt labels", () => {
    const grammar = parse("r : INT # Number | ID # Ident ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "choice",
      children: [
        { kind: "nonterminal", name: "INT" },
        { kind: "nonterminal", name: "ID" },
      ],
    });
  });

  it("strips inline actions and semantic predicates", () => {
    const grammar = parse("r : { side_effect(); } INT { x > 0 }? ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "nonterminal",
      name: "INT",
    });
  });

  it("strips lexer commands after an alt body", () => {
    const grammar = parse("WS : [ \\t]+ -> skip ;");
    expect(stripSource(grammar.rules[0]?.diagram.child)).toEqual({
      kind: "repetition",
      child: { kind: "special", text: "[ \\t]" },
    });
  });

  it("strips chained lexer commands with arguments", () => {
    const grammar = parse(`COMMENT : '//' .*? '\\n' -> channel(HIDDEN), type(LINE_COMMENT) ;`);
    // The body is a sequence: '//', '.*?', '\n'. '.*?' is wildcard with non-greedy suffix.
    const child = grammar.rules[0]?.diagram.child;
    expect(child?.kind).toBe("sequence");
  });
});

describe("ANTLR parser / errors", () => {
  it("throws on a missing rule body terminator", () => {
    expect(() => parse(`r : 'x'`)).toThrow(GrammarSyntaxError);
  });

  it("throws on unbalanced braces in actions", () => {
    expect(() => parse(`r : 'x' { open only ;`)).toThrow(GrammarSyntaxError);
  });

  it("throws on an empty alternative", () => {
    expect(() => parse(`r : 'x' | ;`)).toThrow(/empty alternative/);
  });

  it("throws on an unknown top-level construct", () => {
    expect(() => parse(`! r : 'x' ;`)).toThrow(GrammarSyntaxError);
  });
});
