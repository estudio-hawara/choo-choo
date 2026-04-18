---
title: Manual builder
description: Ergonomic factory functions that construct IR directly, without going through a grammar parser.
---

The builder is the ergonomic API that users reach for when they want to **construct IR in code**, without going through a grammar parser. It lives in `@choo-choo/core` and sits next to the renderer; everything in this document produces values that conform to the IR spec (`ir.md`) and are consumable by `render` (`rendering.md`).

## What it is

A collection of small, named factory functions. Each factory:

- Returns a valid IR `Node`.
- Validates its inputs at construction time.
- Throws `TypeError` on invariant violations.
- Never mutates its arguments.
- Does not set the `source` field (manually constructed IR has no grammar origin).

There are no classes, no fluent builders, no stateful containers — just plain functions composing plain data.

## Entry points

All factories are named exports from `@choo-choo/core`:

```ts
import {
  diagram, start, end,
  terminal, nonTerminal, special, comment,
  sequence, choice,
  optional, oneOrMore, zeroOrMore,
  group, skip,
  render,
} from "@choo-choo/core";
```

Namespace import is also supported:

```ts
import * as c from "@choo-choo/core";
c.diagram(c.sequence(c.terminal("hello"), c.terminal("world")));
```

## Factory signatures

### Diagram root

```ts
function diagram(
  child: Node,
  options?: { start?: Start; end?: End },
): Diagram;
```

