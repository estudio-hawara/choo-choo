---
title: Vanilla JS binding
description: The framework-free <choo-choo> custom element plus an imperative mount() helper.
---

`@choo-choo/vanilla` is the framework-free binding. It ships two entry points that speak to the same underlying renderer:

- **A custom element `<choo-choo>`** — declarative, reactive, styled by the consumer.
- **An imperative `mount()` function** — called from plain JavaScript when the consumer wants to render into an existing DOM node without installing a custom element.

Both are thin wrappers around `render()` from `@choo-choo/core`. They do not bundle any grammar parser — the parser is either passed in explicitly or loaded on demand via a dynamic `import()`.

## Install

```bash
pnpm add @choo-choo/vanilla

# and, when using grammar-driven rendering:
pnpm add @choo-choo/parser-ebnf
```

The vanilla binding is **client-only**: it reaches for `customElements`, `HTMLElement`, and `innerHTML`. Call `render()` from `@choo-choo/core` directly if you need SSR.

## The `<choo-choo>` custom element

Registered the first time `@choo-choo/vanilla` is imported — calling `import "@choo-choo/vanilla"` for its side effects is enough to make `<choo-choo>` available anywhere in the document.

### Attributes

| Attribute  | Type                          | Default | Purpose                                                                                               |
|------------|-------------------------------|---------|-------------------------------------------------------------------------------------------------------|
| `source`   | string                        | —       | Grammar source to parse. Paired with `grammar` (or the `.parser` property).                           |
| `grammar`  | string                        | —       | Short id of the grammar (`"ebnf"`, `"antlr"`, `"peg"`, …). Triggers a dynamic `import()` of the parser. |
| `rule`     | string                        | —       | Name of the rule to render from the parsed grammar. If omitted, the first rule is rendered.           |
| `compose`  | `"no" \| "yes" \| "grouped"` | `"no"`  | Inlines references to prior rules into the rendered rule. See [composition](../composition.md).       |

Attributes are reactive: changing any of them triggers a re-render. Setting `source` or `grammar` to an empty string clears the diagram. An unknown `compose` value raises a render error.

