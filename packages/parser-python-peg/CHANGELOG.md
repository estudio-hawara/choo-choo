# @choo-choo/parser-python-peg

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