- Wraps `child` as the diagram's expression.
- `child` must not itself be a `Diagram` (diagrams don't nest; throws `TypeError` otherwise).
- Omitted endpoints default to `{ kind: "start", variant: "simple" }` and `{ kind: "end", variant: "simple" }` respectively.

### Endpoints

```ts
function start(variant: "simple" | "complex", label?: string): Start;
function end(variant: "simple" | "complex"): End;
```

### Leaves

```ts
interface LeafMeta { href?: string; title?: string }

function terminal(text: string, meta?: LeafMeta): Terminal;
function nonTerminal(name: string, meta?: LeafMeta): NonTerminal;
function special(text: string, meta?: LeafMeta): Special;
function comment(text: string, meta?: LeafMeta): Comment;
```

All four share the same `LeafMeta` shape for optional link / tooltip. `text` / `name` must be a string; empty strings produce a `console.warn` (not an error — sometimes intentional in tests) and render as empty boxes.

### Composition: sequence

```ts
function sequence(...children: Node[]): Node;
```

- `children.length === 0` throws `TypeError`.
- `children.length === 1` returns `children[0]` unchanged — single-child sequences are **unwrapped** and do not reach the renderer. (This is why the return type is `Node`, not `Sequence`.)
- `children.length ≥ 2` returns a `Sequence` with the children in the given order. Nested sequences are preserved as-is; the builder does not flatten them (users can express grouping intent by nesting).

### Composition: choice

```ts
function choice(...children: Node[]): Choice;
function choice(
  options: { normal: number },
  ...children: Node[]
): Choice;
```

Two overloads:

- Plain form: `normal` defaults to the middle index (`Math.floor((children.length - 1) / 2)`).
- Explicit form: `options.normal` picks the default branch. Must be a valid index into `children`; out-of-range throws `TypeError`.

In both forms `children.length < 2` throws `TypeError` (use the single child directly if you only have one).

### Optional and repetition

```ts
function optional(child: Node, skip?: "top" | "bottom"): Optional;
function oneOrMore(child: Node, separator?: Node): Repetition;
function zeroOrMore(child: Node, separator?: Node): Optional;
```

- `optional`: `skip` defaults to `"top"`.
- `oneOrMore`: builds a `Repetition`. `separator` is drawn on the return rail.
- `zeroOrMore`: sugar for `optional(oneOrMore(child, separator))`. Returns an `Optional` whose child is a `Repetition`. There is no standalone "zero-or-more" kind in the IR — see `docs/ir.md` for the rationale.

### Grouping and skip

```ts
function group(child: Node, label?: string): Group;
function skip(): Skip;
```

## Validation summary

All validation is synchronous and happens at construction time. The thrown error is always `TypeError` with a message that identifies the factory and the violated rule. Examples:

- `TypeError: diagram: child must not itself be a Diagram (diagrams don't nest)`
- `TypeError: choice: requires at least 2 children, got 1`
- `TypeError: choice: normal index 3 is out of range for 2 children`
- `TypeError: sequence: requires at least 1 child, got 0`
- `TypeError: terminal: text must be a string, got number`

Non-string-but-stringifiable inputs (numbers, booleans) are rejected by type check; no implicit coercion happens. The builder does not try to be lenient — parser authors do type checking at their own boundary, and end users mostly hit the builder from TypeScript where the compiler catches type mistakes up front.

The builder only catches *constructible* invariants. It cannot (and does not) detect:

- Cycles introduced by re-using the same node in multiple places that become ancestors of each other. (Don't do that. The IR is a tree.)
- Downstream rendering oddities from extreme inputs (e.g. a 500-child choice).

## Normalization rules

Exactly one rule fires inside factories; everything else is preserved verbatim:

- **`sequence(x)` unwraps to `x`.** No single-child `Sequence` values exist in valid IR.

That is the only implicit transformation. In particular:

- Nested sequences are **not** flattened (`sequence(a, sequence(b, c))` produces exactly that tree).
- Nested choices are **not** merged.
- Empty strings in leaves are **not** rejected (only warned).
- `zeroOrMore` **is** desugared at construction time to `optional(oneOrMore(...))` — this keeps the IR node count stable and the renderer simple.

## The `source` field

Factories do not set `source`. The property is absent from every node they return (not set to `undefined` — genuinely absent). This matches `exactOptionalPropertyTypes: true` and lets downstream visitors distinguish "built by hand" from "parsed but without source info" if that ever matters.

Users of the builder who need source tracking (e.g. constructing IR from a custom external source) can add `source` after the fact:

```ts
const n = terminal("a");
const withSource = { ...n, source: mySourceRange };
```

This is an intentional escape hatch, not a first-class API feature.

## Examples

Each example pairs a grammar production (in an EBNF-ish shorthand) with the equivalent builder call.

### A single terminal

The minimal hello-world: one leaf wrapped in a diagram.

```ts
diagram(terminal("return"));
```

### An assignment

```
assignment = identifier "=" expression
```

```ts
diagram(
  sequence(
    nonTerminal("identifier"),
    terminal("="),
    nonTerminal("expression"),
  ),
);
```

### A compound-assignment operator (choice with a chosen default)

```
assignment = target ("=" | "+=" | "-=" | "*=") value
```

Plain `=` is the most common branch, so it sits on the straight rail.

```ts
diagram(
  sequence(
    nonTerminal("target"),
    choice(
      { normal: 0 },
      terminal("="),
      terminal("+="),
      terminal("-="),
      terminal("*="),
    ),
    nonTerminal("value"),
  ),
);
```

### A function call with optional comma-separated arguments

```
call = identifier "(" [ argument { "," argument } ] ")"
```

`optional(oneOrMore(child, separator))` is the idiomatic way to express "zero or more with a separator".

```ts
diagram(
  sequence(
    nonTerminal("identifier"),
    terminal("("),
    optional(oneOrMore(nonTerminal("argument"), terminal(","))),
    terminal(")"),
  ),
);
```

### An if-then-else with a named endpoint

```
if-statement = "if" condition "then" body [ "else" body ]
```

`start("complex", "if-statement")` labels the rule in the diagram so it reads as a standalone production.

```ts
diagram(
  sequence(
    terminal("if"),
    nonTerminal("condition"),
    terminal("then"),
    nonTerminal("body"),
    optional(
      sequence(terminal("else"), nonTerminal("body")),
    ),
  ),
  {
    start: start("complex", "if-statement"),
    end: end("complex"),
  },
);
```

### A JSON object (composition showcase)

```
object = "{" [ pair { "," pair } ] "}"
pair   = string ":" value
```

Nests `oneOrMore` with a separator inside an `optional`, with an inner `sequence` as the loop body — the kind of expression you'd hit modelling any real data format.

```ts
diagram(
  sequence(
    terminal("{"),
    optional(
      oneOrMore(
        sequence(
          nonTerminal("string"),
          terminal(":"),
          nonTerminal("value"),
        ),
        terminal(","),
      ),
    ),
    terminal("}"),
  ),
);
```

## Relation to other parts of the system

- **IR spec** (`docs/ir.md`): the builder's outputs are, by construction, valid IR. Invariants documented there are enforced here.
- **Renderer** (`docs/rendering.md`): accepts anything the builder produces without reservations. `render(diagram(...))` is the canonical end-to-end path for hand-built diagrams.
- **Grammar parsers** (`docs/grammars/*.md`): do not use the builder. They produce IR directly and populate `source`. The two IR-producing paths coexist without depending on each other.
- **Framework bindings** (`docs/bindings/*.md`): accept IR via `{ ir }` so users can pass the builder's output straight into a component.
