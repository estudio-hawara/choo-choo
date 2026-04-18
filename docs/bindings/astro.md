---
title: Astro binding
description: The SSR-only <ChooChoo> Astro component — renders to inline HTML, no client runtime.
---

`@choo-choo/astro` is the Astro binding. It ships a single server-rendered component — `ChooChoo.astro` — that renders a railroad diagram as inline SVG at build time (or on every request in SSR mode). Because Astro runs the component on the server and emits plain HTML, there's no hydration, no client bundle, and no framework runtime on the page.

## Install

```bash
pnpm add @choo-choo/astro

# and, when using grammar-driven rendering:
pnpm add @choo-choo/parser-ebnf
```

`astro` is a peer dependency — range `^4 || ^5`.

## The `<ChooChoo>` component

```astro
---
import ChooChoo from "@choo-choo/astro";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const source = `digit = "0" | "1";
pair = digit , digit;`;
---

<ChooChoo source={source} parser={ebnfParser} rule="pair" compose="yes" />
```

The component is imported as the default export. Astro's package resolver follows the `astro` export condition in `package.json` to reach the underlying `.astro` file; no special plugin or integration is required.

### Props

```ts
import type {
  ComposeMode,
  Diagram,
  GrammarParser,
  RenderOptions,
} from "@choo-choo/core";
import type { HTMLAttributes } from "astro/types";

type BaseProps = Omit<
  HTMLAttributes<"div">,
  "set:html"
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

| Prop       | Type                          | Default | Purpose                                                                                                |
|------------|-------------------------------|---------|--------------------------------------------------------------------------------------------------------|
| `ir`       | `Diagram`                     | —       | A pre-built IR tree. Mutually exclusive with the grammar props.                                        |
| `source`   | `string`                      | —       | Grammar source to parse. Requires `parser`.                                                            |
| `parser`   | `GrammarParser`               | —       | An explicit parser instance.                                                                           |
| `rule`     | `string`                      | first   | Name of the rule to render. If omitted, the first rule wins.                                           |
| `compose`  | `"no" \| "yes" \| "grouped"`  | `"no"`  | Inlines prior rules into the rendered diagram. See [composition](../composition.md).                   |
| `options`  | `RenderOptions`               | —       | Forwarded to `render()`.                                                                               |
| ...rest    | `HTMLAttributes<"div">`       | —       | Any standard HTML attribute (except `set:html`) lands on the wrapping `<div>` — `class`, `style`, `id`, `aria-*`, etc. |

### Output shape

```html
<div [...wrapperProps]>
  <svg class="choo-choo" …>…</svg>
</div>
```

### Server-side rendering

There is no client path: `.astro` components always run on the server. The HTML emitted by the component contains the SVG inline and needs no hydration. If you need the diagram to update in response to client-side state, import a different binding (`@choo-choo/react`, `@choo-choo/vue`, `@choo-choo/vanilla`) from inside an Astro island.

### Error handling

Parsing and rendering errors throw during Astro's build (or during an SSR request). Astro's default behaviour surfaces the error page; in pages you want to recover from, wrap the `<ChooChoo>` usage in your own `try { … } catch { … }` block inside the frontmatter and render an alternative.

## Styling

The rendered SVG carries the same CSS classes documented in [`../rendering.md`](../rendering.md#output-shape). Two recommended ways to style:

1. Ship your own CSS targeting `.choo-choo .terminal rect`, `.choo-choo .non-terminal rect`, and so on.
2. Import the shared stylesheet from a layout or page:

   ```ts
   import "@choo-choo/astro/styles.css";
   ```

   This is a one-line re-export of `@choo-choo/core/styles.css`. Importing it more than once is harmless.

## What the binding does *not* do

- **No client-side hydration.** `<ChooChoo>` is SSR-only by construction.
- **No dynamic parser loading.** Always pass an explicit `parser`.
- **No slots.** The component's children would land nowhere useful (the SVG replaces them); slots are not accepted.
