import type { SourcePosition } from "@choo-choo/core";

export class Reader {
  private _offset = 0;
  private _line = 1;
  private _column = 1;

  constructor(public readonly source: string) {}

  get offset(): number {
    return this._offset;
  }

  get line(): number {
    return this._line;
  }

  get column(): number {
    return this._column;
  }

  get position(): SourcePosition {
    return { offset: this._offset, line: this._line, column: this._column };
  }

  isAtEnd(): boolean {
    return this._offset >= this.source.length;
  }

  rest(): string {
    return this.source.slice(this._offset);
  }

  current(): string {
    return this.source[this._offset] ?? "";
  }

  advance(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.isAtEnd()) return;
      if (this.source[this._offset] === "\n") {
        this._line++;
        this._column = 1;
      } else {
        this._column++;
      }
      this._offset++;
    }
  }
}