Alternatively to the `source` attribute, the grammar source can live inside the element as its text content — see [Source from element contents](#source-from-element-contents) below. This is the recommended shape for multi-line grammars.

### Source from element contents

When the `source` attribute is absent, the element reads its own `textContent` (trimmed) and uses that as the grammar source. This keeps multi-line grammars readable in hand-written HTML:

```html
<choo-choo grammar="ebnf">
  expr = a , b | c , d;
  term = x | y;
</choo-choo>
```

Behaviour:

- **Precedence**: if both the `source` attribute and text content are present, the attribute wins.
- **Whitespace**: the content is passed through `String.prototype.trim()` — leading and trailing whitespace (including the newlines and indentation introduced by HTML formatting) is stripped. No dedent is applied; that's safe because the three launch parsers (EBNF, ANTLR, PEG) are whitespace-insensitive at the lexical level.
- **When it's captured**: the element reads `textContent` during its first render on `connectedCallback`, and re-reads it on each attribute change that would require re-parsing. There is **no** `MutationObserver` over children — that would introduce render loops (the element writes SVG into its own `innerHTML`, which would mutate children and re-trigger the observer). For reactive updates, write to the `source` attribute or set the `.ir` property instead.
- **Overwriting**: once the element renders, the SVG replaces the text children. That's expected — the textContent was captured upfront, so the render can safely overwrite what the HTML author typed.

### Properties

| Property   | Type            | Purpose                                                                                                      |
|------------|-----------------|--------------------------------------------------------------------------------------------------------------|
| `ir`       | `Diagram \| undefined` | A pre-built IR tree (from the manual builder or elsewhere). When set, bypasses the parser path. |
| `parser`   | `GrammarParser \| undefined` | An explicit parser instance. When set, takes precedence over the `grammar` attribute (no dynamic import). |
| `options`  | `RenderOptions \| undefined` | Options passed to `render()` (e.g. `emitSourceData`, `arcRadius`).                              |

Properties are reactive too.

### Precedence

The element decides what to render by this order (first match wins):

1. `.ir` property — renders it directly.
2. `.parser` property **and** a source (`source` attribute or trimmed `textContent`) — parses and renders the selected rule.
3. `grammar` attribute **and** a source (`source` attribute or trimmed `textContent`) — dynamically imports the parser (`@choo-choo/parser-<grammar>`), parses and renders the selected rule.
4. Otherwise — clears the element.

"Source" in items 2 and 3 means the `source` attribute if present, otherwise the element's `textContent` trimmed. See [Source from element contents](#source-from-element-contents) for details.

### Events

| Event name         | Detail                                      | When it fires                                   |
|--------------------|---------------------------------------------|-------------------------------------------------|
| `choo-choo-render` | `{ svg: string }`                           | After a successful render.                      |
| `choo-choo-error`  | `{ error: Error }`                          | When parsing or rendering throws.               |

Both events bubble. The element also falls back to rendering an error message inside itself when an error occurs (so the failure is visible in the UI even without listeners).

### Lifecycle

- `connectedCallback` schedules the first render on a microtask so all attributes can be set before the DOM is read.
- `attributeChangedCallback` and property setters coalesce into a single render per microtask.
- `disconnectedCallback` clears the element's contents.

### Example — declarative

```html
<choo-choo grammar="ebnf" source="expr = a , b | c , d;"></choo-choo>
```

Imports:

```ts
import "@choo-choo/vanilla";
```

That single side-effect import is enough for the element above to register and render. The `@choo-choo/parser-ebnf` package is fetched on demand the first time a `<choo-choo grammar="ebnf">` is rendered.

### Example — declarative, multi-line grammar

The same effect as the `source` attribute, but with the grammar inline as children — easier to read and easier to edit in hand-written HTML:

```html
<choo-choo grammar="ebnf">
  expr = a , b | c , d;
  term = x | y;
</choo-choo>
```

No `source` attribute required. The element reads its `textContent`, trims it, and parses. See [Source from element contents](#source-from-element-contents) for the precedence rules and reactivity caveats.

### Example — mixed (declarative element, explicit parser)

```ts
import "@choo-choo/vanilla";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const element = document.querySelector("choo-choo");
element.parser = ebnfParser;          // bypasses dynamic import
element.setAttribute("source", "x = 'hi';");
```

### Example — manual IR via the `.ir` property

```ts
import "@choo-choo/vanilla";
import { diagram, terminal, sequence } from "@choo-choo/core";

document.querySelector("choo-choo").ir = diagram(
  sequence(terminal("a"), terminal("b")),
);
```

## The `mount()` function

```ts
import type { Diagram, GrammarParser, RenderOptions } from "@choo-choo/core";

type MountOptions =
  | { ir: Diagram; options?: RenderOptions }
  | {
      source: string;
      parser: GrammarParser;
      rule?: string;
      compose?: "no" | "yes" | "grouped";
      options?: RenderOptions;
    };

function mount(target: Element, options: MountOptions): () => void;
```

The returned function unmounts: it clears the target's contents and releases any state the binding attached to it.

`mount()` is a one-shot render. Call it again to update. It does **not** observe attribute or property changes — use `<choo-choo>` for that.

Behaviour:

- The target is emptied and its `innerHTML` replaced by the rendered SVG string.
- If `options` resolves to a multi-rule `ParsedGrammar`, the `rule` field selects which rule to draw. Without `rule`, the first rule wins.
- The `compose` field routes the selected rule through [`composeRule`](../composition.md) before rendering. Default `"no"`.
- Parsing or rendering errors are rethrown synchronously; the target is left empty.

### Example

```ts
import { mount } from "@choo-choo/vanilla";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const unmount = mount(document.querySelector("#diagram"), {
  source: "expr = a , b | c , d;",
  parser: ebnfParser,
});

// later:
unmount();
```

## Dynamic parser loading

Only the `<choo-choo>` custom element does this; `mount()` always takes an explicit `parser`.

When the element sees a `grammar` attribute change and no `.parser` property is set, it runs:

```ts
const module = await import(`@choo-choo/parser-${id}`);
const parser = module[`${id}Parser`] ?? module.default;
```

The result is cached on the element's module cache — a second `<choo-choo grammar="ebnf">` on the same page does not re-import the parser. If the dynamic import fails (module missing, bundler couldn't resolve it), the element emits `choo-choo-error` and renders an inline error message.

Bundler implications:

- **Vite / webpack / Rollup** will typically emit a code-split chunk per parser — users who never render `<choo-choo grammar="peg">` pay no download cost for the PEG parser.
- In environments without dynamic imports (older bundlers, no-bundler workflows), consumers should set `.parser` explicitly and avoid `grammar`.

## Styling

The rendered SVG carries the same CSS classes documented in [`../rendering.md`](../rendering.md#output-shape). Two recommended ways to style:

1. Ship your own CSS targeting `.choo-choo .terminal rect`, `.choo-choo .non-terminal rect`, and so on.
2. Import the shared stylesheet:

   ```ts
   import "@choo-choo/vanilla/styles.css";
   ```

   The canonical file lives in `@choo-choo/core/styles.css`; the vanilla subexport is a one-line re-export for convenience so consumers don't need to reach into `core` themselves. Every binding follows the same pattern. Importing it more than once is harmless.

The binding does **not** inject any styles by default. Consumers opt in.

## Error handling

- Validation errors from `render()` (invalid root, unknown `kind`) surface as thrown `TypeError`s.
- Parser errors surface as `GrammarSyntaxError` (exported from `@choo-choo/parser-utils`) with a `position` field.
- The `<choo-choo>` element catches both and fires `choo-choo-error`, while `mount()` rethrows.

## Server-side rendering

The binding is client-only. For server rendering, call `render(diagram)` directly from `@choo-choo/core`, send the resulting string to the client, and hydrate with `mount()` (or the element) once in the browser.
