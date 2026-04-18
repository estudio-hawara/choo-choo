import { describe, expect, it } from "vitest";
import { Specification } from "./specification.js";

type SimpleType = "word" | "digit" | "plus";

describe("Specification", () => {
  it("starts with no rules and no matches", () => {
    const spec = new Specification<SimpleType>();
    expect(spec.rules).toHaveLength(0);
    expect(spec.match("anything")).toBeNull();
  });

  it("add() is chainable and preserves insertion order", () => {
    const spec = new Specification<SimpleType>()
      .add(/^\d+/, "digit")
      .add(/^\+/, "plus")
      .add(/^\w+/, "word");
    expect(spec.rules).toHaveLength(3);
    expect(spec.rules[0]?.type).toBe("digit");
    expect(spec.rules[2]?.type).toBe("word");
  });

  it("rejects patterns that are not anchored at the start", () => {
    const spec = new Specification<SimpleType>();
    expect(() => spec.add(/\d+/, "digit")).toThrow(/must be anchored with \^/);
  });

  it("returns the first matching rule (order matters)", () => {
    // Without the digit rule first, \w+ would eat '123' as a word.
    const spec = new Specification<SimpleType>().add(/^\d+/, "digit").add(/^\w+/, "word");
    expect(spec.match("123abc")).toEqual({ type: "digit", value: "123" });
    expect(spec.match("abc123")).toEqual({ type: "word", value: "abc123" });
  });

  it("returns null when no rule matches", () => {
    const spec = new Specification<SimpleType>().add(/^\d+/, "digit");
    expect(spec.match("abc")).toBeNull();
  });

  it("preserves null type for skippable rules (whitespace / comments)", () => {
    const spec = new Specification<SimpleType>().add(/^\s+/, null);
    expect(spec.match("   x")).toEqual({ type: null, value: "   " });
  });
});
