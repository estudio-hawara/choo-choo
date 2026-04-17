import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeRule, render } from "@choo-choo/core";
import { describe, expect, it } from "vitest";
import { pegParser } from "./parser.js";

const FIXTURE_PATH = fileURLToPath(new URL("../__fixtures__/arithmetics.pegjs", import.meta.url));

describe("PEG parser / arithmetics.pegjs smoke test", () => {
  const source = readFileSync(FIXTURE_PATH, "utf8");
  const grammar = pegParser.parse(source);

  it("parses the canonical rule set from peggy's arithmetics example", () => {
    expect(grammar.rules.map((r) => r.name)).toEqual([
      "Expression",
      "Term",
      "Factor",
      "Integer",
      "_",
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
