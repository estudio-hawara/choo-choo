---
title: Choo Choo
description: Render railroad (syntax) diagrams from EBNF, ANTLR, or PEG grammars. SVG only, no runtime dependencies.
---

**Choo Choo** is a TypeScript library that turns a grammar into an SVG railroad diagram. It supports three grammar formalisms (EBNF, ANTLR4, PEG) and four framework bindings (vanilla JS, React, Vue, Astro). Rendering is pure — a tree in, an SVG string out — so the renderer runs anywhere JavaScript does.

## Quick start

The simplest path is the custom element from `@choo-choo/vanilla`:

```bash
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

## The three layers

| Layer | Module | Description |
| --- | --- | --- |
| Core | [Architecture](./architecture.md) | Choo Choo architecture |
| Core | [Intermediate representation](./ir.md) | Representation for manual renders |
| Core | [Renderer](./rendering.md) | SVG renderer |
| Core | [Manual builder](./builder.md) | Manual builder |
| Parsers | [EBNF](./grammars/ebnf.md) | Parser for EBNF grammars |
| Parsers | [ANTLR](./grammars/antlr.md) | Parser for ANTLR grammars |
| Parsers | [PEG](./grammars/peg.md) | Parser for PEG grammars |
| Bindings | [Vanilla](./bindings/vanilla.md) | Bindings for Vanilla |
| Bindings | [React](./bindings/react.md) | Bindings for React |
| Bindings | [Vue](./bindings/vue.md) | Bindings for Vie |
| Bindings | [Astro](./bindings/astro.md) | Bindings for Astro |
