# choo-choo

A TypeScript library for railroad diagrams — built by hand or generated from grammars.

> **Status: pre-alpha.** The project is being built spec-first. The public API does not exist yet; what you'll find in this repo so far is the specification that will guide implementation.

## What it will do

- Render railroad (syntax) diagrams as SVG, server-side or client-side.
- Two construction paths:
  - **Manual** — compose diagrams in code from primitives (`Sequence`, `Choice`, `Terminal`, `NonTerminal`, `Optional`, `Repetition`, …).
  - **From a grammar** — hand in a grammar source string and a parser (EBNF, ANTLR or PEG at launch) and get a diagram automatically.
- First-class bindings for **React**, **Vue**, **Astro**, and **Vanilla JS** (web component + imperative mount).

## Repository map

- [`docs/architecture.md`](./docs/architecture.md) — target architecture and module boundaries.
- [`docs/development.md`](./docs/development.md) — development workflow and tooling.
- [`docs/roadmap/[next-version].md`](./docs/roadmap/) — milestones for each release.
- [`CLAUDE.md`](./CLAUDE.md) — operating guide for Claude sessions (also a concise human overview).

## Development

This project follows a **spec-driven** loop:

1. Update `README.md` and/or `docs/**` to describe the change.
2. Implement the change.
3. Back it with tests.

See [`docs/development.md`](./docs/development.md) for the full workflow, tooling choices, and testing strategy.

## License

MIT.