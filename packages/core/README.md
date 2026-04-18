# @choo-choo/core

IR, manual builder and SVG renderer for [Choo Choo](https://github.com/estudio-hawara/choo-choo) railroad diagrams.

Zero runtime dependencies. SSR-safe: the renderer emits an SVG string and never touches the DOM.

## Install

```sh
npm install @choo-choo/core
```

## Example

```ts
import { diagram, sequence, terminal, render } from "@choo-choo/core";

const ir = diagram(sequence(terminal("return")));
const svg = render(ir);
```

`render` returns an SVG string — inject it from your framework of choice, or use one of the prebuilt bindings: [`@choo-choo/react`](https://www.npmjs.com/package/@choo-choo/react), [`@choo-choo/vue`](https://www.npmjs.com/package/@choo-choo/vue), [`@choo-choo/astro`](https://www.npmjs.com/package/@choo-choo/astro), [`@choo-choo/vanilla`](https://www.npmjs.com/package/@choo-choo/vanilla).

To build diagrams from a grammar source instead of by hand, combine `core` with a grammar parser: [`@choo-choo/parser-ebnf`](https://www.npmjs.com/package/@choo-choo/parser-ebnf), [`@choo-choo/parser-antlr`](https://www.npmjs.com/package/@choo-choo/parser-antlr), [`@choo-choo/parser-peg`](https://www.npmjs.com/package/@choo-choo/parser-peg).

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
