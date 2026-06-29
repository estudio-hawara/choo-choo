---
title: Python PEG (pegen dialect)
description: The Python PEG meta-grammar dialect supported by @choo-choo/parser-python-peg.
---

The `@choo-choo/parser-python-peg` package consumes **Python's PEG meta-grammar source** — the dialect used to describe Python's own syntax in [docs.python.org/3/reference/grammar.html](https://docs.python.org/3/reference/grammar.html), produced by the [`pegen`](https://github.com/python/cpython/tree/main/Tools/peg_generator) parser generator. It produces a `ParsedGrammar` — a flat list of named rules, each carrying a `Diagram` IR tree. This document is the spec the parser must implement; tests are written against it.

This dialect is **not** the same as the peggy / PEG.js dialect handled by `@choo-choo/parser-peg`. Visible differences:

| Construct                  | peggy (`@choo-choo/parser-peg`) | Python PEG (this parser) |
|----------------------------|---------------------------------|--------------------------|
| Rule introduction          | `name = body`                   | `name: body`             |
| Alternation                | `/`                             | `\|`                     |
| Optional group             | `(expr)?`                       | `[expr]` or `expr?`      |
| Cut operator               | (n/a)                           | `~`                      |
| Eager parse                | (n/a)                           | `&&expr`                 |
| Separator-aware repetition | (n/a)                           | `sep.elem+`              |
| Comments                   | `// ...`, `/* ... */`           | `# ...` to end of line   |
| Character class            | `[a-z]`                         | (n/a — Python uses token names like `NAME`, `NUMBER`) |

The guiding principle is the same as for the other parser packages: **a rule lifted unchanged from `docs.python.org/3/reference/grammar.html` must tokenise and parse without errors**. Constructs that have no visual meaning in a railroad diagram (cut, eager-parse) are recognised and **silently dropped**. Only syntactically broken source (unbalanced brackets, unterminated strings, missing `:`) triggers an error.

## Lexical structure

The tokenizer is a regex-based lexer with ordered rules, first-match-wins. Whitespace and `#`-comments are recognised but discarded.

### Token table

| Type            | Pattern                              | Purpose                                                       |
|-----------------|--------------------------------------|---------------------------------------------------------------|
| whitespace      | `\s+`                                | Ignored.                                                      |
| line comment    | `#[^\r\n]*`                          | Ignored. `#` only — there is no block-comment form.           |
| `COLON`         | `:`                                  | Rule definition operator.                                     |
| `PIPE`          | `\|`                                 | Alternation.                                                  |
| `LPAREN`/`RPAREN` | `(` / `)`                          | Grouping.                                                     |
| `LBRACKET`/`RBRACKET` | `[` / `]`                      | Optional group.                                               |
| `QUESTION`      | `?`                                  | Zero-or-one suffix.                                           |
| `STAR`          | `*`                                  | Zero-or-more suffix.                                          |
| `PLUS`          | `+`                                  | One-or-more suffix.                                           |
| `AMPAMP`        | `&&`                                 | Eager-parse predicate. (Order matters — must be tried before `&`.) |
| `AMP`           | `&`                                  | Positive lookahead predicate.                                 |
| `BANG`          | `!`                                  | Negative lookahead predicate.                                 |
| `TILDE`         | `~`                                  | Cut operator. Silently dropped.                               |
| `ELLIPSIS`      | `\.\.\.`                            | String-range operator (`"0"..."9"`). Must be tried **before** `DOT` so `...` does not lex as three separator-binder dots. |
| `DOT`           | `.`                                  | Separator binder for `sep.elem+`.                             |
| `STRING`        | `'(?:\\.|[^'\\])*'`                  | Single-quoted literal. Used by Python for **hard keywords** (`'if'`, `'class'`). |
| `DSTRING`       | `"(?:\\.|[^"\\])*"`                  | Double-quoted literal. Used by Python for **soft keywords** (`"match"`, `"case"`). |
| `NAME`          | `[A-Za-z_][A-Za-z0-9_]*`             | Rule reference (lowercase) or token reference (uppercase, e.g. `NAME`, `NUMBER`, `NEWLINE`). |

Notes:

- The tokenizer is case-sensitive. The uppercase-vs-lowercase identifier convention is **not** enforced at lex time; it carries meaning at the consumer level (token name vs rule reference) but both kinds map to the same `nonterminal` IR shape.
- Strings decode the standard escape sequences (`\n`, `\r`, `\t`, `\b`, `\f`, `\v`, `\0`, `\\`, `\'`, `\"`, `\xHH`, `\uHHHH`, `\u{...}`). Unknown escapes pass through as the escaped character. Soft- and hard-keyword strings decode the same way.
- `&&` must be tried **before** `&` so that `&&expr` does not lex as two `&` tokens.
- `...` (ELLIPSIS) must be tried **before** `.` (DOT) so that the string-range operator `"0"..."9"` does not lex as three separator-binder dots. A single `.` continues to lex as `DOT` for `sep.elem+`.
- An unmatched character raises `GrammarSyntaxError` with its line and column. An unterminated string literal does the same.

## Syntax (productions)

Handwritten recursive-descent parser with **two-token lookahead**. The extra lookahead is used in exactly one place: distinguishing "a `NAME` that's the next rule head" (NAME followed by `:`) from "a `NAME` that's an element of the current alt".

```
grammar       = { rule } ;

rule          = NAME , ":" , alternatives ;

alternatives  = [ "|" ] , alt , { "|" , alt } ;
                (* The leading "|" is optional. It supports the formatting
                   style used in docs.python.org/3/reference/grammar.html where
                   the first alternative starts on its own line:
                       rule_name:
                           | first_alt
                           | second_alt
                *)

alt           = element , { element } ;            (* sequence of elements; the loop
                                                       stops when lookahead is "|",
                                                       ")", "]", EOF, or a rule head
                                                       (NAME followed by ":") *)

element       = "&&" , atom                         (* eager parse — group "&&" *)
              | "&"  , atom                         (* positive lookahead — group "&" *)
              | "!"  , atom                         (* negative lookahead — group "!" *)
              | "~"                                 (* cut — silently dropped *)
              | atom , [ suffix ] ;

suffix        = "?"
              | "*"
              | "+"
              | "." , atom , "+" ;                  (* sep.elem+ — separator-aware *)

atom          = STRING                              (* hard keyword *)
              | DSTRING                             (* soft keyword *)
              | STRING , "..." , STRING             (* string range → special, e.g. "0"..."9" *)
              | DSTRING , "..." , DSTRING           (* string range, soft-keyword quotes *)
              | NAME                                (* rule or token reference *)
              | "(" , alternatives , ")"            (* transparent grouping *)
              | "[" , alternatives , "]" ;          (* optional group *)
```

### Rule-boundary detection

Python's PEG has no rule terminator. The parser decides "current rule is done" when, after parsing an alt, the next token is not `|` AND it's either EOF or a `NAME` followed by `:`. The second case uses a one-extra-token peek buffer; see `packages/parser-peg/src/parser.ts` for the same pattern applied to the peggy dialect.

### Precedence and associativity

Alternation (`|`) is outer; sequence (juxtaposition) is inner. `a b | c d` parses as `(a b) | (c d)`. Both produce flat children arrays.

### Grouping

Parentheses are transparent: `( alternatives )` returns whatever the inner expression returns, with no extra IR node. Brackets `[ alternatives ]` always wrap the result in an `optional`.

### String ranges

`"0"..."9"` and `'a'...'z'` are pegen's character-range operator — they match any single character in the inclusive range between the two (single-character) string literals. The operator is `...` (ELLIPSIS), distinct from the single `.` separator binder. Both operands must use the **same** quote kind (`'a'...'z'` and `"a"..."z"` are valid; `'a'..."z"` is not — it raises `unexpected DSTRING; expected STRING`).

A string range lowers to a single `special` IR node whose `text` is the two decoded characters joined by `...` (e.g. `"0"..."9"` → `special("0...9")`, `'a'...'z'` → `special("a...z")`). The renderer already supports `special` — it is the same shape `@choo-choo/parser-peg` uses for charsets like `[a-z]` — so no renderer or binding change is needed. Standard escape sequences in the operands are decoded with the same rules as ordinary string literals.

A string range is an atom: it cannot be split by `|`, `(`, `[`, or a rule head. A stray `...` whose left operand is not a string literal (e.g. `NAME ... NAME`) is not consumed and surfaces as `unexpected ELLIPSIS`, because `ELLIPSIS` is only recognised inside the `STRING`/`DSTRING` branch of `atom`.

### Suffix forms

- `e?` and `[e]` both render as `optional(e, skip = "top")`. They are interchangeable in the source.
- `e*` renders as `optional(repetition(e), skip = "top")` — zero-or-more.
- `e+` renders as `repetition(e)` — one-or-more.
- `s.e+` renders as `repetition(e, separator = s)` — one-or-more `e` separated by `s`. The IR's `Repetition.separator` field exists exactly for this purpose, so the diagram visibly shows the separator on the loopback edge.

> **Why no `s.e*`?** Python's pegen does not support the `s.e*` form; users wrap `s.e+` in `[…]` instead. This parser does the same: `[s.e+]` parses to `optional(repetition(e, separator = s))`. A bare `s.e*` would surface as a parse error on the trailing `*` (only `+` is accepted after the dotted form).

### Cut, lookahead, and eager parse

| Source | IR | Why |
|--------|-----|------|
| `&expr`  | `group(expr, label = "&")`  | Positive lookahead. Same convention as `parser-peg`. |
| `!expr`  | `group(expr, label = "!")`  | Negative lookahead. Same convention as `parser-peg`. |
| `&&expr` | `group(expr, label = "&&")` | Eager parse. Only the label differs from `&`. |
| `~`      | (stripped)                  | Cut. It commits the parser to the current alternative; it has no visual meaning in a railroad diagram. |

A `~` token is consumed and silently produces no IR. If a `~` is the only thing in an alt, the alt is empty and `GrammarSyntaxError("empty alternative")` is raised — the user has written an alt that contains no atoms.

### Constructs deferred to a later milestone

These appear in CPython's `Grammar/python.gram` source file but **not** in the cleaned-up `docs.python.org` grammar. They are out of scope for the v0.1 parser:

- Rule return-type annotations: `name[mod_ty]: …`. The `[mod_ty]` would clash with the optional-group bracket form in the body, and disambiguation is non-trivial. v0.1 errors on the leading `[` after a rule name.
- Semantic actions `{ … }` after an alt.
- Top-level `@subheader`, `@trailer`, `@class`, `@type`, `@bytecode`, `@memo` directives.
- Triple-quoted strings (`'''…'''`, `"""…"""`).

Pasting raw `python.gram` from the CPython source therefore raises `GrammarSyntaxError`. Pasting any rule from `docs.python.org/3/reference/grammar.html` works as-is. Future milestones may relax this, see `docs/roadmap/0.2.md`.

## Mapping to IR

| Python PEG construct                | IR node                                                       |
|-------------------------------------|---------------------------------------------------------------|
| `'kw'` (escapes decoded)            | `terminal` with `text = "kw"` (hard keyword)                  |
| `"kw"` (escapes decoded)            | `terminal` with `text = "kw"` (soft keyword — same shape)     |
| `"a"..."z"` (escapes decoded)       | `special` with `text = "a...z"` (string range)               |
| `NAME` (rule or token reference)    | `nonterminal` with `name = identifier-text`                   |
| `a b`                               | `sequence`                                                    |
| `a \| b`                            | `choice` (visually unordered; consumers read source order)    |
| `a?`                                | `optional` with `child = a`, `skip = "top"`                   |
| `[a]`                               | `optional` (same shape as `a?`)                               |
| `a*`                                | `optional(repetition(a))` — zero-or-more                      |
| `a+`                                | `repetition(a)` — one-or-more                                 |
| `s.a+`                              | `repetition(a, separator = s)`                                |
| `&a`                                | `group(a, label = "&")`                                       |
| `!a`                                | `group(a, label = "!")`                                       |
| `&&a`                               | `group(a, label = "&&")`                                      |
| `~`                                 | (stripped — no IR)                                            |
| `(alternatives)`                    | Whatever the inner expression produces                        |

Hard- vs soft-keyword distinction is **not** preserved in the IR in v0.1 — both lex to a `terminal` with the same text. Visual differentiation (e.g. italics for soft keywords) is a renderer-level feature deferred to later. The string's source range still distinguishes them in the originating tokens for any consumer that wants to inspect them.

Every IR node produced by the parser carries `source?: SourceRange` (same conventions as `docs/grammars/peg.md`):

- **Leaves** (`terminal`, `nonterminal`, `special`): the token range, including the surrounding quotes. For a string range `"a"..."z"`, the span runs from the opening quote of the first literal through the closing quote of the second.
- **Composites**: the range spanning the first to last token contributing to the node.
- **`Diagram`** (per rule): from the leading `NAME` through the end of the rule body.
- **`GrammarRule.source`**: same as the Diagram's source.

## Errors

Throws `GrammarSyntaxError` with a `position: SourcePosition`. Cases:

1. **Unexpected character** (tokenizer) — a character not matched by any rule.
2. **Unterminated string literal**.
3. **Unexpected end of input** / **unexpected token** (parser) — when an expected token is absent or a different type. This covers a stray `...` whose left operand is not a string literal (`NAME ... NAME`): `ELLIPSIS` is only consumed inside the `STRING`/`DSTRING` branch of `atom`, so it surfaces here as `unexpected ELLIPSIS`. A mixed-quote range (`'a'..."z"`) surfaces as `unexpected DSTRING; expected STRING` (the second operand must match the first operand's quote kind).
4. **Empty alternative** — an alt with no elements (e.g. `r: a |  | b`, or a stray `~` with nothing after it in the alt).
5. **Stray `+` after a non-dotted atom** — only `s.e+` accepts the dotted form; `s.e*` and `s.e?` are not valid Python PEG.
6. **Unsupported construct** — `name[…]:` rule annotations, `{ … }` actions, `@directive` headers, and triple-quoted strings raise on the offending character. They are listed in "Constructs deferred to a later milestone" above.

The parser does not attempt recovery.

## Examples

### Smallest grammar

```python-peg
one: 'one'
```

One rule `"one"`; its diagram's child is `terminal("one")`. No terminator.

### Pipe-prefixed alternatives

```python-peg
boolean:
    | 'True'
    | 'False'
    | 'None'
```

Three alternatives. Result: `choice(terminal("True"), terminal("False"), terminal("None"))`. The leading `|` on the first alt is consumed without changing the result.

### Optional via brackets vs `?`

```python-peg
star_targets: star_target [',' star_target]
maybe_name: NAME?
```

`star_targets`'s child is `sequence(nonterminal("star_target"), optional(sequence(terminal(","), nonterminal("star_target"))))`.
`maybe_name`'s child is `optional(nonterminal("NAME"))`.
Both `[…]` and `?` lower to the same IR shape.

### Separator-aware repetition

```python-peg
import_from_as_names: ','.import_from_as_name+
```

Result: `repetition(nonterminal("import_from_as_name"), separator = terminal(","))`. The diagram renders one occurrence of `import_from_as_name` with a loopback edge labelled `,`.

### String ranges

```python-peg
name_start: 'a'...'z' | 'A'...'Z' | '_'
name_continue: name_start | "0"..."9"
```

- `name_start`'s child is `choice(special("a...z"), special("A...Z"), terminal("_"))`. Each `'lo'...'hi'` lowers to a `special` whose text is the two decoded characters joined by `...`.
- `name_continue`'s child is `choice(nonterminal("name_start"), special("0...9"))`. Mixed quote kinds across alternatives are fine; only the two operands of a single `...` must share their quote kind.

### Lookahead, cut, and soft keywords

```python-peg
pattern_capture_target: !"_" NAME !'.' !'(' !'='
for_stmt: 'for' star_targets 'in' ~ star_expressions ':' block
```

- The negative-lookaheads on `pattern_capture_target` become five `group(_, label = "!")` nodes wrapped in a `sequence`. Note `"_"` is a soft keyword (double quotes) — it parses identically to `'_'`.
- `for_stmt`'s `~` after `'in'` is silently dropped; the result is a sequence of the visible elements.

### Comments

```python-peg
# Top-of-file comment.
expression:    # inline trailing comment
    | disjunction 'if' disjunction 'else' expression
    | disjunction
```

Both comments are consumed by the tokenizer. The parsed rule is a two-alternative choice over the visible elements.
