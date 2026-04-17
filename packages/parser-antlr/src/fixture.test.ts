import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeRule, render } from "@choo-choo/core";
import { describe, expect, it } from "vitest";
import { antlrParser } from "./parser.js";

const FIXTURE_PATH = fileURLToPath(new URL("../__fixtures__/JSON.g4", import.meta.url));

describe("ANTLR parser / JSON.g4 smoke test", () => {
  const source = readFileSync(FIXTURE_PATH, "utf8");
  const grammar = antlrParser.parse(source);

  it("parses the canonical rule set from antlr/grammars-v4 JSON.g4", () => {
    expect(grammar.rules.map((r) => r.name)).toEqual([
      "json",
      "obj",
      "pair",
      "arr",
      "value",
      "STRING",
      "ESC",
      "UNICODE",
      "HEX",
      "SAFECODEPOINT",
      "NUMBER",
      "INT",
      "EXP",
      "WS",
    ]);
  });

  it("renders every rule's diagram as a non-empty SVG string", () => {
    for (const rule of grammar.rules) {
      const svg = render(rule.diagram);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.length).toBeGreaterThan(50);
    }
  });

  it("renders every rule with compose='grouped' without errors", () => {
    for (const rule of grammar.rules) {
      const composed = composeRule(grammar, rule.name, "grouped");
      const svg = render(composed);
      expect(svg.startsWith("<svg ")).toBe(true);
    }
  });
});
