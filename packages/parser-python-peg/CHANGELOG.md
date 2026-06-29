# @choo-choo/parser-python-peg

## 0.2.0

### Minor Changes

- [#26](https://github.com/estudio-hawara/choo-choo/pull/26) [`9f3578f`](https://github.com/estudio-hawara/choo-choo/commit/9f3578f6bbaab3d9e71f417d1574828917ee776c) Thanks [@elcapo](https://github.com/elcapo)! - Add support for pegen's string-range operator `"0"..."9"` / `'a'...'z'`, the character-range notation used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html) (e.g. `name_continue: name_start | "0"..."9"`).

  A string range lowers to a single `special` IR node whose `text` is the two decoded characters joined by `...` (e.g. `"0"..."9"` → `special("0...9")`) — the same shape `@choo-choo/parser-peg` uses for charsets like `[a-z]`, so no renderer or binding change is required. The `...` (ELLIPSIS) token is ordered before the single `.` (DOT) separator binder, and a stray `...` whose left operand is not a string literal surfaces as `unexpected ELLIPSIS`.

  Spec: `docs/grammars/python-peg.md`.

## 0.1.2

### Patch Changes

- Updated dependencies [[`6afe0b3`](https://github.com/estudio-hawara/choo-choo/commit/6afe0b33b2dac86dda3b1aa92bb46749fffd5222)]:
  - @choo-choo/core@0.2.1
  - @choo-choo/parser-utils@0.1.3

## 0.1.1

### Patch Changes

- Updated dependencies [[`5b72ad0`](https://github.com/estudio-hawara/choo-choo/commit/5b72ad02438c8513b901bc947c601b6b85e656d5)]:
  - @choo-choo/core@0.2.0
  - @choo-choo/parser-utils@0.1.2

## 0.1.0

### Minor Changes

- [#11](https://github.com/estudio-hawara/choo-choo/pull/11) [`0c69df3`](https://github.com/estudio-hawara/choo-choo/commit/0c69df3f5263059e060b82e9f70ee96e580e715b) Thanks [@elcapo](https://github.com/elcapo)! - Add `@choo-choo/parser-python-peg`, a parser for the Python PEG meta-grammar dialect (the `pegen`-style notation used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html)).

  Sibling to `@choo-choo/parser-peg` rather than a replacement: the two dialects differ in operators (`:`/`|` vs `=`/`/`), bracket-form optionals, separator-aware repetition (`s.e+`), the cut operator (`~`), eager parse (`&&`), and `#` line comments. Pick the one that matches your source.

  Spec: `docs/grammars/python-peg.md`.
