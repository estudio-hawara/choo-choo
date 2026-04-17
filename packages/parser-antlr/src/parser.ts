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
  makeNonTerminal,
  makeOptional,
  makeRepetition,
  makeSequence,
  makeSpecial,
  makeTerminal,
  makeZeroOrMore,
} from "./factory.js";
import { type AntlrTokenType, type AntlrTokenizer, createAntlrTokenizer } from "./tokenizer.js";

const START_POSITION: SourcePosition = { offset: 0, line: 1, column: 1 };

function spanOf(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange {
  if (!first || !last) throw new Error("unreachable: parser produced a node without source");
  return { start: first.start, end: last.end };
}

class AntlrParser {
  private lookahead: Token<AntlrTokenType> | null;
  private lastEndPosition: SourcePosition = START_POSITION;

  constructor(
    private readonly tokenizer: AntlrTokenizer,
    private readonly source: string,
  ) {
    this.lookahead = tokenizer.next();
  }

  parseGrammar(): ParsedGrammar {
    this.consumeGrammarHeader();
    const rules: GrammarRule[] = [];
    while (this.lookahead !== null) {
      const rule = this.parseTopLevelItem();
      if (rule !== null) rules.push(rule);
    }
    return { rules };
  }

  // [ ("parser" | "lexer") ] "grammar" IDENT ";"
  private consumeGrammarHeader(): void {
    const first = this.lookahead;
    if (first === null || first.type !== "IDENTIFIER") return;
    if (first.value === "grammar") {
      this.advance();
      this.eatIdentifier("grammar name");
      this.eat("SEMI");
      return;
    }
    if (first.value === "parser" || first.value === "lexer") {
      // Must be immediately followed by "grammar" to be a header.
      const saved = first;
      this.advance();
      if (this.lookahead?.type === "IDENTIFIER" && this.lookahead.value === "grammar") {
        this.advance();
        this.eatIdentifier("grammar name");
        this.eat("SEMI");
        return;
      }
      // Not a header — restore: this is unusual (no real grammar has a rule literally named
      // "parser" or "lexer"), but tolerate by putting the token back is hard without a buffer.
      // Since we've advanced, treat this as an error with a clear message.
      throw new GrammarSyntaxError(
        `"${saved.value}" must be followed by "grammar" at line ${saved.source.start.line}, column ${saved.source.start.column}`,
        saved.source.start,
      );
    }
  }

  private parseTopLevelItem(): GrammarRule | null {
    const token = this.lookahead;
    if (token === null) return null;

    // At-commands: @name [:: name] — body already consumed by tokenizer.
    if (token.type === "AT") {
      this.advance();
      this.eatIdentifier("at-command name");
      if (this.lookahead?.type === "COLON_COLON") {
        this.advance();
        this.eatIdentifier("at-command scoped name");
      }
      return null;
    }

    if (token.type !== "IDENTIFIER") {
      throw new GrammarSyntaxError(
        `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected a rule, a block declaration, "@", "import", "mode", or "fragment"`,
        token.source.start,
      );
    }

    switch (token.value) {
      case "options":
      case "tokens":
      case "channels":
        // Block body is already consumed by the tokenizer's balanced-brace scanner.
        this.advance();
        return null;
      case "import":
        this.advance();
        this.eatIdentifier("import target");
        while (this.lookahead?.type === "COMMA") {
          this.advance();
          this.eatIdentifier("import target");
        }
        this.eat("SEMI");
        return null;
      case "mode":
        this.advance();
        this.eatIdentifier("mode name");
        this.eat("SEMI");
        return null;
      case "fragment":
        this.advance();
        return this.parseRuleStartingAtName();
      default:
        return this.parseRuleStartingAtName();
    }
  }

  // IDENT ":" altList ";"
  private parseRuleStartingAtName(): GrammarRule {
    const nameToken = this.eatIdentifier("rule name");
    this.eat("COLON");
    const body = this.parseAltList();
    // Optional lexer commands trailing the last alternative but outside the `|` structure
    // are consumed inside parseAlt — so we don't see them here.
    const semiToken = this.eat("SEMI");
    const ruleSource: SourceRange = {
      start: nameToken.source.start,
      end: semiToken.source.end,
    };
    return {
      name: nameToken.value,
      diagram: makeDiagram(body, ruleSource),
      source: ruleSource,
    };
  }

  // alt ("|" alt)*
  private parseAltList(): Node {
    const first = this.parseAlt();
    const branches: Node[] = [first];
    while (this.lookahead?.type === "PIPE") {
      this.advance();
      branches.push(this.parseAlt());
    }
    if (branches.length === 1) return first;
    return makeChoice(branches, spanOf(branches[0]?.source, branches[branches.length - 1]?.source));
  }

  // element* [lexer-commands] [alt-label]
  private parseAlt(): Node {
    const elements: Node[] = [];
    while (this.canStartElement()) {
      elements.push(this.parseElement());
    }

    // Optional lexer commands: consumed and discarded.
    if (this.lookahead?.type === "ARROW") {
      this.skipLexerCommands();
    }

    // Optional alt label: # IDENT (parser-rule feature, discarded).
    if (this.lookahead?.type === "HASH") {
      this.advance();
      this.eatIdentifier("alt label");
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
    const t = this.lookahead;
    if (t === null) return false;
    switch (t.type) {
      case "STRING":
      case "IDENTIFIER":
      case "CHARSET":
      case "DOT":
      case "TILDE":
      case "LPAREN":
        return true;
      default:
        return false;
    }
  }

  // [ IDENT ("=" | "+=") ] atom [ suffix ]
  private parseElement(): Node {
    // Strip element label if present: IDENT followed by "=" or "+=".
    if (
      this.lookahead?.type === "IDENTIFIER" &&
      (this.peekNextType() === "ASSIGN" || this.peekNextType() === "PLUS_ASSIGN")
    ) {
      this.advance(); // name
      this.advance(); // "=" or "+="
    }
    const atom = this.parseAtom();
    return this.maybeWrapSuffix(atom);
  }

  // After consuming an atom, check for ?/*/+ (with optional trailing ? for non-greedy).
  private maybeWrapSuffix(atom: Node): Node {
    const t = this.lookahead;
    if (t === null) return atom;
    let kind: "QUESTION" | "STAR" | "PLUS" | null = null;
    if (t.type === "QUESTION" || t.type === "STAR" || t.type === "PLUS") {
      kind = t.type;
    }
    if (kind === null) return atom;
    const suffixStart = t.source;
    this.advance();
    // Non-greedy: consume a trailing "?". Visually identical to greedy.
    let suffixEnd = suffixStart;
    if (this.lookahead?.type === "QUESTION") {
      suffixEnd = this.lookahead.source;
      this.advance();
    }
    // biome-ignore lint/style/noNonNullAssertion: atom from parseAtom always has source
    const span: SourceRange = { start: atom.source!.start, end: suffixEnd.end };
    switch (kind) {
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
        `unexpected end of input; expected a string, identifier, charset, ".", "~", or "("`,
        this.lastEndPosition,
      );
    }
    switch (token.type) {
      case "STRING": {
        this.advance();
        // Is this the start of a char range? 'a'..'b'
        if (this.lookahead?.type === "DOTDOT") {
          this.advance();
          const upperToken = this.eat("STRING");
          const span: SourceRange = {
            start: token.source.start,
            end: upperToken.source.end,
          };
          return makeSpecial(this.sliceSource(span), span);
        }
        return makeTerminal(decodeAntlrString(token.value), token.source);
      }
      case "IDENTIFIER": {
        this.advance();
        return makeNonTerminal(token.value, token.source);
      }
      case "CHARSET": {
        this.advance();
        return makeSpecial(token.value, token.source);
      }
      case "DOT": {
        this.advance();
        return makeSpecial(".", token.source);
      }
      case "TILDE": {
        const start = token.source.start;
        this.advance();
        const inner = this.parseAtom();
        // biome-ignore lint/style/noNonNullAssertion: parseAtom always produces a node with source
        const span: SourceRange = { start, end: inner.source!.end };
        const literal = this.sliceSource(span);
        return makeSpecial(literal, span);
      }
      case "LPAREN": {
        this.eat("LPAREN");
        const inner = this.parseAltList();
        this.eat("RPAREN");
        // Grouping is transparent — return the inner node verbatim.
        return inner;
      }
      default:
        throw new GrammarSyntaxError(
          `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected a string, identifier, charset, ".", "~", or "("`,
          token.source.start,
        );
    }
  }

  // Consume `-> cmd (, cmd)*` where each cmd is `IDENT ["(" (IDENT | STRING) ")"]`.
  // Everything is discarded — lexer commands have no visual meaning.
  private skipLexerCommands(): void {
    this.eat("ARROW");
    this.skipOneLexerCommand();
    while (this.lookahead?.type === "COMMA") {
      this.advance();
      this.skipOneLexerCommand();
    }
  }

  private skipOneLexerCommand(): void {
    this.eatIdentifier("lexer command name");
    if (this.currentType() === "LPAREN") {
      this.advance();
      // Arg can be an identifier or a string literal (ints are lexed as identifiers).
      const argType = this.currentType();
      if (argType === "IDENTIFIER" || argType === "STRING") {
        this.advance();
      }
      this.eat("RPAREN");
    }
  }

  private currentType(): AntlrTokenType | null {
    return this.lookahead?.type ?? null;
  }

  private sliceSource(range: SourceRange): string {
    return this.source.slice(range.start.offset, range.end.offset);
  }

  // Token stream helpers ----------------------------------------------------

  private eat(expected: AntlrTokenType): Token<AntlrTokenType> {
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

  private eatIdentifier(what: string): Token<AntlrTokenType> {
    const token = this.lookahead;
    if (token === null) {
      throw new GrammarSyntaxError(
        `unexpected end of input; expected ${what}`,
        this.lastEndPosition,
      );
    }
    if (token.type !== "IDENTIFIER") {
      throw new GrammarSyntaxError(
        `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected ${what}`,
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
    if (this.peekBuffer !== undefined) {
      this.lookahead = this.peekBuffer;
      this.peekBuffer = undefined;
    } else {
      this.lookahead = this.tokenizer.next();
    }
  }

  // One-token lookahead-plus-one: peek the token after `this.lookahead` without
  // committing to it. Used only for the "is this an element label?" disambiguation
  // (`IDENT` followed by `=` / `+=`).
  private peekBuffer: Token<AntlrTokenType> | null | undefined;
  private peekNextType(): AntlrTokenType | null {
    if (this.peekBuffer === undefined) {
      this.peekBuffer = this.tokenizer.next();
    }
    return this.peekBuffer?.type ?? null;
  }
}

export const antlrParser: GrammarParser = {
  id: "antlr",
  parse(source: string): ParsedGrammar {
    return new AntlrParser(createAntlrTokenizer(source), source).parseGrammar();
  },
};

// Decode ANTLR single-quoted string escapes into the underlying text. Strips
// the surrounding quotes and interprets `\n`, `\r`, `\t`, `\f`, `\b`, `\\`,
// `\'`, and `\uXXXX` / `\u{X}`. Unknown escapes pass through as the escaped
// character (ANTLR itself is lenient here).
function decodeAntlrString(raw: string): string {
  const body = raw.slice(1, -1); // strip single quotes
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
      case "f":
        out += "\f";
        i += 2;
        continue;
      case "b":
        out += "\b";
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
      case "u": {
        if (body[i + 2] === "{") {
          const close = body.indexOf("}", i + 3);
          if (close === -1) {
            out += next ?? "";
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
        // Malformed \u — pass through the 'u'.
        out += next;
        i += 2;
        continue;
      }
      default:
        // Unknown escape: pass the escaped char through (matches ANTLR's leniency).
        out += next ?? "";
        i += 2;
    }
  }
  return out;
}
