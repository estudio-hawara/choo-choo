---
title: ANTLR4
description: The ANTLR4 subset supported by @choo-choo/parser-antlr.
---

The `@choo-choo/parser-antlr` package consumes **ANTLR4 grammar source** (`.g4` files) and produces a `ParsedGrammar` — a flat list of named rules, each carrying a `Diagram` IR tree. This document is the spec the parser must implement; tests are written against it.

The parser targets a deliberately **pragmatic, railroad-diagram-oriented subset** of ANTLR4. The guiding principle: a real grammar pulled unchanged from `antlr/grammars-v4` must tokenise and parse without errors, but constructs that have no visual meaning in a railroad diagram (actions, semantic predicates, lexer commands, options blocks, …) are recognised and **silently skipped**. Only syntactically broken source (unbalanced braces, unterminated strings, unknown operators) triggers an error.

## Lexical structure

The tokenizer is a regex-based lexer with ordered rules, first-match-wins, plus a dedicated **balanced-brace scanner** that swallows any `{ … }` block — actions, predicates, options/tokens/channels blocks, at-commands — without tokenising its contents. Whitespace and comments are recognised but discarded. Every produced token carries a `SourceRange` (`{ start, end }`) with `offset`, `line`, and `column`.

### Token table

| Type            | Pattern                              | Purpose                                                    |
|-----------------|--------------------------------------|------------------------------------------------------------|
| whitespace      | `\s+`                                | Ignored.                                                   |
| line comment    | `//[^\r\n]*`                         | Ignored.                                                   |
| block comment   | `/\*[\s\S]*?\*/` (includes `/** … */`) | Ignored. Nested comments are **not** supported.           |
| `COLON`         | `:`                                  | Rule definition.                                           |
| `SEMI`          | `;`                                  | Rule terminator / header terminator / statement terminator. |
| `PIPE`          | `\|`                                 | Alternation.                                               |
| `LPAREN`/`RPAREN` | `(` / `)`                          | Grouping.                                                  |
| `QUESTION`      | `?`                                  | Zero-or-one (also non-greedy suffix).                      |
| `STAR`          | `*`                                  | Zero-or-more.                                              |
| `PLUS`          | `+`                                  | One-or-more.                                               |
| `TILDE`         | `~`                                  | Negated charset/atom.                                      |
| `DOTDOT`        | `..`                                 | Character range (between two string literals).             |
| `DOT`           | `.`                                  | Wildcard.                                                  |
| `ASSIGN`        | `=`                                  | Element label (`x=INT`).                                   |
| `PLUS_ASSIGN`   | `+=`                                 | List-element label (`xs+=INT`).                            |
| `ARROW`         | `->`                                 | Start of lexer command.                                    |
| `COMMA`         | `,`                                  | Separator in lexer-command lists, in `import A, B;`.       |
| `HASH`          | `#`                                  | Start of an alt label (`# LabelName`).                     |
| `AT`            | `@`                                  | Start of an at-command (`@header {…}`).                    |
| `COLON_COLON`   | `::`                                 | At-command scope (`@lexer::header`).                       |
| `STRING`        | `'(?:\\.|[^'\\])*'`                  | String literal; standard C-style escapes.                  |
| `CHARSET`       | `\[(?:\\.|[^\]\\])*\]`               | Character set (literal `[...]` with escapes).              |
| `IDENTIFIER`    | `[A-Za-z_][A-Za-z0-9_]*`             | Rule/token reference **and** contextual keywords.          |

Contextual keywords (i.e. `IDENTIFIER` values that the *parser* treats specially depending on position): `grammar`, `parser`, `lexer`, `fragment`, `import`, `mode`, `options`, `tokens`, `channels`.

Notes:

