export type {
  Node,
  NodeKind,
  Diagram,
  Start,
  End,
  Terminal,
  NonTerminal,
  Special,
  Comment,
  Sequence,
  Choice,
  Optional,
  Repetition,
  Group,
  Skip,
  SourcePosition,
  SourceRange,
} from "./ir.js";

export type { GrammarParser, GrammarRule, ParsedGrammar } from "./grammar.js";

export {
  diagram,
  start,
  end,
  terminal,
  nonTerminal,
  special,
  comment,
  sequence,
  choice,
  optional,
  oneOrMore,
  zeroOrMore,
  group,
  skip,
} from "./builder.js";

export { render } from "./render.js";
export type { RenderOptions } from "./render.js";
