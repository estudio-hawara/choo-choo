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
  makeRepetitionWithSeparator,
  makeSequence,
  makeSpecial,
  makeTerminal,
  makeZeroOrMore,
} from "./factory.js";
import {
  type PythonPegTokenType,
  type PythonPegTokenizer,
  createPythonPegTokenizer,
} from "./tokenizer.js";

const START_POSITION: SourcePosition = { offset: 0, line: 1, column: 1 };

function spanOf(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange {
  if (!first || !last) throw new Error("unreachable: parser produced a node without source");
  return { start: first.start, end: last.end };
}

class PythonPegParser {
  private lookahead: Token<PythonPegTokenType> | null;
  private lastEndPosition: SourcePosition = START_POSITION;
  // One-slot peek buffer: rule-head detection needs to look one token past the
  // current NAME to see whether the next token is COLON.
  private peekBuffer1: Token<PythonPegTokenType> | null | undefined;

  constructor(private readonly tokenizer: PythonPegTokenizer) {
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
    const nameToken = this.eat("NAME");
    this.eat("COLON");
    const body = this.parseAlternatives();
    const ruleSource: SourceRange = {
      start: nameToken.source.start,
      // biome-ignore lint/style/noNonNullAssertion: parseAlternatives always returns a node with source
      end: body.source!.end,
    };
    return {
      name: nameToken.value,
      diagram: makeDiagram(body, ruleSource),
      source: ruleSource,
    };
  }

  // [ "|" ] alt ( "|" alt )*
  private parseAlternatives(): Node {
    // Optional leading "|" — supports the formatting style where each alt
    // appears on its own indented line, including the first.
    if (this.currentType() === "PIPE") this.advance();
    const first = this.parseAlt();
    const branches: Node[] = [first];
    while (this.currentType() === "PIPE") {
      this.advance();
      branches.push(this.parseAlt());
    }
    if (branches.length === 1) return first;
    return makeChoice(branches, spanOf(branches[0]?.source, branches[branches.length - 1]?.source));
  }

  // element+ — stops at "|", ")", "]", EOF, or a rule head (NAME ":").
  private parseAlt(): Node {
    const startPosition = this.lookahead?.source.start ?? this.lastEndPosition;
    const elements: Node[] = [];
    while (this.canStartElement() && !this.atRuleHead()) {
      const element = this.parseElement();
      if (element !== null) elements.push(element);
    }
    if (elements.length === 0) {
      throw new GrammarSyntaxError(
        `empty alternative at line ${startPosition.line}, column ${startPosition.column}`,
        startPosition,
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
      case "NAME":
      case "STRING":
      case "DSTRING":
      case "LPAREN":
      case "LBRACKET":
      case "AMP":
      case "AMPAMP":
      case "BANG":
      case "TILDE":
        return true;
      default:
        return false;
    }
  }

  private atRuleHead(): boolean {
    if (this.currentType() !== "NAME") return false;
    return this.peekNextType() === "COLON";
  }

  // Returns null when the element was a `~` cut (silently dropped — produces
  // no IR but is valid syntax that advances the token stream).
  private parseElement(): Node | null {
    const t = this.currentType();
    if (t === "TILDE") {
      this.advance();
      return null;
    }
    if (t === "AMP" || t === "AMPAMP" || t === "BANG") {
      // biome-ignore lint/style/noNonNullAssertion: currentType() returned a string, so lookahead is non-null
      const predicateToken = this.lookahead!;
      this.advance();
      const atom = this.parseAtom();
      const label = t === "AMP" ? "&" : t === "AMPAMP" ? "&&" : "!";
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
    if (t === "QUESTION" || t === "STAR" || t === "PLUS") {
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
    if (t === "DOT") {
      // sep.elem+ — `atom` is the separator. After consuming the dot we
      // require an atom and a "+". Anything else is a parse error: Python's
      // pegen does not support `s.e*` or `s.e?`.
      this.advance();
      const element = this.parseAtom();
      const plus = this.lookahead;
      if (plus === null || plus.type !== "PLUS") {
        const pos = plus?.source.start ?? this.lastEndPosition;
        const seen = plus?.type ?? "end of input";
        throw new GrammarSyntaxError(
          `expected "+" after separator-binder ".", got ${seen} at line ${pos.line}, column ${pos.column}`,
          pos,
        );
      }
      this.advance();
      // biome-ignore lint/style/noNonNullAssertion: atom and element both have source
      const span: SourceRange = { start: atom.source!.start, end: plus.source.end };
      return makeRepetitionWithSeparator(element, atom, span);
    }
    return atom;
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
      case "STRING":
      case "DSTRING": {
        this.advance();
        const decoded = decodePythonPegString(token.value);
        // String range: "a"..."z" / 'a'...'z'. The `...` (ELLIPSIS) is only
        // recognised here, immediately after a string literal, so a stray
        // `...` elsewhere surfaces as `unexpected ELLIPSIS`. The second
        // operand must use the same quote kind as the first (pegen rule).
        if (this.currentType() === "ELLIPSIS") {
          this.advance();
          const endToken = this.eat(token.type);
          const endDecoded = decodePythonPegString(endToken.value);
          return makeSpecial(`${decoded}...${endDecoded}`, {
            start: token.source.start,
            end: endToken.source.end,
          });
        }
        return makeTerminal(decoded, token.source);
      }
      case "NAME": {
        this.advance();
        return makeNonTerminal(token.value, token.source);
      }
      case "LPAREN": {
        this.eat("LPAREN");
        const inner = this.parseAlternatives();
        this.eat("RPAREN");
        return inner;
      }
      case "LBRACKET": {
        const open = this.eat("LBRACKET");
        const inner = this.parseAlternatives();
        const close = this.eat("RBRACKET");
        return makeOptional(inner, { start: open.source.start, end: close.source.end });
      }
      default:
        throw new GrammarSyntaxError(
          `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected an atom`,
          token.source.start,
        );
    }
  }

  // Token stream helpers ----------------------------------------------------

  private currentType(): PythonPegTokenType | null {
    return this.lookahead?.type ?? null;
  }

  private eat(expected: PythonPegTokenType): Token<PythonPegTokenType> {
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
      this.peekBuffer1 = undefined;
    } else {
      this.lookahead = this.tokenizer.next();
    }
  }

  private peekNextType(): PythonPegTokenType | null {
    if (this.peekBuffer1 === undefined) {
      this.peekBuffer1 = this.tokenizer.next();
    }
    return this.peekBuffer1?.type ?? null;
  }
}

export const pythonPegParser: GrammarParser = {
  id: "python-peg",
  parse(source: string): ParsedGrammar {
    return new PythonPegParser(createPythonPegTokenizer(source)).parseGrammar();
  },
};

// Decode Python-PEG string-literal escapes. Both 'single' and "double" quoted
// strings share the same escape vocabulary (mirrors the peggy parser's
// behaviour). Unknown escapes pass through as the escaped character.
function decodePythonPegString(raw: string): string {
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
