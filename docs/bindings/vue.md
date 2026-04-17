---
title: Vue binding
description: The SSR-safe <ChooChoo> Vue 3 component — defineComponent + render function, hook-free.
---

`@choo-choo/vue` is the Vue 3 binding. It ships a single pure functional component, `<ChooChoo>`, that renders a railroad diagram as inline SVG. The binding uses no reactive state, no lifecycle hooks, and no template compiler — it's a `defineComponent` + render function that calls `render()` (and, when given a grammar, `composeRule()`) from `@choo-choo/core` and returns a `<div>` wrapping the SVG via Vue's `innerHTML` prop.

## Install

```
pnpm add @choo-choo/vue vue
# and, when using grammar-driven rendering:
pnpm add @choo-choo/parser-ebnf
```

`vue` is a peer dependency — range `^3.3 || ^3.4 || ^3.5`.

## The `<ChooChoo>` component

```vue
<script setup lang="ts">
import { ChooChoo } from "@choo-choo/vue";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const source = `digit = "0" | "1";
pair = digit , digit;`;
</script>

<template>
  <ChooChoo :source="source" :parser="ebnfParser" rule="pair" compose="yes" />
</template>
```

No special directive or setup is required. The component is pure — same props, same output, both on the server and on the client.

### Props

```ts
import type {
  ComposeMode,
  Diagram,
  GrammarParser,
  RenderOptions,
} from "@choo-choo/core";
import type { HTMLAttributes } from "vue";

type BaseProps = Omit<
  HTMLAttributes,
  "innerHTML"
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

| Prop       | Type                          | Default | Purpose                                                                                                 |
|------------|-------------------------------|---------|---------------------------------------------------------------------------------------------------------|
| `ir`       | `Diagram`                     | —       | A pre-built IR tree (from the manual builder or elsewhere). Mutually exclusive with the grammar props. |
| `source`   | `string`                      | —       | Grammar source to parse. Requires `parser`.                                                             |
| `parser`   | `GrammarParser`               | —       | An explicit parser instance. No dynamic import — consumers always choose the parser themselves.        |
| `rule`     | `string`                      | first   | Name of the rule to render. If omitted, the first rule in the parsed grammar is used.                   |
| `compose`  | `"no" \| "yes" \| "grouped"`  | `"no"`  | Inlines prior rules into the rendered diagram. See [composition](../composition.md).                    |
| `options`  | `RenderOptions`               | —       | Forwarded to `render()` (e.g. `emitSourceData`, `arcRadius`).                                           |
| ...rest    | `HTMLAttributes`              | —       | Any standard Vue HTML attribute (except `innerHTML`) is forwarded to the wrapping `<div>` via Vue's attribute-fallthrough — `class`, `style`, `id`, `aria-*`, `role`, event listeners, etc. |

### Output shape

The component returns:

```html
<div [...fallthroughAttrs]>
  <svg class="choo-choo" …>…</svg>
</div>
```

Vue's attribute-fallthrough automatically lands non-declared attributes (`class`, `style`, `id`, `data-*`, listeners) on the outer `<div>`. The CSS classes on the SVG are documented in [`../rendering.md`](../rendering.md#output-shape).

### Server-side rendering

```ts
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import { ChooChoo } from "@choo-choo/vue";

const app = createSSRApp({
  components: { ChooChoo },
  template: `<ChooChoo :ir="ir" />`,
  data: () => ({ ir: myDiagram }),
});
const html = await renderToString(app);
// '<div><svg class="choo-choo" …>…</svg></div>'
```

The string `renderToString()` returns is self-contained — no hydration is strictly required to display a static diagram. Dynamic updates (new `ir` / `source` prop) on the client trigger a re-render and Vue diffs the wrapper's attributes plus the SVG's `innerHTML`.

### Error handling

Parsing and rendering errors are thrown synchronously from the render function. The binding does **not** ship an error-boundary wrapper; use Vue 3's `onErrorCaptured` hook or a custom error-boundary component:

```vue
<script setup>
import { onErrorCaptured, ref } from "vue";
const error = ref(null);
onErrorCaptured((err) => { error.value = err; return false; });
</script>
```

The exception types are the same as elsewhere in the codebase — `GrammarSyntaxError` from `@choo-choo/parser-utils`, and `TypeError` from `@choo-choo/core`.

## Styling

The rendered SVG carries the same CSS classes documented in [`../rendering.md`](../rendering.md#output-shape). Two recommended ways to style:

1. Ship your own CSS targeting `.choo-choo .terminal rect`, `.choo-choo .non-terminal rect`, and so on.
2. Import the shared stylesheet:

   ```ts
   import "@choo-choo/vue/styles.css";
   ```

   This is a one-line re-export of `@choo-choo/core/styles.css` — the canonical shared stylesheet used by every binding. Importing it more than once is harmless.

The binding does **not** inject any styles by default. Consumers opt in.

## What the binding does *not* do

- **No dynamic parser loading.** Consumers always pass an explicit `parser`.
- **No reactive hooks, no effects, no refs.** The component is a pure function of its props. For memoisation, wrap the parent or use `computed` in the caller.
- **No custom events.** Vue's error-capture API and normal error propagation handle failures; success is implicit.
- **No template compilation.** `@choo-choo/vue` ships as pre-compiled `h()` calls — no `.vue` files, so consumers without Vue's SFC compiler still work.

## Open questions

- **Event surface for parse errors** — should the component emit `@error` to complement the "throw and let the boundary catch it" flow? Deferred until a real use case appears.
- **Provide/inject for a shared parser** — could let a tree of diagrams use one parser instance without re-passing as prop. Deferred.
