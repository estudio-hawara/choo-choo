---
title: Composition
description: The opt-in `composeRule` transform that inlines prior rules into a rendered diagram.
---

A grammar is usually split across many rules that reference each other by name. By default, choo-choo renders **one rule at a time**: pick a rule, get a diagram whose `NonTerminal` leaves are the names of the other rules. Composition is an opt-in transform that **inlines those references** so a rule can be rendered as a single self-contained diagram.

Composition lives in `@choo-choo/core` as a pure function over `ParsedGrammar`. It does not touch the renderer, the parsers, or the bindings — every binding simply surfaces a `compose` attribute/option that routes through the same transform.

## API

```ts
import type { Diagram, ParsedGrammar } from "@choo-choo/core";

export type ComposeMode = "no" | "yes" | "grouped";

export function composeRule(
  grammar: ParsedGrammar,
  ruleName: string,
  mode: ComposeMode,
): Diagram;
```

- `grammar` — the output of a `GrammarParser.parse(source)` call.
- `ruleName` — the rule whose composed diagram you want. Throws if the name is not present in `grammar.rules`.
- `mode` — see below.

The return value is a `Diagram` ready to hand to `render()`.

## Modes

| Mode       | Behaviour                                                                                        |
|------------|--------------------------------------------------------------------------------------------------|
| `"no"`     | Pass-through: returns the rule's diagram unchanged. Identical to picking `rule` without compose. |
| `"yes"`    | Inline every `NonTerminal` that references a **prior** rule, recursively.                        |
| `"grouped"` | Same as `"yes"`, but each inlined subtree is wrapped in a `Group` whose `label` is the replaced rule's name. |

### What "prior" means

When composing rule *R* at index `i` in `grammar.rules`, a `NonTerminal` with `name === N` is inlined **iff** *N* is the name of a rule at index `< i`. Forward references (rules defined after *R* in source order) and direct/indirect recursion are left as `NonTerminal` leaves.

This rule is what makes composition total and cycle-free by construction: the grammar's source order is a topological order over the substitution relation, and the substitution only ever goes "up" that order. No cycle detection is necessary.

### Bottom-up fold

The algorithm walks `grammar.rules` once, in source order, building a `Map<string, Diagram>` of already-composed rules. For each rule *R*:

1. Deep-clone `R.diagram`.
2. Walk the clone. For every `NonTerminal{name}`:
   - If `name` is present in the map, replace the `NonTerminal` with the mapped diagram's `child` (plus wrapping in a `Group` labelled `name` when `mode === "grouped"`).
   - Otherwise, leave the `NonTerminal` untouched.
3. Insert the cloned diagram into the map under `R.name`.

After the walk, `composeRule` returns `map.get(ruleName)`.

### Worked example

Given:

```ebnf
digit      = ? 0-9 ?;
number     = digit , { digit };
expression = term , { ("+" | "-") , term };
term       = factor , { ("*" | "/") , factor };
factor     = number | "(" , expression , ")";
```

- `composeRule(parsed, "number", "yes")` is equivalent to rendering:

  ```ebnf
  number = ? 0-9 ? , { ? 0-9 ? };
  ```

  because `digit` is prior to `number` and is therefore inlined.

- `composeRule(parsed, "number", "grouped")` produces the same shape, except each occurrence of the inlined `digit` subtree is wrapped in a labelled `Group` named `digit`.

- `composeRule(parsed, "expression", "yes")` inlines nothing — `expression`'s only referenced rule is `term`, which is defined *after* `expression`. The diagram is identical to the `"no"` output.

- `composeRule(parsed, "factor", "yes")` inlines `number` and `expression` (both prior). Within the substituted `expression`, `term` remains a `NonTerminal` because inside `expression` it was still a forward reference.

## Scope

Composition applies **only** to grammar-driven renders. When a binding is given a pre-built `{ ir }` there is no grammar to reason about, so `compose` is ignored (and bindings SHOULD omit the option from that code path entirely rather than silently accepting it).

The transform does not dedupe inlined subtrees: if rule *A* references *B* three times and `B` is prior, `B`'s diagram appears three times in the composed output. That is intentional — deduping would require sharing, which breaks the IR's tree-shaped invariant (see `docs/ir.md`, design rule 3).
