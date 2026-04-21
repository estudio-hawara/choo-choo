import { GrammarSyntaxError, Reader, Specification, type Token } from "@choo-choo/parser-utils";

export type PythonPegTokenType =
  | "COLON"
  | "PIPE"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "QUESTION"
  | "STAR"
  | "PLUS"
  | "AMPAMP"
  | "AMP"
  | "BANG"
  | "TILDE"
  | "DOT"
  | "STRING"
  | "DSTRING"
  | "NAME";

export const pythonPegSpecification = new Specification<PythonPegTokenType>()
  // Whitespace and `#` line comments — silently skipped. Python's PEG has no
  // block-comment form.
  .add(/^\s+/, null)
  .add(/^#[^\r\n]*/, null)
  // Single-char operators.
  .add(/^:/, "COLON")
  .add(/^\|/, "PIPE")
  .add(/^\(/, "LPAREN")
  .add(/^\)/, "RPAREN")
  .add(/^\[/, "LBRACKET")
  .add(/^\]/, "RBRACKET")
  .add(/^\?/, "QUESTION")
  .add(/^\*/, "STAR")
  .add(/^\+/, "PLUS")
  // `&&` must be tried before `&` so it does not lex as two AMP tokens.
  .add(/^&&/, "AMPAMP")
  .add(/^&/, "AMP")
  .add(/^!/, "BANG")
  .add(/^~/, "TILDE")
  .add(/^\./, "DOT")
  // Literals — Python uses single quotes for hard keywords (`'if'`) and
  // double quotes for soft keywords (`"match"`). Both are handled the same
  // way structurally; the parser preserves the token type so consumers can
  // tell them apart if they need to.
  .add(/^'(?:\\.|[^'\\])*'/, "STRING")
  .add(/^"(?:\\.|[^"\\])*"/, "DSTRING")
  // Identifiers — rule references (lowercase by convention) and token
  // references (uppercase: NAME, NUMBER, NEWLINE, …). Case is not enforced
  // here; both kinds reach the parser as the same token type.
  .add(/^[A-Za-z_][A-Za-z0-9_]*/, "NAME");

export class PythonPegTokenizer {
  constructor(
    private readonly reader: Reader,
    private readonly specification: Specification<PythonPegTokenType> = pythonPegSpecification,
  ) {}

  next(): Token<PythonPegTokenType> | null {
    while (!this.reader.isAtEnd()) {
      const start = this.reader.position;
      const match = this.specification.match(this.reader.rest());
      if (match !== null) {
        // Detect an unterminated string before we advance past it. The
        // specification regexes for STRING / DSTRING only match a fully
        // closed literal, so a stray opening quote will fall through to the
        // catch-all error below — but we want to surface it with a more
        // helpful message that points at the opening quote.
        this.reader.advance(match.value.length);
        if (match.type === null) continue;
        return {
          type: match.type,
          value: match.value,
          source: { start, end: this.reader.position },
        };
      }
      // No rule matched. Distinguish unterminated string literals from
      // genuinely unexpected characters so the user gets a useful message.
      const c = this.reader.current();
      if (c === "'" || c === '"') {
        throw new GrammarSyntaxError(
          `unterminated string literal at line ${start.line}, column ${start.column}`,
          start,
        );
      }
      throw new GrammarSyntaxError(
        `unexpected character "${c}" at line ${start.line}, column ${start.column}`,
        start,
      );
    }
    return null;
  }
}

export function createPythonPegTokenizer(source: string): PythonPegTokenizer {
  return new PythonPegTokenizer(new Reader(source));
}

export type PythonPegToken = Token<PythonPegTokenType>;
