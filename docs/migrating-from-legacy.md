---
title: Migrating from railroad-diagrams
description: How to migrate from Tab Atkins' railroad-diagrams library (legacy DSL) to Choo Choo.
---

If you have existing diagrams written in the legacy DSL from [Tab Atkins' railroad-diagrams](https://github.com/tabatkins/railroad-diagrams), you don't have to rewrite them all at once. A compatibility layer exists so you can keep your existing code blocks working while gradually migrating.

## Migration helper

[noxify](https://github.com/noxify) (Marcus Reinhardt) created a standalone parser that bridges the legacy DSL to Choo Choo IR:

> [Legacy Railroad DSL Parser for Choo-Choo](https://gist.github.com/noxify/d3d127752d86acf96fce2bda26a3a9cd)

The parser detects legacy `Diagram(...)`, `Choice(...)`, `Sequence(...)` calls, parses them, and returns Choo Choo IR that you can render directly — no EBNF rewrite required.

## Install

```sh
pnpm add @choo-choo/core @choo-choo/parser-utils
```

If you want React rendering:

```sh
pnpm add @choo-choo/react
```

## API

The parser exposes two functions:

- `looksLikeLegacyRailroad(source: string): boolean` — fast check if input starts with `Diagram(...)` or `ComplexDiagram(...)`.
- `parseLegacyRailroadDiagram(source: string): Diagram` — parses legacy DSL and returns Choo Choo IR.

## Basic usage

```ts
import {
  looksLikeLegacyRailroad,
  parseLegacyRailroadDiagram,
} from "./railroad-legacy-parser";
import { render } from "@choo-choo/core";

const source = `
Diagram(
  Optional("+", "skip"),
  Choice(0, NonTerminal("name-start"), NonTerminal("escape")),
  ZeroOrMore(Choice(0, NonTerminal("name-char"), NonTerminal("escape")))
)
`;

if (looksLikeLegacyRailroad(source)) {
  const ir = parseLegacyRailroadDiagram(source);
  const svg = render(ir);
  document.getElementById("diagram").innerHTML = svg;
}
```

## React integration

Drop-in component that handles both legacy DSL and EBNF:

```tsx
import { useMemo } from "react";
import { ChooChoo } from "@choo-choo/react";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import {
  looksLikeLegacyRailroad,
  parseLegacyRailroadDiagram,
} from "./railroad-legacy-parser";

export function RailroadDiagram({ code }: { code: string }) {
  const parsed = useMemo(() => {
    try {
      if (looksLikeLegacyRailroad(code)) {
        return { mode: "legacy" as const, ir: parseLegacyRailroadDiagram(code) };
      }
      ebnfParser.parse(code);
      return { mode: "ebnf" as const };
    } catch (error) {
      return {
        mode: "error" as const,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [code]);

  if (parsed.mode === "error") {
    return <pre>{parsed.error.message}</pre>;
  }

  if (parsed.mode === "legacy") {
    return <ChooChoo ir={parsed.ir} options={{ sizing: "intrinsic" }} />;
  }

  return <ChooChoo source={code} parser={ebnfParser} options={{ sizing: "intrinsic" }} />;
}
```

## MDX integration

Wire your MDX `CodeBlock` to route `railroad` fences through the auto-detecting component:

```tsx
// mdx-components.tsx
import { RailroadDiagram } from "./railroad";

export function useMDXComponents() {
  return {
    CodeBlock: (props) => {
      if (props.language === "railroad") {
        return <RailroadDiagram code={props.children as string} />;
      }
      return <CodeBlock {...props} />;
    },
  };
}
```

Now both of these work in your MDX files:

````md
```railroad
name = [ "+" ] , ( name start char | escape ) , { name char | escape } ;
```

```railroad
Diagram(
  Optional('+', 'skip'),
  Choice(0, NonTerminal('name-start'), NonTerminal('escape'))
)
```
````

## Supported constructors

| Constructor              | Status    | Notes                                           |
|--------------------------|-----------|-------------------------------------------------|
| `Diagram(...)`            | Supported | Root entry point                                |
| `ComplexDiagram(...)`     | Supported | Root entry point with complex start/end         |
| `Start(...)` / `End(...)` | Supported | Top-level only                                  |
| `Sequence(...)`           | Supported | Mapped to `sequence`                             |
| `Stack(...)`              | Supported | Mapped to `sequence`                             |
| `Choice(...)`             | Supported | Normal index supported                          |
| `HorizontalChoice(...)`   | Supported | Mapped to `choice`                               |
| `MultipleChoice(...)`     | Supported | Type arg ignored for rendering strategy         |
| `Optional(...)`           | Supported | Skip-position handling (`"top"` / `"bottom"`)   |
| `OneOrMore(...)`          | Supported | Optional separator argument                     |
| `ZeroOrMore(...)`         | Supported | Optional separator + skip position              |
| `OptionalSequence(...)`   | Supported | Best-effort mapping                             |
| `AlternatingSequence(...)`| Supported | Best-effort mapping                             |
| `Terminal(...)`           | Supported | Optional metadata (`href`, `title`)             |
| `NonTerminal(...)`        | Supported | Optional metadata (`href`, `title`)             |
| `Special(...)`            | Supported | Optional metadata (`href`, `title`)             |
| `Comment(...)`            | Supported | Optional metadata (`href`, `title`)             |
| `Group(...)`              | Supported | Optional label argument                         |
| `Skip(...)`               | Supported | Direct mapping                                 |
| Unknown constructors      | Partial   | Falls back to grouped labeled sequence         |

## Migration strategy

1. Keep your existing legacy DSL snippets unchanged.
2. Detect legacy syntax with `looksLikeLegacyRailroad`.
3. Parse to IR using `parseLegacyRailroadDiagram`.
4. Render via the Choo Choo `ir` path.
5. Optionally migrate individual snippets to EBNF over time.

## Attribution

- Legacy DSL concepts based on [railroad-diagrams](https://github.com/tabatkins/railroad-diagrams) by [@tabatkins](https://github.com/tabatkins).
- Migration helper created by [@noxify](https://github.com/noxify) (Marcus Reinhardt) and shared as a [public Gist](https://gist.github.com/noxify/d3d127752d86acf96fce2bda26a3a9cd).
