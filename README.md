# choo-choo

A TypeScript library for railroad diagrams — built by hand or generated from grammars. Ships as a pure SVG renderer with pluggable parsers and first-class bindings for **React**, **Vue**, **Astro**, and **Vanilla JS**.

Docs: <https://estudio-hawara.github.io/choo-choo>

## Quick start

End-to-end walkthrough from `pnpm init` to a diagram in a browser: **[docs/quickstart](./docs/quickstart/index.md)**.

The shortest API shape — vanilla binding with an EBNF grammar — looks like this:

```html
<choo-choo compose="grouped">
  digit  = ? 0-9 ?;
  number = digit , { digit };
</choo-choo>
```

```ts
import "@choo-choo/vanilla";
import "@choo-choo/vanilla/styles.css";
import { ebnfParser } from "@choo-choo/parser-ebnf";
document.querySelector("choo-choo")!.parser = ebnfParser;
```

Equivalent components exist for React, Vue, and Astro — see each binding's README.

## Packages

| Package                                                                        | Purpose                                                   |
|--------------------------------------------------------------------------------|-----------------------------------------------------------|
| [`@choo-choo/core`](./packages/core)                 | IR, manual builder, and SVG renderer. Zero runtime deps.  |
| [`@choo-choo/parser-utils`](./packages/parser-utils) | Shared reader / tokenizer primitives for grammar parsers. |
| [`@choo-choo/parser-ebnf`](./packages/parser-ebnf)   | ISO/IEC 14977 EBNF parser.                                |
| [`@choo-choo/parser-antlr`](./packages/parser-antlr) | ANTLR4 grammar parser.                                    |
| [`@choo-choo/parser-peg`](./packages/parser-peg)     | PEG (peggy / PEG.js dialect) parser.                      |
| [`@choo-choo/vanilla`](./packages/vanilla)           | `<choo-choo>` custom element + imperative `mount()`.      |
| [`@choo-choo/react`](./packages/react)               | React `<ChooChoo>` component, SSR-safe.                   |
| [`@choo-choo/vue`](./packages/vue)                   | Vue 3 `<ChooChoo>` component, SSR-safe.                   |
| [`@choo-choo/astro`](./packages/astro)               | Astro `<ChooChoo>` component, SSR-only.                   |

## Repository map

- [`docs/quickstart/`](./docs/quickstart/index.md) — from `pnpm init` to a diagram in a browser.
- [`docs/architecture.md`](./docs/architecture.md) — target architecture and module boundaries.
- [`docs/development.md`](./docs/development.md) — development workflow and tooling.
- [`docs/contributing.md`](./docs/contributing.md) — how to contribute.
- [`docs/migrating-from-legacy.md`](./docs/migrating-from-legacy.md) — migrating from Tab Atkins' railroad-diagrams.
- [`docs/releasing.md`](./docs/releasing.md) — versioning policy and publish flow.
- [`docs/roadmap/`](./docs/roadmap/) — milestones for each release.

## Inspiration

### Railroad Diagrams

> [!NOTE]
> This project is an evolution of [Railroad Diagrams](https://github.com/tabatkins/railroad-diagrams) by [@tabatkins](https://github.com/tabatkins/), with the addition of the (E)BNF parsers that simplify the construction of the diagrams when you already have a defined grammar.

### Parser from Scratch

> [!NOTE]
> I started writing this library while studying the [Parser from scratch](http://dmitrysoshnikov.com/courses/parser-from-scratch/) course from [@dmitrysoshnikov](https://github.com/dmitrysoshnikov/), so you may find several similarities with his approach to recursive descent parser. Following his courses will definitely help you understanding this codebase.

## License

[MIT](./LICENSE) © [Estudio Hawara](https://hawara.es).
