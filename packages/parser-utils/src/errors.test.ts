import { describe, expect, it } from "vitest";
import { GrammarSyntaxError } from "./errors.js";

describe("GrammarSyntaxError", () => {
  const position = { offset: 4, line: 2, column: 3 };

  it("stores the message and position", () => {
    const error = new GrammarSyntaxError("unexpected token", position);
    expect(error.message).toBe("unexpected token");
    expect(error.position).toEqual(position);
  });

  it("is a SyntaxError subclass", () => {
    const error = new GrammarSyntaxError("x", position);
    expect(error).toBeInstanceOf(SyntaxError);
    expect(error).toBeInstanceOf(Error);
  });

  it("sets name to GrammarSyntaxError", () => {
    const error = new GrammarSyntaxError("x", position);
    expect(error.name).toBe("GrammarSyntaxError");
  });
});
