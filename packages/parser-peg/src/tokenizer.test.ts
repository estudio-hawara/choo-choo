import { GrammarSyntaxError, type Token } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { type PegTokenType, createPegTokenizer } from "./tokenizer.js";

function tokenize(source: string): Token<PegTokenType>[] {
  const tokenizer = createPegTokenizer(source);
  const tokens: Token<PegTokenType>[] = [];
  for (;;) {
    const token = tokenizer.next();
    if (token === null) break;
    tokens.push(token);
  }
  return tokens;
}

describe("PEG tokenizer / operators", () => {
  it("recognises every single-char operator", () => {
    const types = tokenize("= / ( ) ? * + & ! . : @").map((t) => t.type);
    expect(types).toEqual([
      "ASSIGN",
      "SLASH",
      "LPAREN",
      "RPAREN",
      "QUESTION",
      "STAR",
      "PLUS",
      "AMP",
      "BANG",
      "DOT",
      "COLON",
      "AT",
    ]);
  });
});

describe("PEG tokenizer / literals", () => {
  it("captures a single-quoted string", () => {
    const [token] = tokenize("'hello'");
    expect(token?.type).toBe("STRING");
    expect(token?.value).toBe("'hello'");
  });

  it("captures a double-quoted string", () => {
    const [token] = tokenize('"hello"');
    expect(token?.type).toBe("STRING");
    expect(token?.value).toBe('"hello"');
  });

  it("handles escapes inside strings without closing early", () => {
    const [single] = tokenize("'it\\'s'");
    expect(single?.value).toBe("'it\\'s'");
    const [double] = tokenize('"he said \\"hi\\""');
    expect(double?.value).toBe('"he said \\"hi\\""');
  });

  it("captures a charset as a single CHARSET token", () => {
    const [token] = tokenize("[a-zA-Z_]");
    expect(token?.type).toBe("CHARSET");
    expect(token?.value).toBe("[a-zA-Z_]");
  });

  it("captures a negated charset", () => {
    const [token] = tokenize("[^abc]");
    expect(token?.type).toBe("CHARSET");
    expect(token?.value).toBe("[^abc]");
  });
});

describe("PEG tokenizer / identifiers", () => {
  it("emits IDENTIFIER for names and for the trailing 'i' flag", () => {
    const tokens = tokenize("foo _bar X9 i");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["IDENTIFIER", "foo"],
      ["IDENTIFIER", "_bar"],
      ["IDENTIFIER", "X9"],
      ["IDENTIFIER", "i"],
    ]);
  });
});

describe("PEG tokenizer / whitespace and comments", () => {
  it("skips whitespace between tokens", () => {
    const tokens = tokenize("  a  =  'x'  ");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("skips line comments", () => {
    const tokens = tokenize("// header\na = 'x'");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("skips block comments", () => {
    const tokens = tokenize("/* intro */ a = 'x'");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("does not confuse `/` with a comment when surrounded by operators", () => {
    const tokens = tokenize("a = 'x' / 'y'");
    expect(tokens.map((t) => t.type)).toEqual([
      "IDENTIFIER",
      "ASSIGN",
      "STRING",
      "SLASH",
      "STRING",
    ]);
  });
});

describe("PEG tokenizer / balanced-brace skipping", () => {
  it("silently consumes a semantic action after an alt", () => {
    const tokens = tokenize("a = 'x' { return 1; }");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("silently consumes a double-braced global initializer", () => {
    const tokens = tokenize("{{ function f() {} }} a = 'x'");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("silently consumes a per-parse initializer at the top of file", () => {
    const tokens = tokenize("{ let n = 0; } a = 'x'");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("respects string literals containing stray braces inside actions", () => {
    const tokens = tokenize(`a = 'x' { s = "{ not a brace }"; }`);
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });

  it("skips comments inside braced blocks", () => {
    const tokens = tokenize("a = 'x' { /* }}} */ // }}}\n x; }");
    expect(tokens.map((t) => t.type)).toEqual(["IDENTIFIER", "ASSIGN", "STRING"]);
  });
});

describe("PEG tokenizer / errors", () => {
  it("raises GrammarSyntaxError on an unexpected character", () => {
    let error: unknown;
    try {
      tokenize("a = $");
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
      tokenize("a = 'x' { open only");
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
      tokenize("a = 'x' /* never closed");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unterminated block comment");
    }
  });

  it("raises on an unterminated string literal", () => {
    let error: unknown;
    try {
      tokenize("a = 'never closed");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
  });
});
