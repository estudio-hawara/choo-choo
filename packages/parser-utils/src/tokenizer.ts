import type { SourceRange } from "@choo-choo/core";
import { GrammarSyntaxError } from "./errors.js";
import type { Reader } from "./reader.js";
import type { Specification } from "./specification.js";

export interface Token<T extends string> {
  type: T;
  value: string;
  source: SourceRange;
}

export class Tokenizer<T extends string> {
  constructor(
    private readonly reader: Reader,
    private readonly specification: Specification<T>,
  ) {}

  next(): Token<T> | null {
    while (!this.reader.isAtEnd()) {
      const start = this.reader.position;
      const match = this.specification.match(this.reader.rest());
      if (match === null) {
        throw new GrammarSyntaxError(
          `unexpected character "${this.reader.current()}" at line ${start.line}, column ${start.column}`,
          start,
        );
      }
      this.reader.advance(match.value.length);
      if (match.type === null) continue;
      const end = this.reader.position;
      return { type: match.type, value: match.value, source: { start, end } };
    }
    return null;
  }
}
