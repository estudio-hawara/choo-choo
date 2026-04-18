import { GrammarSyntaxError, type Token } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { type EbnfTokenType, createEbnfTokenizer } from "./tokenizer.js";

function tokenize(source: string): Token<EbnfTokenType>[] {
  const tokenizer = createEbnfTokenizer(source);
  const tokens: Token<EbnfTokenType>[] = [];
  for (;;) {
    const token = tokenizer.next();
    if (token === null) break;
    tokens.push(token);
  }
  return tokens;
}

describe("EBNF tokenizer / operators", () => {
  it("recognises every single-char operator", () => {
    const types = tokenize("= ( ) { } [ ] | , ;").map((token) => token.type);
    expect(types).toEqual(["=", "(", ")", "{", "}", "[", "]", "|", ",", ";"]);
  });
});

describe("EBNF tokenizer / literals", () => {
  it("captures a double-quoted terminal with its quotes", () => {
    const [token] = tokenize(`"hello"`);
    expect(token?.type).toBe("terminal");
    expect(token?.value).toBe(`"hello"`);
  });

  it("captures a single-quoted terminal", () => {
    const [token] = tokenize(`'hello'`);
    expect(token?.type).toBe("terminal");
    expect(token?.value).toBe(`'hello'`);
  });

  it("captures a special sequence, delimiters included", () => {
    const [token] = tokenize(`? any PCRE-compatible regex ?`);
    expect(token?.type).toBe("special");
    expect(token?.value).toBe(`? any PCRE-compatible regex ?`);
  });
});

describe("EBNF tokenizer / identifiers", () => {
  it("accepts a single letter", () => {
    const [token] = tokenize(`a`);
    expect(token).toEqual({
      type: "identifier",
      value: "a",
      source: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    });
  });

  it("accepts a multi-word identifier with internal spaces", () => {
    const [token] = tokenize(`right hand side`);
    expect(token?.type).toBe("identifier");
    expect(token?.value).toBe("right hand side");
  });

  it("does not swallow a trailing space", () => {
    // 'foo' should match; the trailing space then becomes whitespace and is skipped;
    // then '=' follows. Two tokens total.
    const tokens = tokenize(`foo =`);
    expect(tokens.map((token) => [token.type, token.value])).toEqual([
      ["identifier", "foo"],
      ["=", "="],
    ]);
  });
});

describe("EBNF tokenizer / whitespace and comments", () => {
  it("skips whitespace between tokens", () => {
    const tokens = tokenize(`  a   =   "x"  ;  `);
    expect(tokens.map((token) => token.type)).toEqual(["identifier", "=", "terminal", ";"]);
  });

  it("skips block comments, even multi-line", () => {
    const tokens = tokenize(`(* leading *) a (* between\nrule *) = "1";`);
    expect(tokens.map((token) => token.type)).toEqual(["identifier", "=", "terminal", ";"]);
  });

  it("tracks line / column correctly after newlines and comments", () => {
    const tokens = tokenize(`a\n(* c *)\n= "1";`);
    // a on line 1 col 1
    expect(tokens[0]?.source.start).toEqual({ offset: 0, line: 1, column: 1 });
    // '=' is on line 3 after the newline-comment-newline sequence
    expect(tokens[1]?.type).toBe("=");
    expect(tokens[1]?.source.start.line).toBe(3);
  });
});

describe("EBNF tokenizer / errors", () => {
  it("raises GrammarSyntaxError with the offending position", () => {
    let error: unknown;
    try {
      tokenize(`a = @;`);
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
