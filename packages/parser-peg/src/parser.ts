import type {
  GrammarParser,
  GrammarRule,
  Node,
  ParsedGrammar,
  SourcePosition,
  SourceRange,
} from "@choo-choo/core";
import { GrammarSyntaxError, type Token } from "@choo-choo/parser-utils";
import {
  makeChoice,
  makeDiagram,
  makeGroup,
  makeNonTerminal,
  makeOptional,
  makeRepetition,
  makeSequence,
  makeSpecial,
  makeTerminal,
  makeZeroOrMore,
} from "./factory.js";
import { type PegTokenType, type PegTokenizer, createPegTokenizer } from "./tokenizer.js";

const START_POSITION: SourcePosition = { offset: 0, line: 1, column: 1 };

function spanOf(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange {
  if (!first || !last) throw new Error("unreachable: parser produced a node without source");
  return { start: first.start, end: last.end };
}

class PegParser {
  private lookahead: Token<PegTokenType> | null;
  private lastEndPosition: SourcePosition = START_POSITION;
  // Two-slot peek buffer: some rule-head disambiguations need to look past an
  // IDENTIFIER and a STRING (peggy's `name "display" = …`) before committing.
  private peekBuffer1: Token<PegTokenType> | null | undefined;
  private peekBuffer2: Token<PegTokenType> | null | undefined;

  constructor(private readonly tokenizer: PegTokenizer) {
    this.lookahead = tokenizer.next();
  }

  parseGrammar(): ParsedGrammar {
    const rules: GrammarRule[] = [];
    while (this.lookahead !== null) {
      rules.push(this.parseRule());
    }
    return { rules };
  }

  private parseRule(): GrammarRule {
    const nameToken = this.eat("IDENTIFIER");
    // Optional peggy "named rule display" — `name "display" = …`. The display
    // string is surfaced by peggy in error messages; it carries no structural
    // meaning for a railroad diagram, so we consume and discard it.
    if (this.currentType() === "STRING") {
      this.advance();
    }
    this.eat("ASSIGN");
    const body = this.parseExpression();
    const ruleSource: SourceRange = {
      start: nameToken.source.start,
      // biome-ignore lint/style/noNonNullAssertion: parseExpression always returns a node with source
      end: body.source!.end,
    };
    return {
      name: nameToken.value,
      diagram: makeDiagram(body, ruleSource),
      source: ruleSource,
    };
  }

  // alt ("/" alt)*
  private parseExpression(): Node {
    const first = this.parseAlt();
    const branches: Node[] = [first];
    while (this.currentType() === "SLASH") {
      this.advance();
      branches.push(this.parseAlt());
    }
    if (branches.length === 1) return first;
    return makeChoice(branches, spanOf(branches[0]?.source, branches[branches.length - 1]?.source));
  }

  // element* — stops at /, ), EOF, or a rule head (IDENT followed by =).
  private parseAlt(): Node {
    const elements: Node[] = [];
    while (this.canStartElement() && !this.atRuleHead()) {
      elements.push(this.parseElement());
    }
    if (elements.length === 0) {
      const pos = this.lookahead?.source.start ?? this.lastEndPosition;
      throw new GrammarSyntaxError(
        `empty alternative at line ${pos.line}, column ${pos.column}`,
        pos,
      );
    }
    if (elements.length === 1) {
      // biome-ignore lint/style/noNonNullAssertion: length === 1 guarantees index 0 exists
      return elements[0]!;
    }
    return makeSequence(
      elements,
      // biome-ignore lint/style/noNonNullAssertion: length >= 2 guarantees indices 0 and last exist
      spanOf(elements[0]!.source, elements[elements.length - 1]!.source),
    );
  }

  private canStartElement(): boolean {
    switch (this.currentType()) {
      case "IDENTIFIER":
      case "STRING":
      case "CHARSET":
      case "DOT":
      case "LPAREN":
      case "AMP":
      case "BANG":
      case "AT":
        return true;
      default:
        return false;
    }
  }

  private atRuleHead(): boolean {
    if (this.currentType() !== "IDENTIFIER") return false;
    const next = this.peekNextType();
    if (next === "ASSIGN") return true;
    // peggy's `name "display" = ...` form — three-token pattern.
    if (next === "STRING" && this.peekNext2Type() === "ASSIGN") return true;
    return false;
  }

  // [IDENT ":"] ["@"] ( "&" atom | "!" atom | atom [suffix] )
  private parseElement(): Node {
    // Strip element label if present: IDENTIFIER followed by COLON.
    if (this.currentType() === "IDENTIFIER" && this.peekNextType() === "COLON") {
      this.advance(); // name
      this.advance(); // ":"
    }
    // Strip pluck prefix.
    if (this.currentType() === "AT") {
      this.advance();
      // peggy also allows `@name:expr`; if the pluck wraps a labelled element,
      // strip the label too.
      if (this.currentType() === "IDENTIFIER" && this.peekNextType() === "COLON") {
        this.advance();
        this.advance();
      }
    }

    const predicate = this.currentType();
    if (predicate === "AMP" || predicate === "BANG") {
      // biome-ignore lint/style/noNonNullAssertion: currentType() returned a string, so lookahead is non-null
      const predicateToken = this.lookahead!;
      this.advance();
      const atom = this.parseAtom();
      const label = predicate === "AMP" ? "&" : "!";
      return makeGroup(atom, label, {
        start: predicateToken.source.start,
        // biome-ignore lint/style/noNonNullAssertion: parseAtom always produces a node with source
        end: atom.source!.end,
      });
    }

    const atom = this.parseAtom();
    return this.maybeWrapSuffix(atom);
  }

  private maybeWrapSuffix(atom: Node): Node {
    const t = this.currentType();
    if (t !== "QUESTION" && t !== "STAR" && t !== "PLUS") return atom;
    // biome-ignore lint/style/noNonNullAssertion: currentType() returned a string, so lookahead is non-null
    const suffixToken = this.lookahead!;
    this.advance();
    // biome-ignore lint/style/noNonNullAssertion: atom from parseAtom always has source
    const span: SourceRange = { start: atom.source!.start, end: suffixToken.source.end };
    switch (t) {
      case "QUESTION":
        return makeOptional(atom, span);
      case "STAR":
        return makeZeroOrMore(atom, span);
      case "PLUS":
        return makeRepetition(atom, span);
    }
  }

  private parseAtom(): Node {
    const token = this.lookahead;
    if (token === null) {
      throw new GrammarSyntaxError(
        "unexpected end of input; expected an atom",
        this.lastEndPosition,
      );
    }
    switch (token.type) {
      case "STRING": {
        this.advance();
        const decoded = decodePegString(token.value);
        const { text, source } = this.maybeConsumeCaseInsensitiveFlag(decoded, token.source);
        return makeTerminal(text, source);
      }
      case "CHARSET": {
        this.advance();
        const { text, source } = this.maybeConsumeCaseInsensitiveFlag(token.value, token.source);
        return makeSpecial(text, source);
      }
      case "DOT": {
        this.advance();
        return makeSpecial(".", token.source);
      }
      case "IDENTIFIER": {
        this.advance();
        return makeNonTerminal(token.value, token.source);
      }
      case "LPAREN": {
        this.eat("LPAREN");
        const inner = this.parseExpression();
        this.eat("RPAREN");
        return inner;
      }
      default:
        throw new GrammarSyntaxError(
          `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected an atom`,
          token.source.start,
        );
    }
  }

  // Check for peggy's case-insensitive flag (an IDENTIFIER "i" immediately
  // following a STRING or CHARSET atom). Appends `/i` to the rendered text and
  // extends the source range when found. Any other identifier is left alone
  // (it's the start of the next element in this alt, or the next rule's head).
  private maybeConsumeCaseInsensitiveFlag(
    text: string,
    atomSource: SourceRange,
  ): { text: string; source: SourceRange } {
    if (
      this.currentType() === "IDENTIFIER" &&
      this.lookahead?.value === "i" &&
      this.peekNextType() !== "ASSIGN"
    ) {
      const flagToken = this.lookahead;
      this.advance();
      return {
        text: `${text}/i`,
        source: { start: atomSource.start, end: flagToken.source.end },
      };
    }
    return { text, source: atomSource };
  }

  // Token stream helpers ----------------------------------------------------

  private currentType(): PegTokenType | null {
    return this.lookahead?.type ?? null;
  }

  private eat(expected: PegTokenType): Token<PegTokenType> {
    const token = this.lookahead;
    if (token === null) {
      throw new GrammarSyntaxError(
        `unexpected end of input; expected ${expected}`,
        this.lastEndPosition,
      );
    }
    if (token.type !== expected) {
      throw new GrammarSyntaxError(
        `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected ${expected}`,
        token.source.start,
      );
    }
    this.advance();
    return token;
  }

  private advance(): void {
    if (this.lookahead !== null) {
      this.lastEndPosition = this.lookahead.source.end;
    }
    if (this.peekBuffer1 !== undefined) {
      this.lookahead = this.peekBuffer1;
      this.peekBuffer1 = this.peekBuffer2;
      this.peekBuffer2 = undefined;
    } else {
      this.lookahead = this.tokenizer.next();
    }
  }

  private peekNextType(): PegTokenType | null {
    if (this.peekBuffer1 === undefined) {
      this.peekBuffer1 = this.tokenizer.next();
    }
    return this.peekBuffer1?.type ?? null;
  }

  private peekNext2Type(): PegTokenType | null {
    if (this.peekBuffer1 === undefined) {
      this.peekBuffer1 = this.tokenizer.next();
    }
    if (this.peekBuffer2 === undefined) {
      this.peekBuffer2 = this.tokenizer.next();
    }
    return this.peekBuffer2?.type ?? null;
  }
}

export const pegParser: GrammarParser = {
  id: "peg",
  parse(source: string): ParsedGrammar {
    return new PegParser(createPegTokenizer(source)).parseGrammar();
  },
};

// Decode peggy string-literal escapes. Supports both single- and double-quoted
// strings. Handles: \n \r \t \b \f \v \0 \\ \' \" \xHH \uHHHH \u{...}.
// Unknown escapes pass through as the escaped character.
function decodePegString(raw: string): string {
  const body = raw.slice(1, -1);
  let out = "";
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c !== "\\") {
      out += c;
      i++;
      continue;
    }
    const next = body[i + 1];
    switch (next) {
      case "n":
        out += "\n";
        i += 2;
        continue;
      case "r":
        out += "\r";
        i += 2;
        continue;
      case "t":
        out += "\t";
        i += 2;
        continue;
      case "b":
        out += "\b";
        i += 2;
        continue;
      case "f":
        out += "\f";
        i += 2;
        continue;
      case "v":
        out += "\v";
        i += 2;
        continue;
      case "0":
        out += "\0";
        i += 2;
        continue;
      case "\\":
        out += "\\";
        i += 2;
        continue;
      case "'":
        out += "'";
        i += 2;
        continue;
      case '"':
        out += '"';
        i += 2;
        continue;
      case "x": {
        const hex = body.slice(i + 2, i + 4);
        const code = Number.parseInt(hex, 16);
        if (!Number.isNaN(code) && hex.length === 2) {
          out += String.fromCharCode(code);
          i += 4;
          continue;
        }
        out += next;
        i += 2;
        continue;
      }
      case "u": {
        if (body[i + 2] === "{") {
          const close = body.indexOf("}", i + 3);
          if (close === -1) {
            out += next;
            i += 2;
            continue;
          }
          const hex = body.slice(i + 3, close);
          const code = Number.parseInt(hex, 16);
          if (!Number.isNaN(code)) out += String.fromCodePoint(code);
          i = close + 1;
          continue;
        }
        const hex = body.slice(i + 2, i + 6);
        const code = Number.parseInt(hex, 16);
        if (!Number.isNaN(code) && hex.length === 4) {
          out += String.fromCodePoint(code);
          i += 6;
          continue;
        }
        out += next;
        i += 2;
        continue;
      }
      default:
        out += next ?? "";
        i += 2;
    }
  }
  return out;
}
