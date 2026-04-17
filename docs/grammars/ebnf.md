# EBNF (ISO/IEC 14977)

The `@choo-choo/parser-ebnf` package consumes **ISO/IEC 14977 Extended Backus–Naur Form** source and produces a `ParsedGrammar` — a list of named rules, each carrying a `Diagram` IR tree. This document is the spec the parser must implement; tests are written against it.

The parser intentionally supports a **pragmatic subset** of ISO 14977. Features excluded in 0.1 are listed at the end.

## Lexical structure

The tokenizer is a regex-based lexer with ordered rules, first-match-wins. Whitespace and comments are recognised but discarded. Every produced token carries a `SourceRange` (`{ start, end }`) with `offset`, `line`, and `column`.

### Token table

| Type           | Pattern                                            | Purpose                                 |
|----------------|----------------------------------------------------|-----------------------------------------|
| `whitespace`   | `\s+`                                              | Ignored.                                |
| `comment`      | `\(\* … \*\)` (non-greedy, `.` matches newline)    | Ignored. Nested comments are **not** supported. |
| `=`            | `=`                                                | Rule definition.                        |
| `(`, `)`       | `\(`, `\)`                                         | Grouping.                               |
| `{`, `}`       | `\{`, `\}`                                         | Repetition (zero-or-more).              |
| `[`, `]`       | `\[`, `\]`                                         | Optional.                               |
| `\|`           | `\|`                                               | Alternation.                            |
| `,`            | `,`                                                | Concatenation.                          |
| `;`            | `;`                                                | Rule terminator.                        |
| `special`      | `\?[^?]+\?`                                        | User-defined special sequence (verbatim text). |
| `terminal`     | `"[^"]+"` or `'[^']+'`                             | Literal token (quotes stripped).        |
| `identifier`   | `[A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9]` or a single letter | Non-terminal name. Internal spaces allowed; first and last character must be alphanumeric. |

Notes:

- Terminals accept either `"…"` or `'…'`. (The legacy project used backticks; we move to single quotes to match ISO 14977.)
- Identifiers may contain interior spaces, matching ISO 14977 (`meta identifier = letter, { letter | decimal digit | space }`) — this lets users write `right hand side = …`. The regex disallows a trailing space.
- Keywords are operators; there are no reserved word identifiers.
- The tokenizer is case-sensitive.
- An unmatched character raises a `GrammarSyntaxError` with its line and column.

## Syntax (productions)

The parser is a handwritten recursive-descent parser with a one-token lookahead. The grammar it implements:

```
grammar         = { rule } ;

rule            = identifier , "=" , definitions-list , ";" ;

definitions-list = single-definition , { "|" , single-definition } ;     (* alternation *)

single-definition = syntactic-term , { "," , syntactic-term } ;          (* concatenation *)

syntactic-term  = syntactic-primary ;

syntactic-primary = identifier
                  | terminal
                  | optional
                  | repetition
                  | grouped
                  | special ;

optional        = "[" , definitions-list , "]" ;

repetition      = "{" , definitions-list , "}" ;

grouped         = "(" , definitions-list , ")" ;

special         = special-token ;                                        (* the ?…? literal *)
```

### Precedence

Per ISO 14977, **alternation (`|`) is the outer operator** and **concatenation (`,`) is the inner operator**. So:

```ebnf
a , b | c , d
```

is parsed as `(a , b) | (c , d)`, not `a , (b | c) , d`. This is a deliberate departure from the legacy project, whose parser inverted the precedence.

### Associativity

Both `|` and `,` are **left-associative**, mirroring the standard. The parser produces flat children arrays for these operators (i.e. `a, b, c` yields a single three-child `sequence` in the IR, not a left-leaning binary tree).

### Rule terminator

Rules end with `;`. The standard also permits `.` as a terminator; we do not accept `.` in 0.1 (trivially extensible later by adding a token rule).

### Whitespace

Whitespace is free between tokens. There is no layout rule.

## Mapping to IR

Every EBNF construct maps to IR nodes with `source` populated:

| EBNF construct      | IR node                                                  |
|---------------------|----------------------------------------------------------|
| `"x"` or `'x'`      | `terminal` with `text` = the quoted content (quotes stripped) |
| `identifier`        | `nonterminal` with `name` = the identifier text          |
| `? text ?`          | `special` with `text` = the content, **not** trimmed     |
| `A , B`             | `sequence` with `children = [A, B]` (flattened)          |
| `A \| B`            | `choice` with `children = [A, B]` (flattened)            |
| `[ A ]`             | `optional` with `child = A`, `skip = "top"`              |
| `{ A }`             | `optional` wrapping `repetition` — i.e. `zeroOrMore(A)`  |
| `( A )`             | whatever `A` produces (parentheses are structural only)  |

