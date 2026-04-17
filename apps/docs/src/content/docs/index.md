---
title: choo-choo
description: Render railroad (syntax) diagrams from EBNF, ANTLR, or PEG grammars. SVG only, no runtime dependencies.
---

**choo-choo** is a TypeScript library that turns a grammar into an SVG [railroad diagram](https://en.wikipedia.org/wiki/Syntax_diagram). It supports three grammar formalisms (EBNF, ANTLR4, PEG) and four framework bindings (vanilla JS, React, Vue, Astro). Rendering is pure — an IR tree in, an SVG string out — so the renderer runs anywhere JavaScript does.

## Quick start

Pick a grammar format and a binding. The simplest path in 2025 is the custom element from `@choo-choo/vanilla`:

```
pnpm add @choo-choo/vanilla @choo-choo/parser-ebnf
```

```html
<script type="module">
  import "@choo-choo/vanilla";
  import "@choo-choo/vanilla/styles.css";
  import { ebnfParser } from "@choo-choo/parser-ebnf";
  const el = document.querySelector("choo-choo");
  el.parser = ebnfParser;
</script>

<choo-choo compose="grouped">
  digit  = ? 0-9 ?;
  number = digit , { digit };
</choo-choo>
```

React, Vue, and Astro ship equivalent components under `@choo-choo/react`, `@choo-choo/vue`, and `@choo-choo/astro`. All four bindings consume the same IR and the same core renderer — the binding is just the adapter that inserts SVG into its framework's tree.

## The three layers

1. **Core** (`@choo-choo/core`) — the IR, the manual builder, and the pure `render()` function. See [Architecture](/architecture/) and [IR](/ir/).
2. **Parsers** — one package per grammar formalism, each producing the same `ParsedGrammar` shape. See [EBNF](/grammars/ebnf/), [ANTLR](/grammars/antlr/), and [PEG](/grammars/peg/).
3. **Bindings** — framework-specific adapters that take either a pre-built IR or a `{ source, parser }` pair and render the SVG into the host tree. See [Vanilla](/bindings/vanilla/), [React](/bindings/react/), [Vue](/bindings/vue/), and [Astro](/bindings/astro/).

## Try it out

The [playground](https://github.com/anthropics/choo-choo) demo (`apps/playground/` in the repo) lets you type a grammar in EBNF, ANTLR, or PEG and see the rendered diagram update live. Use it to iterate on a grammar before wiring the library into your own app.
