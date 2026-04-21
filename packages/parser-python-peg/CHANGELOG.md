# @choo-choo/parser-python-peg

## 0.1.0

### Minor Changes

- [#11](https://github.com/estudio-hawara/choo-choo/pull/11) [`0c69df3`](https://github.com/estudio-hawara/choo-choo/commit/0c69df3f5263059e060b82e9f70ee96e580e715b) Thanks [@elcapo](https://github.com/elcapo)! - Add `@choo-choo/parser-python-peg`, a parser for the Python PEG meta-grammar dialect (the `pegen`-style notation used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html)).

  Sibling to `@choo-choo/parser-peg` rather than a replacement: the two dialects differ in operators (`:`/`|` vs `=`/`/`), bracket-form optionals, separator-aware repetition (`s.e+`), the cut operator (`~`), eager parse (`&&`), and `#` line comments. Pick the one that matches your source.

  Spec: `docs/grammars/python-peg.md`.
