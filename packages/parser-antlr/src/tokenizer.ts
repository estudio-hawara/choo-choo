import type { SourcePosition, SourceRange } from "@choo-choo/core";
import { GrammarSyntaxError, Reader, Specification, type Token } from "@choo-choo/parser-utils";

export type AntlrTokenType =
  | "COLON"
  | "SEMI"
  | "PIPE"
  | "LPAREN"
  | "RPAREN"
  | "QUESTION"
  | "STAR"
  | "PLUS"
  | "TILDE"
  | "DOTDOT"
  | "DOT"
  | "ASSIGN"
  | "PLUS_ASSIGN"
  | "ARROW"
  | "COMMA"
  | "HASH"
  | "AT"
  | "COLON_COLON"
  | "STRING"
  | "CHARSET"
  | "IDENTIFIER";

// Order matters: multi-char operators must come before their single-char prefixes.
export const antlrSpecification = new Specification<AntlrTokenType>()
  // Whitespace + comments — all silently skipped.
  .add(/^\s+/, null)
  .add(/^\/\/[^\r\n]*/, null)
  .add(/^\/\*[\s\S]*?\*\//, null)
  // Multi-char operators first.
  .add(/^->/, "ARROW")
  .add(/^\.\./, "DOTDOT")
  .add(/^\+=/, "PLUS_ASSIGN")
  .add(/^::/, "COLON_COLON")
  // Single-char operators.
  .add(/^:/, "COLON")
  .add(/^;/, "SEMI")
  .add(/^\|/, "PIPE")
  .add(/^\(/, "LPAREN")
  .add(/^\)/, "RPAREN")
  .add(/^\?/, "QUESTION")
  .add(/^\*/, "STAR")
  .add(/^\+/, "PLUS")
  .add(/^~/, "TILDE")
  .add(/^\./, "DOT")
  .add(/^=/, "ASSIGN")
  .add(/^,/, "COMMA")
  .add(/^#/, "HASH")
  .add(/^@/, "AT")
  // Literals.
  .add(/^'(?:\\.|[^'\\])*'/, "STRING")
  .add(/^\[(?:\\.|[^\]\\])*\]/, "CHARSET")
  // Identifiers (rule/token refs, also contextual keywords).
  .add(/^[A-Za-z_][A-Za-z0-9_]*/, "IDENTIFIER");

export class AntlrTokenizer {
  constructor(
    private readonly reader: Reader,
    private readonly specification: Specification<AntlrTokenType> = antlrSpecification,
  ) {}

  next(): Token<AntlrTokenType> | null {
    while (!this.reader.isAtEnd()) {
      const start = this.reader.position;
      const match = this.specification.match(this.reader.rest());
      if (match !== null) {
        this.reader.advance(match.value.length);
        if (match.type === null) continue;
        return {
          type: match.type,
          value: match.value,
          source: { start, end: this.reader.position },
        };
      }
      // Specification didn't match — is this a brace block we should skip?
      if (this.reader.current() === "{") {
        this.#scanBraceBlock(start);
        // Optional semantic-predicate "?" right after the closing "}".
        if (this.reader.current() === "?") this.reader.advance(1);
        continue;
      }
      // An unterminated block comment looks like `/*` with no closing `*/`.
      // The greedy spec regex won't match it, so we surface a clearer error here.
      if (this.reader.current() === "/" && this.reader.source[this.reader.offset + 1] === "*") {
        throw new GrammarSyntaxError("unterminated block comment", start);
      }
      throw new GrammarSyntaxError(
        `unexpected character "${this.reader.current()}" at line ${start.line}, column ${start.column}`,
        start,
      );
    }
    return null;
  }

  // Consume a balanced `{ ... }` block, respecting nested braces, string
  // literals (single, double, backtick), line comments, and block comments.
  // Called when the outer loop has already confirmed `current()` is "{".
  #scanBraceBlock(blockStart: SourcePosition): void {
    this.reader.advance(1); // consume opening "{"
    let depth = 1;
    while (!this.reader.isAtEnd()) {
      const c = this.reader.current();
      if (c === "{") {
        depth++;
        this.reader.advance(1);
        continue;
      }
      if (c === "}") {
        this.reader.advance(1);
        depth--;
        if (depth === 0) return;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        this.#scanStringLiteral(c);
        continue;
      }
      if (c === "/") {
        const next = this.reader.source[this.reader.offset + 1];
        if (next === "/") {
          this.#skipLineComment();
          continue;
        }
        if (next === "*") {
          this.#skipBlockComment();
          continue;
        }
      }
      this.reader.advance(1);
    }
    throw new GrammarSyntaxError("unterminated braced block", blockStart);
  }

  #scanStringLiteral(quote: string): void {
    const start = this.reader.position;
    this.reader.advance(1); // opening quote
    while (!this.reader.isAtEnd()) {
      const c = this.reader.current();
      if (c === "\\") {
        // Consume the escape as two chars; if at end of source, stop.
        this.reader.advance(this.reader.offset + 2 <= this.reader.source.length ? 2 : 1);
        continue;
      }
      if (c === quote) {
        this.reader.advance(1);
        return;
      }
      this.reader.advance(1);
    }
    throw new GrammarSyntaxError("unterminated string literal", start);
  }

  #skipLineComment(): void {
    while (!this.reader.isAtEnd() && this.reader.current() !== "\n") {
      this.reader.advance(1);
    }
  }

  #skipBlockComment(): void {
    const start = this.reader.position;
    this.reader.advance(2); // consume "/*"
    while (!this.reader.isAtEnd()) {
      if (this.reader.current() === "*" && this.reader.source[this.reader.offset + 1] === "/") {
        this.reader.advance(2);
        return;
      }
      this.reader.advance(1);
    }
    throw new GrammarSyntaxError("unterminated block comment", start);
  }
}

export function createAntlrTokenizer(source: string): AntlrTokenizer {
  return new AntlrTokenizer(new Reader(source));
}

export type AntlrToken = Token<AntlrTokenType>;
export type { SourceRange };
