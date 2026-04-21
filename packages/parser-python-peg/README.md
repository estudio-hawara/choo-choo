# @choo-choo/parser-python-peg

Python PEG (pegen dialect) grammar parser for [Choo Choo](https://github.com/estudio-hawara/choo-choo) railroad diagrams.

Parses the Python PEG meta-grammar — the dialect used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html) — and returns an ordered list of rules, each with an IR tree ready to render.

This is a different dialect from the peggy parser shipped in `@choo-choo/parser-peg`. See the spec for the full diff.

## Install

```sh
npm install @choo-choo/core @choo-choo/parser-python-peg
```

## Example

```ts
import { render } from "@choo-choo/core";
import { pythonPegParser } from "@choo-choo/parser-python-peg";

const source = `
boolean:
    | 'True'
    | 'False'
    | 'None'

import_from_as_names: ','.import_from_as_name+
`;

const parsed = pythonPegParser.parse(source);
const boolean = parsed.rules.find((r) => r.name === "boolean")!;
const svg = render(boolean.diagram);
```

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
