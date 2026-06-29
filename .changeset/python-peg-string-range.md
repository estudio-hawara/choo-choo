---
"@choo-choo/parser-python-peg": minor
---

Add support for pegen's string-range operator `"0"..."9"` / `'a'...'z'`, the character-range notation used in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html) (e.g. `name_continue: name_start | "0"..."9"`).

A string range lowers to a single `special` IR node whose `text` is the two decoded characters joined by `...` (e.g. `"0"..."9"` → `special("0...9")`) — the same shape `@choo-choo/parser-peg` uses for charsets like `[a-z]`, so no renderer or binding change is required. The `...` (ELLIPSIS) token is ordered before the single `.` (DOT) separator binder, and a stray `...` whose left operand is not a string literal surfaces as `unexpected ELLIPSIS`.

Spec: `docs/grammars/python-peg.md`.
