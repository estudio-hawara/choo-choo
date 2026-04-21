import type {
  Choice,
  Diagram,
  Group,
  Node,
  NonTerminal,
  Optional,
  Repetition,
  Sequence,
  SourceRange,
  Terminal,
} from "@choo-choo/core";

export function makeTerminal(text: string, source: SourceRange): Terminal {
  return { kind: "terminal", text, source };
}

export function makeNonTerminal(name: string, source: SourceRange): NonTerminal {
  return { kind: "nonterminal", name, source };
}

export function makeSequence(children: Node[], source: SourceRange): Sequence {
  return { kind: "sequence", children, source };
}

export function makeChoice(children: Node[], source: SourceRange): Choice {
  return { kind: "choice", children, source };
}

export function makeOptional(child: Node, source: SourceRange): Optional {
  return { kind: "optional", child, skip: "top", source };
}

export function makeRepetition(child: Node, source: SourceRange): Repetition {
  return { kind: "repetition", child, source };
}

export function makeRepetitionWithSeparator(
  child: Node,
  separator: Node,
  source: SourceRange,
): Repetition {
  return { kind: "repetition", child, separator, source };
}

export function makeZeroOrMore(child: Node, source: SourceRange): Optional {
  return {
    kind: "optional",
    skip: "top",
    source,
    child: makeRepetition(child, source),
  };
}

export function makeGroup(child: Node, label: string, source: SourceRange): Group {
  return { kind: "group", child, label, source };
}

export function makeDiagram(child: Node, source: SourceRange): Diagram {
  return { kind: "diagram", child, source };
}
