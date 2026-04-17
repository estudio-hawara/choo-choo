# CLAUDE.md

Operating guide for Claude sessions working in this repository.

## Project overview

**Choo Choo** is a TypeScript library for generating railroad (syntax) diagrams rendered as SVG. It supports two complementary workflows:

1. **Manual construction** — compose diagrams in code by combining primitives (`Sequence`, `Choice`, `Terminal`, `NonTerminal`, `Optional`, `Repetition`, …).
2. **Grammar-driven generation** — pass a grammar source string together with a parser (EBNF, ANTLR or PEG, with more to come) and get a diagram automatically.

The library ships first-class bindings for **React**, **Vue**, **Astro**, and **Vanilla JS** (web component + imperative mount). The repository is a pnpm monorepo.

## Spec-driven development (house rule #1)

Every change follows this loop, in order — no exceptions:

1. **Spec first.** Update `README.md` and/or files under `docs/**` to describe the behaviour being added or changed.
2. **Code.** Implement the change so it matches the spec.
3. **Tests.** Back the implementation with tests that exercise the spec.

Corollaries:

- If the spec isn't clear enough to write tests against, sharpen the spec before writing code.
- If a change modifies code without touching any spec file under `docs/` or the README, either the spec is missing (add it) or the change is a pure refactor (call it out explicitly).
- When starting a new milestone, keep the corresponding roadmap updated — see `docs/roadmap/[next-version].md`.

## Repo layout (target)

The repo is built incrementally. Directories appear only when their corresponding milestone lands; an empty skeleton is normal early on.

```
packages/
├── core/              @choo-choo/core          IR + builder + SVG renderer
├── parser-utils/      @choo-choo/parser-utils  Reader, tokenizer primitives
├── parser-ebnf/       @choo-choo/parser-ebnf
├── parser-antlr/      @choo-choo/parser-antlr
├── parser-peg/        @choo-choo/parser-peg
├── react/             @choo-choo/react
├── vue/               @choo-choo/vue
├── astro/             @choo-choo/astro
└── vanilla/           @choo-choo/vanilla       <choo-choo> + mount()
apps/
├── playground/        Vite demo app
└── docs/              Astro Starlight site
docs/                  Spec sources (single source of truth)
```

See `docs/architecture.md` for the dependency graph and `docs/roadmap/[next-version].md` for the milestone order.

## Core concepts

- **An intermediate result (IR) is the contract.** A flat discriminated-union `Node` type is the shared language between parsers and the renderer. Parsers produce IR; the renderer consumes IR; bindings wrap the renderer's output. Nothing circumvents the IR.
- **Renderer is pure.** Visitor pattern over `node.kind`; emits an SVG string; never touches the DOM. SSR-safe by construction.
- **Parsers are plug-ins.** Every grammar parser implements the same `GrammarParser` interface (`parse(source) => IR`). Adding a new grammar (ABNF, PEG, …) never requires changes to `core` or the bindings.
- **Bindings are thin.** Each framework binding accepts either `{ source, parser }` or a pre-built `{ ir }` and renders via `core`. Bindings do not bundle parsers — consumers opt in.

Details live in `docs/architecture.md`.

## Tooling & commands

- **Package manager**: pnpm ≥ 10 (workspaces).
- **Build**: tsup — ESM + CJS + `.d.ts` per package.
- **Test**: Vitest + happy-dom.
- **Lint + format**: Biome. Single source of truth; do not add ESLint or Prettier.
- **Language**: TypeScript in strict mode (exact compiler options in `docs/development.md`).
- **Node**: ≥ 20.

Commands (applicable once the relevant packages exist):

```
pnpm install
pnpm -r build
pnpm -r test
pnpm --filter @choo-choo/core test
pnpm biome check .
pnpm --filter playground dev
```

## Testing conventions

- Vitest with happy-dom as the DOM environment.
- Tests are colocated next to source as `*.test.ts`.
- Renderer output is verified with **inline snapshots** (`toMatchInlineSnapshot`) so diffs are reviewable in the PR.
- Parsers test the **tokenizer and the parser separately** — token stream first, IR on top. A failing parser test with a green tokenizer test tells you exactly where the bug is.
- Bindings get happy-dom smoke tests covering SSR output and basic reactivity.

## Adding a new grammar parser

1. Write `docs/grammars/<name>.md` first — the grammar spec the parser must implement.
2. Create `packages/parser-<name>`.
3. Depend on `@choo-choo/parser-utils` and `@choo-choo/core`.
4. Implement the `GrammarParser` interface exported by `@choo-choo/core`.
5. Add snapshot tests covering tokenizer and IR output, plus representative fixtures under `__fixtures__/`.
6. Register the parser in `apps/playground` so it's demoable.

## Adding a new framework binding

1. Write `docs/bindings/<name>.md` first — the prop API and SSR behaviour.
2. Create `packages/<name>`.
3. Accept `{ source, parser }` or `{ ir }`; call `core.render`.
4. Re-export the optional shared CSS (`railroad.css`).
5. Keep the binding SSR-safe (no top-level DOM access).
6. Add happy-dom tests and link the binding from the playground and docs site.

## House rules / non-goals

- **`@choo-choo/core` has no runtime dependencies.** Ever. If you think it needs one, raise it first.
- **The renderer does not touch the DOM.** It emits strings. DOM insertion is the binding's job.
- **Bindings do not import parsers.** Consumers pick the parser they want; bindings stay parser-agnostic.
- **Everything is SSR-safe.** No top-level `window` / `document` references anywhere in `packages/*`.
- **Project language is English.** Docs, code, comments, commits, PR descriptions — all English, regardless of the conversation language.
