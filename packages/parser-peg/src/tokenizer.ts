import type { SourcePosition } from "@choo-choo/core";
import { GrammarSyntaxError, Reader, Specification, type Token } from "@choo-choo/parser-utils";

export type PegTokenType =
  | "ASSIGN"
  | "SLASH"
  | "LPAREN"
  | "RPAREN"
  | "QUESTION"
  | "STAR"
  | "PLUS"
  | "AMP"
  | "BANG"
  | "DOT"
  | "COLON"
  | "AT"
  | "STRING"
  | "CHARSET"
  | "IDENTIFIER";

export const pegSpecification = new Specification<PegTokenType>()
  // Whitespace + line comments — silently skipped. Block comments are
  // handled directly by the tokenizer so we can surface "unterminated"
  // errors cleanly (the Specification regex would just fall through to the
  // `/` SLASH rule and produce misleading tokens instead).
  .add(/^\s+/, null)
  .add(/^\/\/[^\r\n]*/, null)
  // Single-char operators.
  .add(/^=/, "ASSIGN")
  .add(/^\//, "SLASH")
  .add(/^\(/, "LPAREN")
  .add(/^\)/, "RPAREN")
  .add(/^\?/, "QUESTION")
  .add(/^\*/, "STAR")
  .add(/^\+/, "PLUS")
  .add(/^&/, "AMP")
  .add(/^!/, "BANG")
  .add(/^\./, "DOT")
  .add(/^:/, "COLON")
  .add(/^@/, "AT")
  // Literals.
  .add(/^'(?:\\.|[^'\\])*'/, "STRING")
  .add(/^"(?:\\.|[^"\\])*"/, "STRING")
  .add(/^\[(?:\\.|[^\]\\])*\]/, "CHARSET")
  // Identifiers (rule refs; also the contextual `i` flag).
  .add(/^[A-Za-z_][A-Za-z0-9_]*/, "IDENTIFIER");

export class PegTokenizer {
  constructor(
    private readonly reader: Reader,
    private readonly specification: Specification<PegTokenType> = pegSpecification,
  ) {}

  next(): Token<PegTokenType> | null {
    while (!this.reader.isAtEnd()) {
      const start = this.reader.position;
      // Block comment needs manual handling so unterminated comments error
      // cleanly instead of being mis-tokenised as `SLASH STAR …`.
      if (this.reader.current() === "/" && this.reader.source[this.reader.offset + 1] === "*") {
        this.#skipBlockComment();
        continue;
      }
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
      // Specification didn't match — is this a brace block we should skip
      // (semantic action, per-parse initializer, or global `{{ ... }}` init)?
      if (this.reader.current() === "{") {
        this.#scanBraceBlock(start);
        continue;
      }
      throw new GrammarSyntaxError(
        `unexpected character "${this.reader.current()}" at line ${start.line}, column ${start.column}`,
        start,
      );
    }
    return null;
  }

  #scanBraceBlock(blockStart: SourcePosition): void {
    this.reader.advance(1);
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
    this.reader.advance(1);
    while (!this.reader.isAtEnd()) {
      const c = this.reader.current();
      if (c === "\\") {
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
    this.reader.advance(2);
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

export function createPegTokenizer(source: string): PegTokenizer {
  return new PegTokenizer(new Reader(source));
}

export type PegToken = Token<PegTokenType>;
