# @choo-choo/parser-peg

PEG (peggy / PEG.js dialect) grammar parser for [Choo Choo](https://github.com/estudio-hawara/choo-choo) railroad diagrams.

Parses a PEG grammar source string and returns an ordered list of rules, each with an IR tree ready to render.

## Install

```sh
npm install @choo-choo/core @choo-choo/parser-peg
```

## Example

```ts
import { render } from "@choo-choo/core";
import { pegParser } from "@choo-choo/parser-peg";

const source = `
digit = "0" / "1"
pair  = digit digit
`;

const parsed = pegParser.parse(source);
const pair = parsed.rules.find((r) => r.name === "pair")!;
const svg = render(pair.diagram);
```

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
