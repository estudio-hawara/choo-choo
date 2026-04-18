# @choo-choo/parser-utils

Shared lexer primitives for [Choo Choo](https://github.com/estudio-hawara/choo-choo) grammar parsers: `Reader`, `Tokenizer`, `Specification`, and `GrammarSyntaxError`.

This package is infrastructure for parser *authors*. If you just want to render a diagram from an existing grammar dialect, install one of the grammar parsers directly: [`@choo-choo/parser-ebnf`](https://www.npmjs.com/package/@choo-choo/parser-ebnf), [`@choo-choo/parser-antlr`](https://www.npmjs.com/package/@choo-choo/parser-antlr), [`@choo-choo/parser-peg`](https://www.npmjs.com/package/@choo-choo/parser-peg).

## Install

```sh
npm install @choo-choo/parser-utils
```

## Example

```ts
import { Reader, Specification, Tokenizer } from "@choo-choo/parser-utils";

const spec = new Specification()
  .add(/^\s+/, null)
  .add(/^\d+/, "digit")
  .add(/^[A-Za-z]+/, "word")
  .add(/^\+/, "plus");

const tokenizer = new Tokenizer(new Reader("abc + 42"), spec);

for (let token = tokenizer.next(); token; token = tokenizer.next()) {
  console.log(token.type, token.value);
}
```

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
