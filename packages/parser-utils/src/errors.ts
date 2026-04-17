import type { SourcePosition } from "@choo-choo/core";

export class GrammarSyntaxError extends SyntaxError {
  override name = "GrammarSyntaxError";
  readonly position: SourcePosition;

  constructor(message: string, position: SourcePosition) {
    super(message);
    this.position = position;
  }
}
