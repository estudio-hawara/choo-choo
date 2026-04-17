import { describe, expect, it } from "vitest";
import { diagram, terminal } from "./builder.js";
import type { GrammarParser, GrammarRule, ParsedGrammar } from "./grammar.js";

describe("GrammarRule / ParsedGrammar shape", () => {
  it("builds a minimal ParsedGrammar around a single rule", () => {
    const rule: GrammarRule = {
      name: "zero",
      diagram: diagram(terminal("0")),
    };
    const grammar: ParsedGrammar = { rules: [rule] };
    expect(grammar.rules).toHaveLength(1);
    expect(grammar.rules[0]?.name).toBe("zero");
    expect(grammar.rules[0]?.diagram.kind).toBe("diagram");
  });

  it("accepts an optional source range on a rule", () => {
    const rule: GrammarRule = {
      name: "foo",
      diagram: diagram(terminal("x")),
      source: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 10, line: 1, column: 11 },
      },
    };
    expect(rule.source?.end.offset).toBe(10);
  });
});

describe("GrammarParser contract", () => {
  it("allows a minimal implementation", () => {
    const parser: GrammarParser = {
      id: "test",
      parse(source: string): ParsedGrammar {
        return {
          rules: [{ name: source, diagram: diagram(terminal(source)) }],
        };
      },
    };
    const result = parser.parse("hello");
    expect(parser.id).toBe("test");
    expect(result.rules[0]?.name).toBe("hello");
    expect(result.rules[0]?.diagram.child.kind).toBe("terminal");
  });
});
