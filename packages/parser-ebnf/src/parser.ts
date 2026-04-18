import type {
  GrammarParser,
  GrammarRule,
  Node,
  ParsedGrammar,
  SourcePosition,
  SourceRange,
} from "@choo-choo/core";
import { GrammarSyntaxError, type Token, type Tokenizer } from "@choo-choo/parser-utils";
import {
  makeChoice,
  makeDiagram,
  makeNonTerminal,
  makeOptional,
  makeSequence,
  makeSpecial,
  makeTerminal,
  makeZeroOrMore,
} from "./factory.js";
import { type EbnfTokenType, createEbnfTokenizer } from "./tokenizer.js";

const START_POSITION: SourcePosition = { offset: 0, line: 1, column: 1 };

function spanOf(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange {
  if (!first || !last) throw new Error("unreachable: parser produced a node without source");
  return { start: first.start, end: last.end };
}

class EbnfParser {
  private lookahead: Token<EbnfTokenType> | null;
  private lastEndPosition: SourcePosition = START_POSITION;

  constructor(private readonly tokenizer: Tokenizer<EbnfTokenType>) {
    this.lookahead = tokenizer.next();
  }

  parseGrammar(): ParsedGrammar {
    const rules: GrammarRule[] = [];
    while (this.lookahead !== null) {
      rules.push(this.parseRule());
    }
    return { rules };
  }

  // rule = identifier , "=" , definitions-list , ";"
  private parseRule(): GrammarRule {
    const identifierToken = this.eat("identifier");
    this.eat("=");
    const rightHandSide = this.parseDefinitionsList();
    const semicolonToken = this.eat(";");
    const source: SourceRange = {
      start: identifierToken.source.start,
      end: semicolonToken.source.end,
    };
    return {
      name: identifierToken.value,
      diagram: makeDiagram(rightHandSide, source),
      source,
    };
  }

  // definitions-list = single-definition , { "|" , single-definition }
  private parseDefinitionsList(): Node {
    const first = this.parseSingleDefinition();
    const branches: Node[] = [first];
    while (this.lookahead?.type === "|") {
      this.advance();
      branches.push(this.parseSingleDefinition());
    }
    if (branches.length === 1) return first;
    return makeChoice(branches, spanOf(branches[0]?.source, branches[branches.length - 1]?.source));
  }

  // single-definition = syntactic-term , { "," , syntactic-term }
  private parseSingleDefinition(): Node {
    const first = this.parseSyntacticTerm();
    const parts: Node[] = [first];
    while (this.lookahead?.type === ",") {
      this.advance();
      parts.push(this.parseSyntacticTerm());
    }
    if (parts.length === 1) return first;
    return makeSequence(parts, spanOf(parts[0]?.source, parts[parts.length - 1]?.source));
  }

  // syntactic-term = syntactic-primary
  private parseSyntacticTerm(): Node {
    return this.parseSyntacticPrimary();
  }

  // syntactic-primary = identifier | terminal | optional | repetition | grouped | special
  private parseSyntacticPrimary(): Node {
    const token = this.lookahead;
    if (token === null) {
      throw new GrammarSyntaxError(
        `unexpected end of input; expected an identifier, terminal, "[", "{", "(", or special`,
        this.lastEndPosition,
      );
    }
    switch (token.type) {
      case "identifier": {
        this.advance();
        return makeNonTerminal(token.value, token.source);
      }
      case "terminal": {
        this.advance();
        // Strip the surrounding "…" or '…' quotes.
        return makeTerminal(token.value.slice(1, -1), token.source);
      }
      case "special": {
        this.advance();
        // Strip the surrounding ? … ? delimiters; inner whitespace is preserved.
        return makeSpecial(token.value.slice(1, -1), token.source);
      }
      case "[": {
        const open = this.eat("[");
        const inner = this.parseDefinitionsList();
        const close = this.eat("]");
        return makeOptional(inner, { start: open.source.start, end: close.source.end });
      }
      case "{": {
        const open = this.eat("{");
        const inner = this.parseDefinitionsList();
        const close = this.eat("}");
        return makeZeroOrMore(inner, { start: open.source.start, end: close.source.end });
      }
      case "(": {
        this.eat("(");
        const inner = this.parseDefinitionsList();
        this.eat(")");
        // Parentheses are transparent: the inner node is returned verbatim.
        return inner;
      }
      default: {
        throw new GrammarSyntaxError(
          `unexpected ${token.type} at line ${token.source.start.line}, column ${token.source.start.column}; expected an identifier, terminal, "[", "{", "(", or special`,
          token.source.start,
        );
      }
    }
  }

  private eat(expected: EbnfTokenType): Token<EbnfTokenType> {
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
    this.lookahead = this.tokenizer.next();
  }
}

export const ebnfParser: GrammarParser = {
  id: "ebnf",
  parse(source: string): ParsedGrammar {
    return new EbnfParser(createEbnfTokenizer(source)).parseGrammar();
  },
};
