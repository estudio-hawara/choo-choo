# PEG (peggy dialect)

The `@choo-choo/parser-peg` package consumes **Parsing Expression Grammar source in the peggy / PEG.js dialect** (`peggyjs.org`) and produces a `ParsedGrammar` — a flat list of named rules, each carrying a `Diagram` IR tree. This document is the spec the parser must implement; tests are written against it.

The parser targets a deliberately **pragmatic, railroad-diagram-oriented subset**. The guiding principle: a grammar pulled unchanged from `peggy/examples/*.pegjs` must tokenise and parse without errors; constructs with no visual meaning (semantic actions, labels, initialization blocks, the cut operator) are recognised and **silently skipped**. Only syntactically broken source (unbalanced braces, unterminated strings, missing `=`) triggers an error.

## Lexical structure

The tokenizer is a regex-based lexer with ordered rules, first-match-wins, plus a **balanced-brace scanner** that swallows any `{ … }` block — actions, per-parse initializers, global `{{ … }}` init blocks — without tokenising its contents. Whitespace and comments are recognised but discarded.

### Token table

| Type            | Pattern                              | Purpose                                                      |
|-----------------|--------------------------------------|--------------------------------------------------------------|
| whitespace      | `\s+`                                | Ignored.                                                     |
| line comment    | `//[^\r\n]*`                         | Ignored.                                                     |
| block comment   | `/\*[\s\S]*?\*/`                     | Ignored. Nested comments not supported.                      |
| `ASSIGN`        | `=`                                  | Rule definition operator.                                    |
| `SLASH`         | `/`                                  | Ordered choice.                                              |
| `LPAREN`/`RPAREN` | `(` / `)`                          | Grouping.                                                    |
| `QUESTION`      | `?`                                  | Zero-or-one.                                                 |
| `STAR`          | `*`                                  | Zero-or-more.                                                |
| `PLUS`          | `+`                                  | One-or-more.                                                 |
| `AMP`           | `&`                                  | Lookahead predicate.                                         |
| `BANG`          | `!`                                  | Negative lookahead predicate.                                |
| `DOT`           | `.`                                  | Wildcard.                                                    |
| `COLON`         | `:`                                  | Element label separator.                                     |
| `AT`            | `@`                                  | Pluck prefix.                                                |
| `STRING`        | `'(?:\\.|[^'\\])*'` or `"(?:\\.|[^"\\])*"` | String literal (either quote style).                   |
| `CHARSET`       | `\[(?:\\.|[^\]\\])*\]`               | Character class (literal `[...]` with escapes).              |
| `IDENTIFIER`    | `[A-Za-z_][A-Za-z0-9_]*`             | Rule reference. Also lexed for the trailing `i` case-insensitive flag (recognised by the parser at specific positions). |

Notes:

- peggy accepts both `'…'` and `"…"` — semantics identical; the parser decodes standard escape sequences in both.
- A character class may be negated inside the brackets: `[^abc]`. The brackets and contents are preserved verbatim in the IR.
- `{ … }` and `{{ … }}` blocks are consumed by the balanced-brace scanner. The scanner respects nested braces, string literals (single, double, and backtick), line comments, and block comments inside the block.
- No `;` rule terminator: rules end when the next rule head appears (an `IDENTIFIER` followed by `=`) or at EOF.
- The tokenizer is case-sensitive.

## Syntax (productions)

Handwritten recursive-descent parser with **two-token lookahead**. The extra lookahead is used in exactly one place: distinguishing "an identifier that's the next rule head" from "an identifier that's an element of the current alt".

```
grammar       = { rule } ;

rule          = IDENTIFIER , [ STRING ] , "=" , expression ;
                (* STRING is peggy's optional "display name" — consumed and
                   discarded. Trailing `{ … }` actions are already consumed by
                   the tokenizer as a braced block. *)

expression    = alt , { "/" , alt } ;               (* ordered choice *)

alt           = { element } ;                       (* sequence of elements; the loop
                                                       stops when lookahead is "/",
                                                       ")", EOF, or a rule head
                                                       (IDENT followed by "=") *)

element       = [ IDENTIFIER , ":" ] , [ "@" ] ,
                ( "&" , atom
                | "!" , atom
                | atom , [ suffix ] ) ;

suffix        = "?" | "*" | "+" ;

atom          = STRING , [ IDENT("i") ]              (* case-insensitive flag *)
              | CHARSET , [ IDENT("i") ]
              | "."
              | IDENTIFIER                           (* rule reference *)
              | "(" , expression , ")" ;             (* transparent *)
```

### Rule-boundary detection

peggy has no rule terminator. The parser decides "current rule is done" when, after parsing a complete alt, the next token is not `/` AND it's either EOF or an `IDENTIFIER` followed by `=`. The second case uses a one-extra-token peek buffer; see `packages/parser-antlr/src/parser.ts`, which uses the same pattern for its label disambiguation.