The `rule` production produces a `Diagram` whose `child` is the rule's right-hand side and whose `start` / `end` default to `simple`. The rule's `name` and `source` live on the enclosing `GrammarRule`, not on the `Diagram`.

Notes on the mapping:

- `{ A }` is **zero-or-more** in ISO EBNF. We preserve that semantics by desugaring to `optional(repetition(A))` at parse time, matching the manual builder's `zeroOrMore` output. There is no standalone "zero-or-more" IR kind.
- Group `( A )` is transparent. The spec's informal `group` IR node is **not** produced by this parser — it is reserved for the manual builder's labelled visual grouping. If we later add labelled groups to EBNF, they'd go through a `special` or a new token.
- Single-child `sequence` / `choice` never appear in the output: a single-child group parses to its inner node verbatim, per the builder's unwrapping rule.

## Source ranges

Every IR node produced by the parser carries a `source?: SourceRange`:

- **Leaves** (`terminal`, `nonterminal`, `special`): the range of the originating token (including quotes / `?` delimiters).
- **Composites** (`sequence`, `choice`, `optional`, `repetition`): the range spanning the first to the last token that contributed to the node (e.g. for `{ A }` the range covers `{` through `}`).
- **`Diagram`** (per rule): the range spanning the rule's `identifier` through the terminating `;`.
- **`GrammarRule.source`**: same as the Diagram's source.

## Errors

The parser throws `GrammarSyntaxError` (exported from `@choo-choo/parser-utils`) with a message and a `position: SourcePosition`. Cases:

1. **Unexpected character** (tokenizer) — no regex rule matched at the current position.
   Message: `unexpected character "X" at line L, column C`.

2. **Unexpected end of input** (parser) — lookahead is `null` when a token was expected.
   Message: `unexpected end of input; expected <type>`.

3. **Unexpected token** (parser) — lookahead type doesn't match the expected type.
   Message: `unexpected <actualType> at line L, column C; expected <expectedType>`.

4. **Invalid right-hand side start** (parser) — the token at the start of a `syntactic-primary` isn't one of the accepted kinds.
   Message: `unexpected <type> at line L, column C; expected an identifier, terminal, "[", "{", "(", or special`.

The parser does **not** attempt recovery. The first error aborts parsing.

## Examples

### A single rule

```ebnf
zero = "0";
```

Produces a `ParsedGrammar` with one rule `"zero"` whose diagram wraps `terminal("0")`.

### Alternation

```ebnf
binary digit = "0" | "1";
```

One rule `"binary digit"`, diagram child: `choice(terminal("0"), terminal("1"))`.

### Concatenation + alternation (precedence check)

```ebnf
expr = a , b | c , d;
```

Parses as `choice(sequence(nt("a"), nt("b")), sequence(nt("c"), nt("d")))` (ISO precedence — `|` outer, `,` inner).

### Optional and repetition

```ebnf
arguments = argument , { "," , argument };
call = identifier , "(" , [ arguments ] , ")";
```

- `{ "," , argument }` → `zeroOrMore(sequence(terminal(","), nt("argument")))`
- `[ arguments ]` → `optional(nt("arguments"))`

### Comment

```ebnf
(* identifiers start with a letter *)
name = letter , { letter | digit };
```

The comment is skipped by the tokenizer; the rule's `Diagram.source` covers only `name = … ;`.

### Special

```ebnf
regex atom = ? any Perl-compatible regular expression ?;
```

Produces a `special` node with `text = " any Perl-compatible regular expression "` (spaces preserved).

## Out of scope for 0.1

Deliberately unimplemented; tracked for later iterations:

- **Exception (`-`)**: ISO `syntactic factor = [integer, "*"], syntactic primary` with the syntactic-exception operator.
- **Integer multiplier (`N *`)**: fixed-count repetition.
- **Empty sequence**: the ISO concept is syntactically absent in our subset; users express optionality with `[…]` instead.
- **Permissive BNF mode**: accepting `::=` as a synonym for `=` and `<name>` as nonterminal syntax. A follow-up feature on `parser-ebnf` itself, not a separate parser.
- **Nested comments**: ISO 14977 does not require them; the legacy didn't support them either.
- **`.` as rule terminator**: only `;` is accepted.
