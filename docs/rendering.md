---
title: Rendering
description: The pure `render(diagram)` function that turns IR into a self-contained SVG string.
---

The renderer is the only component in `@choo-choo/core` that emits SVG. It is a **pure function** that consumes a `Diagram` [IR](./ir.md) tree and returns a self-contained SVG string. It never touches the DOM, depends on no runtime globals, and is safe to call on any JavaScript runtime (Node, Deno, Bun, Cloudflare Workers, browsers).

## Contract

```ts
function render(diagram: Diagram, options?: RenderOptions): string;
```

- **Input**: a `Diagram` node. Any other input is a programming error.
- **Output**: a single `<svg>...</svg>` string, self-contained and valid as a standalone document. The caller decides whether to inline it, write it to disk, or inject it via `innerHTML`.
- **Determinism**: given the same IR and options, `render` always returns the same string. No `Date.now()`, no random IDs, no environment reads.
- **Purity**: `render` does not mutate its inputs and has no observable side effects.
- **SSR-safety**: `render` never references `window`, `document`, `globalThis` DOM APIs, or any platform-specific global.

## Render options

```ts
interface RenderOptions {
  emitSourceData?: boolean; // default false
  verticalSeparation?: number; // vertical gap between stacked lanes, in px. Default: 8
  arcRadius?: number; // radius of route arcs, in px. Default: 10
  diagramPadding?: number; // padding inside the outer <svg> viewBox, in px. Default: 10
  strokeWidth?: number; // stroke-width applied to rails and box outlines, in px. Default: 1
  choiceAlignment?: "left" | "center"; // horizontal alignment of branches inside a `choice`. Default: "left"
  sizing?: "intrinsic" | "fluid"; // how the root <svg> advertises its size. Default: "intrinsic"
}
```

All options are optional with documented defaults. The renderer must not read from a global default object; defaults are inlined in the entry point.

Future options will be additive. Removing or changing the semantics of an existing option is a breaking change.

## Output shape

The renderer emits exactly one `<svg>` element. Its attributes:

