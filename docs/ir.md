---
title: Intermediate Representation (IR)
description: The flat discriminated-union Node type that parsers produce and the renderer consumes.
---

The IR is the single contract between everything that **produces** diagrams (parsers, the manual builder) and everything that **consumes** them (the renderer, bindings). It is a flat discriminated union of pure-data `Node` values — no methods, no SVG awareness, no framework coupling.

## Design rules

1. **Tagged union.** Every node has a `kind` field literal-typed to its variant. Visitors dispatch on `node.kind`.
2. **Pure data.** Nodes carry only data fields; no methods, no hidden references, no lazy getters.
3. **Tree-shaped.** Nodes form a tree; cycles are not allowed and are not checked at runtime (violations are undefined behaviour).
4. **Fail loudly on the unknown.** An unrecognised `kind` is a programming error. The renderer and any visitor must throw rather than silently render nothing.
5. **Minimal surface.** Fields exist only if they affect *structure* or *rendering*. Purely cosmetic concerns belong to renderer options or CSS, not the IR.
6. **Immutable by convention.** Builders return fresh nodes; visitors do not mutate. The type system does not enforce this (no `readonly` frenzy); the convention is documented and tested.

## The `Node` union

```ts
type Node =
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
```

> Every variant additionally accepts an optional `source?: SourceRange` field — see [§ Source location](#source-location) below. The field is universal and is not repeated in the individual interface blocks.

Summary table:

| `kind`         | Shape                            | Role                                                        |
|----------------|----------------------------------|-------------------------------------------------------------|
| `diagram`      | root                             | Top-level container for a single railroad diagram.          |
| `start`        | marker                           | Entry endpoint.                                             |
| `end`          | marker                           | Exit endpoint.                                              |
| `terminal`     | leaf                             | Literal token (rounded box).                                |
| `nonterminal`  | leaf                             | Reference to another rule (rectangular box).                |
| `special`      | leaf                             | Opaque/non-standard token (distinct style).                 |
| `comment`      | leaf                             | Typographic annotation in the diagram flow (no box).        |
| `sequence`     | N children, left-to-right        | Concatenation.                                              |
| `choice`       | N children, vertically stacked   | Alternation (pick one).                                     |
| `optional`     | 1 child                          | Optional branch (sugar for `choice([skip, child])`).        |
| `repetition`   | 1 child + optional separator     | One-or-more loop.                                           |
| `group`        | 1 child + optional label         | Visual grouping box (no structural effect).                 |
| `skip`         | —                                | Explicit empty path; used inside `choice` or `optional`.    |

## Source location

Every `Node` may carry an optional `source?: SourceRange` field that points back at the fragment of grammar source that produced it. It is defined once here and applies uniformly to every variant — the individual interface blocks below do not repeat it.

```ts
interface SourcePosition {
  offset: number; // 0-based byte offset into the parsed source
  line: number; // 1-based
  column: number; // 1-based
}

interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}
```

Responsibilities:

| Who              | Behaviour                                                                                                                                                        |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Grammar parsers  | **Populate** `source` on every node they produce, covering the originating tokens.                                                                               |
| Manual builder   | **Does not populate** — nodes built by hand have no source.                                                                                                      |
| Renderer         | **Ignores by default.** Under `emitSourceData: true` (see `docs/rendering.md`), it emits `data-source-offset-start` / `data-source-offset-end` (and line/column equivalents) on the corresponding `<g>` elements. Without the flag the SVG is unchanged. |

Line and column are stored alongside the offset so consumers can format error messages without needing to re-scan the source string.

## Node kinds in detail

### `diagram`

Root of every railroad. Wraps one top-level expression plus optional endpoints.

```ts
interface Diagram {
  kind: "diagram";
  child: Node;                 // typically a sequence, choice, or any expression node
  start?: Start;               // defaults to { kind: "start", variant: "simple" }
  end?: End;                   // defaults to { kind: "end", variant: "simple" }
}
```

### `start` / `end`

Endpoints drawn at the extremities of a diagram.

```ts
interface Start {
  kind: "start";
  variant: "simple" | "complex";
  label?: string;              // optional rule name drawn above the marker
}
interface End {
  kind: "end";
  variant: "simple" | "complex";
}
```

- `simple` — single-line terminus. Used for diagrams that represent a single expression.
- `complex` — double-line terminus. Convention for diagrams that compose sub-rules and are referenced elsewhere.

### `terminal`

Literal token rendered as a rounded (stadium) box.

```ts
interface Terminal {
  kind: "terminal";
  text: string;
  href?: string;               // optional hyperlink wrapping the box
  title?: string;              // optional <title> tooltip
}
```

### `nonterminal`

Reference to another rule; rendered as a rectangular box.

```ts
interface NonTerminal {
  kind: "nonterminal";
  name: string;
  href?: string;
  title?: string;
}
```

### `special`

Opaque/non-standard token (e.g. EBNF `?…?` special-sequence, PEG regex literal, ANTLR semantic predicate). Styled distinctly so readers notice.

```ts
interface Special {
  kind: "special";
  text: string;
  href?: string;
  title?: string;
}
```

### `comment`

Inline typographic annotation — no box, renders in the diagram flow as free-standing text.

```ts
interface Comment {
  kind: "comment";
  text: string;
  href?: string;
  title?: string;
}
```

### `sequence`

Children drawn left-to-right on the same rail.

```ts
interface Sequence {
  kind: "sequence";
  children: Node[]; // non-empty
}
```

- `children.length === 0` is invalid.
- The builder flattens `sequence([x])` to `x` (no single-child sequences reach the renderer). Nested sequences are *not* auto-flattened: the builder preserves grouping the user expressed. The renderer tolerates both.

### `choice`

Vertical alternation. Each child is one alternative.

```ts
interface Choice {
  kind: "choice";
  children: Node[]; // at least 2
  normal?: number; // 0-based index of the "default" branch drawn on the straight axis; defaults to the middle
}
```

- `children.length === 1` is invalid (unwrap to that child via the builder).
- `normal`, when provided, must be a valid index.

### `optional`

A child that may be skipped. Semantically equivalent to `choice([skip, child])` but kept as its own kind because it is frequent and rendered with a tighter layout (the skip arcs over/under the child, not through a full vertical stack).

```ts
interface Optional {
  kind: "optional";
  child: Node;
  skip: "top" | "bottom"; // on which rail the skip sits; defaults to "top"
}
```

### `repetition`

One-or-more loop. Zero-or-more is modelled by wrapping a `repetition` in an `optional` — there is no separate `zeroOrMore` kind.

```ts
interface Repetition {
  kind: "repetition";
  child: Node; // the loop body
  separator?: Node; // optional token drawn on the return path (e.g. "," in `a (',' a)*`)
}
```

The builder exposes `oneOrMore(child, separator?)` and `zeroOrMore(child, separator?)`; the latter returns `optional(repetition(child, separator))`.

### `group`

Labelled boxing container — a dashed rectangle around its child with an optional label. Does not alter the path.

```ts
interface Group {
  kind: "group";
  child: Node;
  label?: string;
}
```

### `skip`

Explicit empty path. Used as an alternative inside `choice` to represent "consume nothing on this branch".

```ts
interface Skip {
  kind: "skip";
}
```

## Invariants

- Every node has `kind` equal to its tag.
- `Sequence.children.length ≥ 1`; `Choice.children.length ≥ 2`.
- `Choice.normal`, if present, is in `[0, children.length)`.
- `Diagram.child` is any non-`diagram` node (diagrams don't nest).
- The tree is acyclic.
- `source`, when present, satisfies `start.offset <= end.offset`. Parsers guarantee this; the builder never sets `source`.
- String fields (`text`, `name`, `label`, `title`) may be empty, but the builder warns — empty boxes are almost never intentional.

The manual builder (`docs/builder.md`) enforces every invariant at construction time and throws `TypeError` on violations. Parsers are expected to produce IR that already satisfies them.

## Example

The EBNF expression `( "a" | "b" ) , { "c" }` maps to:

```ts
const ir: Diagram = {
  kind: "diagram",
  child: {
    kind: "sequence",
    children: [
      {
        kind: "choice",
        children: [
          { kind: "terminal", text: "a" },
          { kind: "terminal", text: "b" },
        ],
      },
      {
        kind: "optional",
        skip: "top",
        child: {
          kind: "repetition",
          child: { kind: "terminal", text: "c" },
        },
      },
    ],
  },
};
```

## Relation to the rest of the system

- **Parsers** (`@choo-choo/parser-ebnf`, `-antlr`, `-peg`) produce `Diagram` values and populate `source` on every node. They never call the renderer.
- **The manual builder** exposes factory functions whose return type is `Node`. It does not set `source` — manually constructed IR has no origin in user-authored grammar text. See `docs/builder.md`.
- **The renderer** consumes a `Diagram` and emits an SVG string. It never mutates the IR. By default it ignores `source`; under `emitSourceData: true` it projects source ranges onto the SVG as `data-source-*` attributes. See `docs/rendering.md`.
- **Bindings** accept either a `Diagram` (via `{ ir }`) or a `(source, parser)` pair that produces one.

## Open questions

- **ANTLR-style cardinality (`{n,m}`)** — would require `minCount`/`maxCount` on `repetition`. Deferred to [0.1#M5](./roadmap/0.1.md) (`parser-antlr`).
