export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

interface NodeBase {
  source?: SourceRange;
}

export interface Diagram extends NodeBase {
  kind: "diagram";
  child: Node;
  start?: Start;
  end?: End;
}

export interface Start extends NodeBase {
  kind: "start";
  variant: "simple" | "complex";
  label?: string;
}

export interface End extends NodeBase {
  kind: "end";
  variant: "simple" | "complex";
}

export interface Terminal extends NodeBase {
  kind: "terminal";
  text: string;
  href?: string;
  title?: string;
}

export interface NonTerminal extends NodeBase {
  kind: "nonterminal";
  name: string;
  href?: string;
  title?: string;
}

export interface Special extends NodeBase {
  kind: "special";
  text: string;
  href?: string;
  title?: string;
}

export interface Comment extends NodeBase {
  kind: "comment";
  text: string;
  href?: string;
  title?: string;
}

export interface Sequence extends NodeBase {
  kind: "sequence";
  children: Node[];
}

export interface Choice extends NodeBase {
  kind: "choice";
  children: Node[];
  normal?: number;
}

export interface Optional extends NodeBase {
  kind: "optional";
  child: Node;
  skip: "top" | "bottom";
}

export interface Repetition extends NodeBase {
  kind: "repetition";
  child: Node;
  separator?: Node;
}

export interface Group extends NodeBase {
  kind: "group";
  child: Node;
  label?: string;
}

export interface Skip extends NodeBase {
  kind: "skip";
}

export type Node =
  | Diagram
  | Start
  | End
  | Terminal
  | NonTerminal
  | Special
  | Comment
  | Sequence
  | Choice
  | Optional
  | Repetition
  | Group
  | Skip;

export type NodeKind = Node["kind"];

export const ALL_NODE_KINDS = [
  "diagram",
  "start",
  "end",
  "terminal",
  "nonterminal",
  "special",
  "comment",
  "sequence",
  "choice",
  "optional",
  "repetition",
  "group",
  "skip",
] as const satisfies readonly NodeKind[];