- Only `'…'` string literals. ANTLR4 has no double-quoted string.
- Character sets are tokenised as a single `CHARSET` token whose `value` is the **literal source text**, brackets included. No expansion into individual alternatives.
- Balanced-brace blocks (actions, predicates, at-command bodies, options/tokens/channels blocks) are consumed by a dedicated scanner that respects nested braces, string literals (single, double, and backtick), and comments. A trailing `?` immediately after the closing `}` is consumed too (semantic predicates).
- The tokenizer is case-sensitive. ANTLR's uppercase-vs-lowercase identifier convention is **not** enforced at lex time; it's meaningful only in the spec's documentation of parser-vs-lexer rules, and reflected visually by the choice of rule name when rendered.
- An unmatched character raises a `GrammarSyntaxError` with its line and column. An unterminated `{…}` block, string literal, or block comment likewise.

## Syntax (productions)

The parser is a handwritten recursive-descent parser with one-token lookahead. The grammar it implements, expressed in EBNF notation:

```
grammar-file    = [ grammar-header ] , { top-level-item } ;

grammar-header  = [ "parser" | "lexer" ] , "grammar" , IDENTIFIER , ";" ;

top-level-item  = block-decl
                | at-command
                | import-stmt
                | mode-stmt
                | rule ;

block-decl      = ( "options" | "tokens" | "channels" ) , (* { … } body already consumed by tokenizer *) ;

at-command      = "@" , IDENTIFIER , [ "::" , IDENTIFIER ] , (* { … } body already consumed *) ;

import-stmt     = "import" , IDENTIFIER , { "," , IDENTIFIER } , ";" ;

mode-stmt       = "mode" , IDENTIFIER , ";" ;

rule            = [ "fragment" ] , IDENTIFIER , ":" , alt-list , ";" ;

alt-list        = alt , { "|" , alt } ;                                    (* alternation *)

alt             = element , { element } , [ "#" , IDENTIFIER ]             (* sequence + optional alt label *)
                | (* empty *) ;

element         = [ IDENTIFIER , ( "=" | "+=" ) ] , atom , [ suffix ]
                | lexer-command ;

suffix          = ( "?" | "*" | "+" ) , [ "?" ] ;                          (* greedy + non-greedy *)

atom            = STRING
                | IDENTIFIER
                | CHARSET
                | "."
                | "~" , atom
                | STRING , ".." , STRING                                    (* lexer char range *)
                | "(" , alt-list , ")" ;                                    (* grouping, transparent *)

lexer-command   = "->" , lexer-cmd , { "," , lexer-cmd } ;
lexer-cmd       = IDENTIFIER , [ "(" , ( IDENTIFIER | INT ) , ")" ] ;      (* fully skipped *)
```

### Precedence and associativity

Alternation (`|`) is outer, concatenation (juxtaposition) is inner. `a b | c d` parses as `(a b) | (c d)`. Both are left-associative; the parser produces flat children arrays for `sequence` and `choice`.

### Grouping

Parentheses are **transparent**: `( alt-list )` produces whatever the inner `alt-list` produces, without wrapping it in an extra IR node.

### Labels

- **Alt label** (`… # LabelName`): stripped silently. It names a generated visitor-class variant in ANTLR's runtime; it has no visual meaning.
- **Element label** (`x=INT`, `xs+=INT`): stripped silently. Only the RHS is rendered.

### Actions and predicates

`{ target-language-code }` embedded in a rule body, and `{ predicate }?` following an element, are stripped silently by the tokenizer's balanced-brace scanner before the parser ever sees them. The scanner handles arbitrary nesting and respects string literals inside the braces.

### Lexer commands

Everything from `->` up to the following `;` (including comma-separated `-> skip, channel(HIDDEN)` lists) is consumed without producing IR.

## Mapping to IR

