import { describe, expect, it } from "vitest";
import { GrammarSyntaxError } from "./errors.js";
import { Reader } from "./reader.js";
import { Specification } from "./specification.js";
import { Tokenizer } from "./tokenizer.js";

type T = "word" | "digit" | "plus";

function buildTokenizer(source: string): Tokenizer<T> {
  const spec = new Specification<T>()
    .add(/^\s+/, null)
    .add(/^\d+/, "digit")
    .add(/^\+/, "plus")
    .add(/^[A-Za-z]+/, "word");
  return new Tokenizer(new Reader(source), spec);
}

describe("Tokenizer", () => {
  it("returns null on empty input", () => {
    expect(buildTokenizer("").next()).toBeNull();
  });

  it("returns tokens one at a time with accurate source ranges", () => {
    const tokenizer = buildTokenizer("abc");
    const token = tokenizer.next();
    expect(token).toEqual({
      type: "word",
      value: "abc",
      source: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 3, line: 1, column: 4 },
      },
    });
    expect(tokenizer.next()).toBeNull();
  });

  it("skips null-typed rules (whitespace) and continues with the next real token", () => {
    const tokenizer = buildTokenizer("  abc");
    const token = tokenizer.next();
    expect(token?.value).toBe("abc");
    expect(token?.source.start).toEqual({ offset: 2, line: 1, column: 3 });
  });

  it("emits a stream of tokens for a multi-token input", () => {
    const tokenizer = buildTokenizer("12 + abc");
    const types: string[] = [];
    for (;;) {
      const token = tokenizer.next();
      if (token === null) break;
      types.push(token.type);
    }
    expect(types).toEqual(["digit", "plus", "word"]);
  });

  it("reports accurate line / column for tokens after a newline", () => {
    const tokenizer = buildTokenizer("abc\n  def");
    tokenizer.next(); // abc
    const token = tokenizer.next();
    expect(token).toEqual({
      type: "word",
      value: "def",
      source: {
        start: { offset: 6, line: 2, column: 3 },
        end: { offset: 9, line: 2, column: 6 },
      },
    });
  });

  it("throws GrammarSyntaxError on an unknown character, with the offending position", () => {
    const tokenizer = buildTokenizer("abc @ def");
    tokenizer.next(); // abc
    let error: unknown;
    try {
      tokenizer.next();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain(`unexpected character "@"`);
      expect(error.position).toEqual({ offset: 4, line: 1, column: 5 });
    }
  });
});
