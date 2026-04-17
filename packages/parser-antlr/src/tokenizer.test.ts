import { GrammarSyntaxError, type Token } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { type AntlrTokenType, createAntlrTokenizer } from "./tokenizer.js";

function tokenize(source: string): Token<AntlrTokenType>[] {
  const tokenizer = createAntlrTokenizer(source);
  const tokens: Token<AntlrTokenType>[] = [];
  for (;;) {
    const token = tokenizer.next();
    if (token === null) break;
    tokens.push(token);
  }
  return tokens;
}

describe("ANTLR tokenizer / operators", () => {
  it("recognises every single-char operator", () => {
    const types = tokenize(": ; | ( ) ? * + ~ . = , # @").map((t) => t.type);
    expect(types).toEqual([
      "COLON",
      "SEMI",
      "PIPE",
      "LPAREN",
      "RPAREN",
      "QUESTION",
      "STAR",
      "PLUS",
      "TILDE",
      "DOT",
      "ASSIGN",
      "COMMA",
      "HASH",
      "AT",
    ]);
  });

  it("prefers multi-char operators over their single-char prefixes", () => {
    const types = tokenize("-> .. += ::").map((t) => t.type);
    expect(types).toEqual(["ARROW", "DOTDOT", "PLUS_ASSIGN", "COLON_COLON"]);
  });
});

describe("ANTLR tokenizer / literals", () => {
  it("captures a simple string literal with its quotes", () => {
    const [token] = tokenize(`'hello'`);
    expect(token?.type).toBe("STRING");
    expect(token?.value).toBe(`'hello'`);
  });

  it("handles escapes inside a string literal without closing early", () => {
    const [token] = tokenize(`'it\\'s'`);
    expect(token?.type).toBe("STRING");
    expect(token?.value).toBe(`'it\\'s'`);
  });

  it("captures a charset as a single CHARSET token", () => {
    const [token] = tokenize("[a-zA-Z_]");
    expect(token?.type).toBe("CHARSET");
    expect(token?.value).toBe("[a-zA-Z_]");
  });

  it("handles escapes inside a charset", () => {
    const [token] = tokenize("[\\]\\\\]");
    expect(token?.type).toBe("CHARSET");
    expect(token?.value).toBe("[\\]\\\\]");
  });
});

describe("ANTLR tokenizer / identifiers and keywords", () => {
  it("emits IDENTIFIER for both upper- and lowercase names", () => {
    const tokens = tokenize("foo BAR _baz X9");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["IDENTIFIER", "foo"],
      ["IDENTIFIER", "BAR"],
      ["IDENTIFIER", "_baz"],
      ["IDENTIFIER", "X9"],
    ]);
  });

  it("keyword-like names are tokenised as plain IDENTIFIERs", () => {
    // Contextual keywords: the parser distinguishes by value.
    const tokens = tokenize("grammar parser lexer fragment options tokens channels import mode");
    expect(tokens.every((t) => t.type === "IDENTIFIER")).toBe(true);
  });
});

describe("ANTLR tokenizer / whitespace and comments", () => {
  it("skips whitespace between tokens", () => {
    const tokens = tokenize(`  a  :  'x'  ;  `);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("skips line comments", () => {
    const tokens = tokenize(`// hello world\na : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("skips block comments, including doc comments", () => {
    const tokens = tokenize(`/** doc */ /* block */ a : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("tracks line/column correctly after newlines and comments", () => {
    const tokens = tokenize(`a\n// c\n: 'x' ;`);
    expect(tokens[0]?.source.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(tokens[1]?.type).toBe("COLON");
    expect(tokens[1]?.source.start.line).toBe(3);
  });
});

describe("ANTLR tokenizer / balanced-brace skipping", () => {
  it("silently consumes an action with no inner braces", () => {
    const tokens = tokenize(`a { doStuff(); } : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("handles nested braces", () => {
    const tokens = tokenize(`a { if (x) { y(); } } : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("respects string literals containing stray braces", () => {
    const tokens = tokenize(`a { s = "{ not real }"; } : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("respects single-quoted strings containing stray braces", () => {
    const tokens = tokenize(`a { s = '{'; } : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("consumes a trailing `?` for semantic predicates", () => {
    const tokens = tokenize(`a : 'x' { n > 0 }? ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });

  it("skips comments inside a braced block", () => {
    const tokens = tokenize(`a { /* }}} */ // }}}\n x; } : 'x' ;`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "COLON", "STRING", "SEMI"]);
  });
});

describe("ANTLR tokenizer / errors", () => {
  it("raises GrammarSyntaxError on an unexpected character", () => {
    let error: unknown;
    try {
      tokenize("a : $ ;");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain(`unexpected character "$"`);
    }
  });

  it("raises on an unterminated braced block", () => {
    let error: unknown;
    try {
      tokenize(`a : 'x' { oops ;`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unterminated braced block");
    }
  });

  it("raises on an unterminated block comment", () => {
    let error: unknown;
    try {
      tokenize(`a : 'x' /* not closed`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unterminated block comment");
    }
  });

  it("raises on an unterminated string inside a braced block", () => {
    // Lexer commands not involved — purely an action with a bad string.
    let error: unknown;
    try {
      tokenize(`a : 'x' { s = "unterminated ;`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
  });
});