| ANTLR construct                         | IR node                                                      |
|-----------------------------------------|--------------------------------------------------------------|
| `'abc'` (string literal, escapes decoded) | `terminal` with `text = "abc"`                               |
| `IDENTIFIER` (upper or lower)           | `nonterminal` with `name = identifier-text`                  |
| `EOF`                                   | `nonterminal` with `name = "EOF"` (treated as any other name) |
| `.` (wildcard)                          | `special` with `text = "."`                                  |
| `[a-zA-Z_]` (charset)                   | `special` with `text = "[a-zA-Z_]"` (literal source text)    |
| `~[abc]` / `~'x'` (negation)            | `special` with `text = "~[abc]"` / `"~'x'"`                  |
| `'a'..'z'` (char range)                 | `special` with `text = "'a'..'z'"` (verbatim)                |
| `a b`                                   | `sequence` with `children = [a, b]` (flattened)              |
| `a \| b`                                | `choice` with `children = [a, b]` (flattened)                |
| `a?`                                    | `optional` with `child = a`, `skip = "top"`                  |
| `a*`                                    | `optional(repetition(a))` — zero-or-more                     |
| `a+`                                    | `repetition` with `child = a` — one-or-more                  |
| `a??`, `a*?`, `a+?`                     | Same as greedy (non-greediness is a parse-time concern)      |
| `( A )`                                 | Whatever `A` produces (parentheses are transparent)          |
| Alt label, element label, action, predicate, lexer command | (stripped — no IR)                                |

The `rule` production produces a `Diagram` whose `child` is the rule's right-hand side. The rule's `name` and `source` live on the enclosing `GrammarRule`, not on the `Diagram`.

Lexer tokens, parser rules, and `fragment` rules all land in `ParsedGrammar.rules` in source order. The three kinds are distinguished by convention (uppercase name = lexer, lowercase = parser, `fragment` prefix = fragment) but share the same IR shape. Consumers that want to render only parser rules can filter by name case themselves.

## Source ranges

Every IR node produced by the parser carries a `source?: SourceRange`:

- **Leaves** (`terminal`, `nonterminal`, `special`): the range of the originating token (including the quotes / brackets / `.`).
- **Composites** (`sequence`, `choice`, `optional`, `repetition`): the range spanning the first to the last token that contributed to the node.
- **`Diagram`** (per rule): the range spanning the rule's `IDENTIFIER` (or `fragment` keyword) through the terminating `;`.
- **`GrammarRule.source`**: same as the Diagram's source.

## Errors

The parser throws `GrammarSyntaxError` (exported from `@choo-choo/parser-utils`) with a message and a `position: SourcePosition`. Cases:

1. **Unexpected character** (tokenizer) — no regex rule matched and it's not a `{`.
2. **Unterminated braced block** — a `{…}` is not closed before EOF.
3. **Unterminated string literal** — a `'…'` runs to EOF without a closing quote.
4. **Unterminated block comment** — a `/* … */` runs to EOF.
5. **Unexpected end of input** (parser) — lookahead is `null` when a token was expected.
6. **Unexpected token** (parser) — lookahead type doesn't match the expected type.

The parser does **not** attempt recovery. The first error aborts parsing.

## Examples

### Smallest grammar

```antlr
grammar Demo;
one : '1' ;
```

One rule `"one"`; its diagram's child is `terminal("1")`. The `grammar Demo;` header is consumed and produces no IR.

### Lexer + parser rules together

```antlr
grammar Calc;
expr : INT ('+' INT)* ;
INT  : [0-9]+ ;
WS   : [ \t\r\n]+ -> skip ;
```

Three rules: `expr`, `INT`, `WS`. `WS`'s `-> skip` command is stripped; its diagram is `repetition(special("[ \t\r\n]"))`.

### Fragments, labels, actions, predicates

```antlr
grammar Kitchen;
stat : {doStuff();} lhs=ID '=' rhs=expr {x > 0}? ';' # AssignStat ;
expr : INT | ID ;
fragment DIGIT : [0-9] ;
ID   : [a-zA-Z_]+ ;
```

- `stat`'s diagram is `sequence(nt("ID"), terminal("="), nt("expr"), terminal(";"))` — the action, predicate, element labels (`lhs=`, `rhs=`), and alt label (`# AssignStat`) are all stripped.
- `fragment DIGIT` lands in `ParsedGrammar.rules` alongside the others.

### Char ranges

```antlr
grammar Chars;
LETTER : [a-zA-Z] ;
DIGIT  : '0'..'9' ;
```

`LETTER`'s child is `special("[a-zA-Z]")`; `DIGIT`'s child is `special("'0'..'9'")`.
