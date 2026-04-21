---
"@choo-choo/parser-python-peg": minor
---

Add `@choo-choo/parser-python-peg`, a parser for the Python PEG meta-grammar dialect (the `pegen`-style notation used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html)).

Sibling to `@choo-choo/parser-peg` rather than a replacement: the two dialects differ in operators (`:`/`|` vs `=`/`/`), bracket-form optionals, separator-aware repetition (`s.e+`), the cut operator (`~`), eager parse (`&&`), and `#` line comments. Pick the one that matches your source.

Spec: `docs/grammars/python-peg.md`.
