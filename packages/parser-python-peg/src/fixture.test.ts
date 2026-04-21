import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeRule, render } from "@choo-choo/core";
import { describe, expect, it } from "vitest";
import { pythonPegParser } from "./parser.js";

const FIXTURE_PATH = fileURLToPath(new URL("../__fixtures__/python-mini.gram", import.meta.url));

describe("Python PEG parser / python-mini.gram smoke test", () => {
  const source = readFileSync(FIXTURE_PATH, "utf8");
  const grammar = pythonPegParser.parse(source);

  it("parses the canonical rule set from the python-mini fixture", () => {
    expect(grammar.rules.map((r) => r.name)).toEqual([
      "soft_keyword",
      "boolean",
      "star_targets",
      "maybe_name",
      "import_from_as_names",
      "arguments",
      "for_stmt",
      "pattern_capture_target",
      "eager_demo",
      "expression",
      "disjunction",
      "conjunction",
      "inversion",
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
