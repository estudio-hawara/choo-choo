import { describe, expect, it } from "vitest";
import {
  choice,
  diagram,
  nonTerminal,
  sequence,
  special,
  terminal,
  zeroOrMore,
} from "./builder.js";
import { composeRule } from "./composition.js";
import type { ParsedGrammar } from "./grammar.js";
import type { Node } from "./ir.js";

function findRule(grammar: ParsedGrammar, name: string) {
  const rule = grammar.rules.find((candidate) => candidate.name === name);
  if (!rule) throw new Error(`test fixture: rule "${name}" missing`);
  return rule;
}

// Mirrors the 5-rule EBNF fixture from docs/composition.md:
//   digit      = ? 0-9 ?;
//   number     = digit , { digit };
//   expression = term , { ("+" | "-") , term };
//   term       = factor , { ("*" | "/") , factor };
//   factor     = number | "(" , expression , ")";
// Built manually so this test doesn't reach into @choo-choo/parser-ebnf
// (that would create a cyclic dep — parser-ebnf depends on core).
function buildFixture(): ParsedGrammar {
  return {
    rules: [
      { name: "digit", diagram: diagram(special(" 0-9 ")) },
      {
        name: "number",
        diagram: diagram(sequence(nonTerminal("digit"), zeroOrMore(nonTerminal("digit")))),
      },
      {
        name: "expression",
        diagram: diagram(
          sequence(
            nonTerminal("term"),
            zeroOrMore(sequence(choice(terminal("+"), terminal("-")), nonTerminal("term"))),
          ),
        ),
      },
      {
        name: "term",
        diagram: diagram(
          sequence(
            nonTerminal("factor"),
            zeroOrMore(sequence(choice(terminal("*"), terminal("/")), nonTerminal("factor"))),
          ),
        ),
      },
      {
        name: "factor",
        diagram: diagram(
          choice(
            nonTerminal("number"),
            sequence(terminal("("), nonTerminal("expression"), terminal(")")),
          ),
        ),
      },
    ],
  };
}

describe("composeRule / mode: no", () => {
  it("returns each rule's diagram unchanged (identity)", () => {
    const grammar = buildFixture();
    for (const rule of grammar.rules) {
      expect(composeRule(grammar, rule.name, "no")).toBe(rule.diagram);
    }
  });
});

describe("composeRule / mode: yes", () => {
  it("inlines a single prior rule (digit into number)", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "number", "yes");
    expect(composed).toEqual({
      kind: "diagram",
      child: {
        kind: "sequence",
        children: [
          { kind: "special", text: " 0-9 " },
          {
            kind: "optional",
            skip: "top",
            child: {
              kind: "repetition",
              child: { kind: "special", text: " 0-9 " },
            },
          },
        ],
      },
    });
  });

  it("leaves forward references untouched (term inside expression)", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "expression", "yes");
    const original = findRule(grammar, "expression").diagram;
    // Expression only references `term`, which is defined AFTER expression in
    // source order, so nothing is substituted.
    expect(composed).toEqual(original);
  });

  it("substitutes prior rules recursively (factor inlines number and expression)", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "factor", "yes");
    const child = composed.child as { kind: "choice"; children: Node[] };
    expect(child.kind).toBe("choice");

    // First branch: the composed `number` (digit already inlined inside).
    expect(child.children[0]).toEqual({
      kind: "sequence",
      children: [
        { kind: "special", text: " 0-9 " },
        {
          kind: "optional",
          skip: "top",
          child: {
            kind: "repetition",
            child: { kind: "special", text: " 0-9 " },
          },
        },
      ],
    });

    // Second branch: "(" composed-expression ")". The embedded expression
    // still has `term` as a NonTerminal because `term` was a forward ref
    // from expression's own perspective.
    const parens = child.children[1] as { kind: "sequence"; children: Node[] };
    expect(parens.kind).toBe("sequence");
    expect(parens.children).toHaveLength(3);
    expect(parens.children[0]).toEqual({ kind: "terminal", text: "(" });
    expect(parens.children[2]).toEqual({ kind: "terminal", text: ")" });

    const originalExpression = findRule(grammar, "expression").diagram.child;
    expect(parens.children[1]).toEqual(originalExpression);

    const firstChildOfExpression = (parens.children[1] as { children: Node[] }).children[0];
    expect(firstChildOfExpression).toEqual({
      kind: "nonterminal",
      name: "term",
    });
  });

  it("is a no-op when the target rule is the first rule", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "digit", "yes");
    expect(composed).toEqual({
      kind: "diagram",
      child: { kind: "special", text: " 0-9 " },
    });
  });

  it("produces independent subtrees for repeated substitutions (no aliasing)", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "number", "yes");
    const seq = composed.child as { kind: "sequence"; children: Node[] };
    const firstDigit = seq.children[0];
    const secondDigit = (seq.children[1] as { child: { child: Node } }).child.child;
    expect(firstDigit).toEqual(secondDigit);
    expect(firstDigit).not.toBe(secondDigit);
  });
});

describe("composeRule / mode: grouped", () => {
  it("wraps each substituted subtree in a Group labelled with the rule name", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "number", "grouped");
    expect(composed).toEqual({
      kind: "diagram",
      child: {
        kind: "sequence",
        children: [
          {
            kind: "group",
            label: "digit",
            child: { kind: "special", text: " 0-9 " },
          },
          {
            kind: "optional",
            skip: "top",
            child: {
              kind: "repetition",
              child: {
                kind: "group",
                label: "digit",
                child: { kind: "special", text: " 0-9 " },
              },
            },
          },
        ],
      },
    });
  });

  it("labels nested substitutions with the immediate rule name (not the root)", () => {
    const grammar = buildFixture();
    const composed = composeRule(grammar, "factor", "grouped");
    const choiceNode = composed.child as { kind: "choice"; children: Node[] };
    const numberBranch = choiceNode.children[0] as {
      kind: "group";
      label: string;
      child: Node;
    };
    expect(numberBranch.kind).toBe("group");
    expect(numberBranch.label).toBe("number");

    const numberInner = numberBranch.child as {
      kind: "sequence";
      children: Node[];
    };
    const firstDigit = numberInner.children[0] as {
      kind: "group";
      label: string;
    };
    expect(firstDigit.kind).toBe("group");
    expect(firstDigit.label).toBe("digit");
  });
});

describe("composeRule / errors", () => {
  it("throws when the target rule is unknown (mode: no)", () => {
    const grammar = buildFixture();
    expect(() => composeRule(grammar, "missing", "no")).toThrow(/rule "missing" not found/);
  });

  it("throws when the target rule is unknown (mode: yes)", () => {
    const grammar = buildFixture();
    expect(() => composeRule(grammar, "missing", "yes")).toThrow(/rule "missing" not found/);
  });

  it("throws on an invalid mode", () => {
    const grammar = buildFixture();
    expect(() => composeRule(grammar, "digit", "nope" as unknown as "no")).toThrow(/mode must be/);
  });
});