- `xmlns="http://www.w3.org/2000/svg"`
- `class="choo-choo"` — the root hook for the shipped `railroad.css`.
- `viewBox="0 0 W H"` where `W` and `H` are the diagram's outer dimensions including `diagramPadding`. Always emitted.
- `width` and `height` — presence and values depend on `options.sizing`. See [Sizing](#sizing) below.

Inside the `<svg>`, the structure is a tree of nested `<g>` groups, one per IR node. Every group carries a CSS class that mirrors the node's `kind`:

| IR `kind`     | SVG group class    |
|---------------|--------------------|
| `diagram`     | `diagram`          |
| `start`       | `start`            |
| `end`         | `end`              |
| `terminal`    | `terminal`         |
| `nonterminal` | `non-terminal`     |
| `special`     | `special`          |
| `comment`     | `comment`          |
| `sequence`    | `sequence`         |
| `choice`      | `choice`           |
| `optional`    | `optional`         |
| `repetition`  | `repetition`       |
| `group`       | `group`            |
| `skip`        | `skip`             |

Groups nest according to the IR tree. This makes it trivial to:

- style a diagram with CSS (`.choo-choo .terminal rect { … }`),
- query specific parts in tests (`.querySelector(".choo-choo .choice .terminal")`),
- map SVG fragments back to IR nodes by position in the tree.

### Paint order: rails first, boxes last

SVG has no z-index; later elements paint over earlier ones. To keep connecting rails from overlapping the borders of the boxes they plug into, every node emits its SVG as **two layers**:

- **rails** — the horizontal stubs, s-curves and loop arcs that connect nodes.
- **boxes** — the shapes (`<rect>`, hexagon `<path>`, group-box, start/end bars) and the text labels.

At the diagram level, the renderer concatenates *all* rails across the whole tree, and then *all* boxes. The result is a deterministic two-layer document: the entire rail network paints first, then every box paints on top of it. Cross-node overlaps (e.g. an `end` stub meeting the right edge of a `terminal`) therefore always render as box-on-top-of-rail, never the other way around.

Each IR node contributes at most two `<g class="kind">` wrappers — one in the rails layer, one in the boxes layer. A wrapper is omitted when that layer is empty (e.g. `terminal` has no rails of its own, so it appears only in the boxes layer). Source-data attributes, when enabled, are emitted on both wrappers so that a node can be recovered from either layer.

## Sizing

The `viewBox` is always present, so the internal geometry is resolution-independent. What varies is how the root `<svg>` advertises its size to the host document:

- **`"intrinsic"` (default).** The root tag is `<svg … viewBox="0 0 W H" width="W" height="H">`, with `W` and `H` in pixels. The SVG renders at its natural pixel size regardless of container — the safe choice when the diagram sits inline with prose or when callers want deterministic, pixel-perfect output for screenshots and snapshots.
- **`"fluid"`.** The root tag is `<svg … viewBox="0 0 W H" width="100%">`, **with no `height` attribute**. Combined with the `viewBox` and the browser's default `preserveAspectRatio="xMidYMid meet"`, the SVG fills the container's width and scales height proportionally. Use this inside flex/grid containers, responsive layouts, or anywhere the diagram should grow with the viewport.

`height` is omitted rather than set to `"100%"` or `"auto"` because `height="auto"` is not a valid SVG attribute, and `height="100%"` against a parent with no explicit height collapses to the 300×150 replaced-element default in most browsers. Omitting it delegates sizing entirely to the aspect ratio derived from the `viewBox`.

`sizing` changes only the root tag's size attributes. The computed dimensions, the `viewBox`, and the inner SVG tree are identical in both modes.

## Coordinate system and layout model

choo-choo uses the standard SVG coordinate system (origin top-left, y grows downward). The layout model comes straight from the legacy project (and the wider railroad-diagrams tradition) because the geometry has been battle-tested for twenty years:

Every node has four measurements, computed before any SVG is emitted:

- **`width`** — horizontal extent.
- **`up`** — vertical extent *above* the rail line.
- **`down`** — vertical extent *below* the rail line.
- **`height`** — derived: `up + down`.

The **rail line** is the horizontal axis on which each node is threaded. A terminal centers its box on the rail; a sequence lays children along the rail; a choice offsets alternatives above (`up`) and below (`down`) the rail, joined by arcs.

Layout proceeds in two logical phases, though an implementation may fuse them:

1. **Measure (bottom-up).** The visitor walks the tree and returns `{ width, up, down }` for each node, combining child measurements.
2. **Emit (top-down).** With measurements known, the visitor walks the tree again and emits `<g transform="translate(x, y)">` groups at the correct positions, drawing rails, arcs, boxes, and text.

Implementers may cache measurements off-tree (e.g. a `Map<Node, Measurements>` or a parallel tree) — the IR itself is never mutated.

## Per-node rendering

This section fixes the *visual intent* of each node kind: what shape, what text, which connecting rails. Exact pixel offsets live in code and are pinned by snapshot tests.

### `diagram`

Outer container. Emits the root `<svg>` and the end-cap `start` / `end` markers, then renders `child` on the rail between them. If `child` renders taller than the markers, the markers sit on the rail at the correct vertical offset.

### `start` / `end`

Short rail stubs terminating in a vertical bar (`simple`) or double bar (`complex`). The `label` on `start`, if present, is drawn as text above the marker.

### `terminal`

A rounded-end rectangle (stadium shape) centered on the rail, containing the text. If `href` is set, the whole group is wrapped in an `<a>` element. If `title` is set, a `<title>` child is added to the group for native SVG tooltips.

### `nonterminal`

A plain rectangle centered on the rail, containing the name. Same `href` / `title` behaviour as `terminal`.

### `special`

A hexagon-ish shape (distinct from `terminal` and `nonterminal`) centered on the rail, containing the text. Same `href` / `title` behaviour.

### `comment`

Free-standing text drawn on the rail. No surrounding shape. Same `href` / `title` behaviour. Used to annotate a diagram without implying a grammar production.

### `sequence`

Children drawn left to right, joined end-to-end on the same rail. No extra glyphs.

### `choice`

Children are stacked vertically and centered on the `normal` index (which sits on the rail). Other children are offset above (smaller indices) and below (larger indices). Incoming and outgoing rails branch from the main rail via arcs — up-arc into the top child, down-arc into the bottom, etc. — and rejoin symmetrically on the right side.

The inner width of a `choice` is fixed to the widest child. Branches narrower than that need extra horizontal rail to reach the rejoin arcs. The `choiceAlignment` option controls where that slack lives:

- **`"left"` (default).** Every branch starts at the same x as the entry arcs, and the slack is a straight rail on the right, just before the exit arc. This matches the `railroad-diagrams` (Tab Atkins) tradition and is the safe choice for diffs against existing output.
- **`"center"`.** The slack is split evenly between a left stub (after the entry arc) and a right stub (before the exit arc), so each branch — including the `normal` branch on the rail — is centered inside the `choice` box. When the slack is odd, the remainder goes to the right stub so that off-rail branches meet their exit arcs cleanly.

`choiceAlignment` changes only x-coordinates of branches and their connecting stubs. It does not change the measured width, height, or vertical offsets of any node, so a diagram re-rendered with a different alignment preserves its overall bounding box.

### `optional`

A child wrapped in a skip-around path. The skip arcs above (`skip: "top"`) or below (`skip: "bottom"`) the child; the forward rail goes straight through the child.

### `repetition`

The child sits on the rail, and a return path arcs below it from the right back to the left. If `separator` is present, it is drawn on the return path, in the reverse direction.

### `group`

A dashed rectangle surrounding the child's bounding box, with the optional `label` drawn above the top edge. The child renders unchanged; `group` contributes padding but no rail modification.

### `skip`

A straight rail segment with no glyph. Its `width` is the minimum that keeps arcs meeting cleanly in the parent layout.

## Source location attributes

When `options.emitSourceData === true`, every `<g>` whose corresponding IR node carries a `source` range receives the following attributes:

| Attribute                      | Value                                                |
|--------------------------------|------------------------------------------------------|
| `data-source-offset-start`     | `source.start.offset`                                |
| `data-source-offset-end`       | `source.end.offset`                                  |
| `data-source-line-start`       | `source.start.line`                                  |
| `data-source-line-end`         | `source.end.line`                                    |
| `data-source-column-start`     | `source.start.column`                                |
| `data-source-column-end`       | `source.end.column`                                  |

Nodes without a `source` field (e.g. anything produced by the manual builder) get no `data-source-*` attributes, regardless of the flag.

When `emitSourceData` is `false` (the default), **no** `data-source-*` attributes are emitted, even if the IR carries `source`. This keeps the common-case SVG clean and predictable.

## Errors

The renderer throws a `TypeError` with a descriptive message in exactly these situations:

- The root is not a `Diagram` node (`kind !== "diagram"`).
- A node's `kind` is not a member of the union (unknown / misspelt).
- An invariant guaranteed by the IR spec is violated in a way the renderer cannot recover from safely (e.g. a `Choice` with fewer than two children). The renderer does not re-validate routine invariants — it assumes producers respect the IR contract — but it will throw rather than emit malformed SVG.

Errors are thrown synchronously. The renderer never partially returns; a thrown error means *no* SVG was produced.

## Relation to other parts of the system

- The **manual builder** (`docs/builder.md`) produces IR that the renderer accepts verbatim.
- **Grammar parsers** (`docs/grammars/*.md`) produce IR with `source` populated; the renderer honours it under `emitSourceData`.
- **Framework bindings** (`docs/bindings/*.md`) call `render` internally and pass the returned string to their framework's HTML-insertion mechanism. Bindings do not reach into the renderer's internals.
- The **stylesheet** `railroad.css` ships alongside `core`. It is *not* inlined into the SVG by the renderer; consumers choose whether to import it.
