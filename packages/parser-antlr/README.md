# @choo-choo/parser-antlr

ANTLR4 grammar parser for [Choo Choo](https://github.com/estudio-hawara/choo-choo) railroad diagrams.

Parses an ANTLR4 grammar source string and returns an ordered list of rules, each with an IR tree ready to render.

## Install

```sh
npm install @choo-choo/core @choo-choo/parser-antlr
```

## Example

```ts
import { render } from "@choo-choo/core";
import { antlrParser } from "@choo-choo/parser-antlr";

const source = `
grammar Demo;
pair : digit digit ;
digit : '0' | '1' ;
`;

const parsed = antlrParser.parse(source);
const pair = parsed.rules.find((r) => r.name === "pair")!;
const svg = render(pair.diagram);
```

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
