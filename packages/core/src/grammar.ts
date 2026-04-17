import type { Diagram, SourceRange } from "./ir.js";

export interface GrammarRule {
  name: string;
  diagram: Diagram;
  source?: SourceRange;
}

export interface ParsedGrammar {
  rules: GrammarRule[];
}

export interface GrammarParser {
  readonly id: string;
  parse(source: string): ParsedGrammar;
}