### Precedence and associativity

Ordered choice (`/`) is outer; sequence (juxtaposition) is inner. `a b / c d` parses as `(a b) / (c d)`. Flat children arrays for both.

### Grouping

Parentheses are transparent: `( expression )` returns whatever the inner expression returns, with no extra IR node.

### Labels and pluck

- **Element label** (`name:expr`): stripped silently. Only `expr` is rendered.
- **Pluck** (`@expr` or `@label:expr`): the `@` is stripped; the labelled element is rendered as its RHS.

### Actions and initializers

- **Semantic action** `{ … }` after an alt — stripped silently by the tokenizer's balanced-brace scanner.
- **Per-parse initializer** — a lone `{ … }` at the top of the file, before the first rule — same treatment; consumed as a braced block.
- **Global initializer** `{{ … }}` — the scanner treats the outer `{` as depth-1, the inner as depth-2, and closes on the matching `}}`; consumed transparently.

### Cut operator

peggy does not have a cut operator. (Some PEG dialects use `~` or `!`-adjacent forms.) The parser does not recognise `~` — it would surface as an unexpected character.

## Mapping to IR

| PEG construct                          | IR node                                                      |
|----------------------------------------|--------------------------------------------------------------|
| `"abc"` or `'abc'` (escapes decoded)   | `terminal` with `text = "abc"`                               |
| `"abc"i` (case-insensitive)            | `terminal` with `text = "abc/i"` (0.1 compromise — documented below) |
| `IDENTIFIER` (rule ref)                | `nonterminal` with `name = identifier-text`                  |
| `[a-z]`, `[^abc]` (char class)         | `special` with `text = "[a-z]"` / `"[^abc]"` (literal)       |
| `[a-z]i`                               | `special` with `text = "[a-z]i"` (literal)                   |
| `.` (wildcard)                         | `special` with `text = "."`                                  |
| `a b`                                  | `sequence`                                                    |
| `a / b`                                | `choice` (visually unordered in 0.1)                         |
| `a?`, `a*`, `a+`                       | `optional`, `optional(repetition(a))`, `repetition`          |
| `&expr`                                | `group(expr, label = "&")`                                   |
| `!expr`                                | `group(expr, label = "!")`                                   |
| `( expression )`                       | Whatever expression produces                                  |
| `name:expr`, `@expr`, actions, init blocks, cut | (stripped — no IR)                                    |

Every IR node produced by the parser carries `source?: SourceRange` (same conventions as `docs/grammars/antlr.md` and `docs/grammars/ebnf.md`).

## Errors

Throws `GrammarSyntaxError` with a `position: SourcePosition`. Cases:

1. **Unexpected character** (tokenizer) — a character not matched by any rule and not a `{`.
2. **Unterminated braced block** — a `{ … }` or `{{ … }}` not closed before EOF.
3. **Unterminated string literal**.
4. **Unterminated block comment**.
5. **Unexpected end of input** / **unexpected token** (parser) — when an expected token is absent or a different type.
6. _(Intentionally not an error: peggy's `name "display" = …` form is accepted; the display string is silently discarded.)_

The parser does not attempt recovery.

## Examples

### Smallest grammar

```peg
one = "1"
```

One rule `"one"`; its diagram's child is `terminal("1")`. No trailing semicolon.

### Ordered choice

```peg
bool = "true" / "false" / "maybe"
```

`choice(terminal("true"), terminal("false"), terminal("maybe"))`.

### Lookahead predicates

```peg
identifier = &[a-zA-Z_] [a-zA-Z_0-9]+
```

Two-element sequence: first `group(special("[a-zA-Z_]"), "&")`, then `repetition(special("[a-zA-Z_0-9]"))`.

### Actions and labels (dropped)

```peg
expr = left:term "+" right:expr { return left + right; }
     / term
```

- `left:` and `right:` are stripped.
- The `{ … }` action is consumed by the tokenizer.
- Result: `choice(sequence(nonterminal("term"), terminal("+"), nonterminal("expr")), nonterminal("term"))`.

### Initializer at the top

```peg
{
  function plus(a, b) { return a + b; }
}

start = "x"
```

The leading `{ … }` is a per-parse initializer — scanned and skipped. Grammar has one rule.

## Out of scope

Deliberately unimplemented in 0.1:

- **Ordered-choice ordering in the diagram** — `/` and `|` both render as unordered vertical branches. Consumers read source order.
- **Case-insensitive semantics** — the `i` flag is preserved textually in the rendered label but not interpreted; we don't case-fold terminals.
- **Typed rules or imports** — peggy's plugin ecosystem is out of scope.
