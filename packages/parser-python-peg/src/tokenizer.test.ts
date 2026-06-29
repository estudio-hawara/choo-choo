import { GrammarSyntaxError, type Token } from "@choo-choo/parser-utils";
import { describe, expect, it } from "vitest";
import { type PythonPegTokenType, createPythonPegTokenizer } from "./tokenizer.js";

function tokenize(source: string): Token<PythonPegTokenType>[] {
  const tokenizer = createPythonPegTokenizer(source);
  const tokens: Token<PythonPegTokenType>[] = [];
  for (;;) {
    const token = tokenizer.next();
    if (token === null) break;
    tokens.push(token);
  }
  return tokens;
}

describe("Python PEG tokenizer / operators", () => {
  it("recognises every single-char operator", () => {
    const types = tokenize(": | ( ) [ ] ? * + & ! ~ .").map((t) => t.type);
    expect(types).toEqual([
      "COLON",
      "PIPE",
      "LPAREN",
      "RPAREN",
      "LBRACKET",
      "RBRACKET",
      "QUESTION",
      "STAR",
      "PLUS",
      "AMP",
      "BANG",
      "TILDE",
      "DOT",
    ]);
  });

  it("lexes && as a single AMPAMP token, not two AMPs", () => {
    const tokens = tokenize("&& &");
    expect(tokens.map((t) => t.type)).toEqual(["AMPAMP", "AMP"]);
  });

  it("lexes ... as a single ELLIPSIS token, not three DOTs", () => {
    const tokens = tokenize("... .");
    expect(tokens.map((t) => t.type)).toEqual(["ELLIPSIS", "DOT"]);
  });

  it("keeps a single . as DOT for the separator binder", () => {
    const tokens = tokenize("','.x+");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["STRING", "','"],
      ["DOT", "."],
      ["NAME", "x"],
      ["PLUS", "+"],
    ]);
  });
});

describe("Python PEG tokenizer / literals", () => {
  it("captures a single-quoted string as STRING (hard keyword)", () => {
    const [token] = tokenize("'if'");
    expect(token?.type).toBe("STRING");
    expect(token?.value).toBe("'if'");
  });

  it("captures a double-quoted string as DSTRING (soft keyword)", () => {
    const [token] = tokenize('"match"');
    expect(token?.type).toBe("DSTRING");
    expect(token?.value).toBe('"match"');
  });

  it("handles escapes inside strings without closing early", () => {
    const [single] = tokenize("'it\\'s'");
    expect(single?.value).toBe("'it\\'s'");
    const [double] = tokenize('"he said \\"hi\\""');
    expect(double?.value).toBe('"he said \\"hi\\""');
  });
});

describe("Python PEG tokenizer / identifiers", () => {
  it("emits NAME for both lowercase and uppercase identifiers", () => {
    const tokens = tokenize("expr NAME _foo X9 NEWLINE");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["NAME", "expr"],
      ["NAME", "NAME"],
      ["NAME", "_foo"],
      ["NAME", "X9"],
      ["NAME", "NEWLINE"],
    ]);
  });
});

describe("Python PEG tokenizer / whitespace and comments", () => {
  it("skips whitespace between tokens", () => {
    const tokens = tokenize("  a  :  'x'  ");
    expect(tokens.map((t) => t.type)).toEqual(["NAME", "COLON", "STRING"]);
  });

  it("skips # line comments", () => {
    const tokens = tokenize("# leading comment\na: 'x'  # trailing\n");
    expect(tokens.map((t) => t.type)).toEqual(["NAME", "COLON", "STRING"]);
  });

  it("does not treat a # inside a string as a comment", () => {
    const tokens = tokenize(`a: '#not-a-comment'`);
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["NAME", "a"],
      ["COLON", ":"],
      ["STRING", "'#not-a-comment'"],
    ]);
  });
});

describe("Python PEG tokenizer / errors", () => {
  it("raises GrammarSyntaxError on an unexpected character", () => {
    let error: unknown;
    try {
      tokenize("a: $");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain(`unexpected character "$"`);
    }
  });

  it("raises on an unterminated single-quoted string", () => {
    let error: unknown;
    try {
      tokenize("a: 'never closed");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unterminated string literal");
    }
  });

  it("raises on an unterminated double-quoted string", () => {
    let error: unknown;
    try {
      tokenize(`a: "never closed`);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GrammarSyntaxError);
    if (error instanceof GrammarSyntaxError) {
      expect(error.message).toContain("unterminated string literal");
    }
  });
});
