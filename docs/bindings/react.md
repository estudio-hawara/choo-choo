---
title: React binding
description: The SSR-safe <ChooChoo> React component — pure function, no hooks, works in RSC.
---

`@choo-choo/react` is the React binding. It ships a single pure functional component, `<ChooChoo>`, that renders a railroad diagram as inline SVG. The binding works unchanged in client and server contexts — including React Server Components — because the component uses no hooks, no effects, and no refs: it just calls `render()` (and, when given a grammar, `composeRule()`) from `@choo-choo/core` and returns a `<div>` wrapping the SVG via `dangerouslySetInnerHTML`.

## Install

```bash
pnpm add @choo-choo/react

# and, when using grammar-driven rendering:
pnpm add @choo-choo/parser-ebnf
```

`react` and `react-dom` are peer dependencies, `^18 || ^19`.

## The `<ChooChoo>` component

```tsx
import { ChooChoo } from "@choo-choo/react";
import { ebnfParser } from "@choo-choo/parser-ebnf";

export default function Example() {
  return (
    <ChooChoo
      source={`digit = "0" | "1";
pair = digit , digit;`}
      parser={ebnfParser}
      rule="pair"
      compose="yes"
    />
  );
}
```

No `"use client"` directive is needed. The file you just saw is a server component by default and works identically on the client.

### Props

```ts
import type {
  ComposeMode,
  Diagram,
  GrammarParser,
  RenderOptions,
} from "@choo-choo/core";
import type { HTMLAttributes } from "react";

type BaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "dangerouslySetInnerHTML" | "children"
> & {
  options?: RenderOptions;
};

export type ChooChooProps =
  | (BaseProps & { ir: Diagram })
  | (BaseProps & {
      source: string;
      parser: GrammarParser;
      rule?: string;
      compose?: ComposeMode;
    });
```

The discriminated union enforces at the type level that a consumer passes **either** a pre-built `ir` **or** the grammar inputs — not both.

| Prop       | Type                             | Default | Purpose                                                                                                    |
|------------|----------------------------------|---------|------------------------------------------------------------------------------------------------------------|
| `ir`       | `Diagram`                        | —       | A pre-built IR tree (from the manual builder or elsewhere). Mutually exclusive with the grammar props.    |
| `source`   | `string`                         | —       | Grammar source to parse. Requires `parser`.                                                                |
| `parser`   | `GrammarParser`                  | —       | An explicit parser instance. No dynamic import — consumers always choose the parser themselves.           |
| `rule`     | `string`                         | first   | Name of the rule to render. If omitted, the first rule in the parsed grammar is used.                      |
| `compose`  | `"no" \| "yes" \| "grouped"`     | `"no"`  | Inlines prior rules into the rendered diagram. See [composition](../composition.md).                       |
| `options`  | `RenderOptions`                  | —       | Forwarded to `render()` (e.g. `emitSourceData`, `arcRadius`).                                              |
| ...rest    | `HTMLAttributes<HTMLDivElement>` | —       | Any standard React HTML attribute (except `dangerouslySetInnerHTML` / `children`) is forwarded to the wrapping `<div>` — `className`, `id`, `style`, `aria-*`, `role`, event handlers, etc. |

### Output shape

The component returns:

```html
<div [...wrapperProps]>
  <svg class="choo-choo" …>…</svg>
</div>
```

`className` / `style` / `id` etc. land on the outer `<div>`. The CSS classes on the SVG are documented in [`../rendering.md`](../rendering.md#output-shape).

### Server-side rendering

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { ChooChoo } from "@choo-choo/react";

const html = renderToStaticMarkup(<ChooChoo ir={myDiagram} />);
// '<div><svg class="choo-choo" …>…</svg></div>'
```

The string that `renderToStaticMarkup()` returns is self-contained — no hydration is strictly required to display a static diagram. If the page later needs to update the diagram, a normal client rerender with new props works (React diffs the wrapper's attributes and the SVG's `__html` string; when the SVG string changes, the wrapper's inner content is replaced).

### Error handling

Parsing and rendering errors are thrown synchronously from the component. The binding does **not** ship an `<ErrorBoundary>`; wrap the component in your own boundary if you want to recover:

```tsx
<ErrorBoundary fallback={<pre>…</pre>}>
  <ChooChoo source={userInput} parser={ebnfParser} />
</ErrorBoundary>
```

The exception types are the same as elsewhere in the codebase — `GrammarSyntaxError` from `@choo-choo/parser-utils` (for parser failures), and `TypeError` from `@choo-choo/core` (for validation errors).

## Styling

The rendered SVG carries the same CSS classes documented in [`../rendering.md`](../rendering.md#output-shape). Two recommended ways to style:

1. Ship your own CSS targeting `.choo-choo .terminal rect`, `.choo-choo .non-terminal rect`, and so on.
2. Import the shared stylesheet:

   ```ts
   import "@choo-choo/react/styles.css";
   ```

   This is a one-line re-export of `@choo-choo/core/styles.css` — the canonical shared stylesheet used by every binding. Importing it more than once is harmless.

The binding does **not** inject any styles by default. Consumers opt in.

## What the binding does *not* do

- **No dynamic parser loading.** The `<choo-choo>` vanilla element accepts a `grammar="ebnf"` attribute and imports the parser on demand. The React binding does not — consumers always pass an explicit `parser`. Keeps the component pure, SSR-safe, and tree-shakable.
- **No hooks, no effects, no refs.** The component is a pure function of its props. If you need memoisation, wrap it in `React.memo`.
- **No custom events.** React error boundaries handle failures; success is implicit.
- **No ref forwarding.** Add one later if a use case shows up — scope creep otherwise.
