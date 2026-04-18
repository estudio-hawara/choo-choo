# @choo-choo/parser-ebnf

EBNF (ISO/IEC 14977 subset) grammar parser for [Choo Choo](https://github.com/estudio-hawara/choo-choo) railroad diagrams.

Parses an EBNF source string and returns an ordered list of rules, each with an IR tree ready to render.

## Install

```sh
npm install @choo-choo/core @choo-choo/parser-ebnf
```

## Example

```ts
import { render } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const source = `
digit = "0" | "1" ;
pair  = digit , digit ;
`;

const parsed = ebnfParser.parse(source);
const pair = parsed.rules.find((r) => r.name === "pair")!;
const svg = render(pair.diagram);
```

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
