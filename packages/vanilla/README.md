# @choo-choo/vanilla

Vanilla JS binding for [Choo Choo](https://github.com/estudio-hawara/choo-choo): a `<choo-choo>` custom element and an imperative `mount()` helper for rendering a railroad diagram from a grammar source or a pre-built IR.

## Install

```sh
npm install @choo-choo/vanilla
```

Plus one grammar parser of your choice if you want to pass a `source`:

```sh
npm install @choo-choo/parser-ebnf
```

## Example

```ts
import { mount } from "@choo-choo/vanilla";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const unmount = mount(document.querySelector("#diagram")!, {
  source: `
    digit = "0" | "1" ;
    pair  = digit , digit ;
  `,
  parser: ebnfParser,
  rule: "pair",
});

// later, when you want to tear it down:
unmount();
```

Prefer a declarative style? Import `@choo-choo/vanilla` for its side effect — it registers a `<choo-choo>` custom element you can drop straight into HTML.

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
