---
title: Development
description: How Choo Choo is built — spec-driven loop, tooling, and testing strategy.
---

This document specifies how **Choo Choo** is built.

## The spec-driven loop

Every change goes through three steps, in order:

1. **Write or update the spec.** The change begins in `README.md` and/or under `docs/**`. If the behaviour isn't described there, the change isn't ready to code.
2. **Write the code.** Implementation follows the spec. If the code drifts during implementation, update the spec first, then continue.
3. **Write the tests.** Tests exercise the spec, not the implementation's accidents. If a behaviour in the spec isn't testable, the spec needs to be sharper.

No code without a spec. No spec without tests.

For non-trivial changes, stage the work so each commit lands a thin vertical slice (spec + code + tests for one small behaviour). Avoid big-bang changes that touch all three layers for many unrelated behaviours at once.

## Milestones

The roadmap in `docs/roadmap/[next-version].md` lists the milestones for each release and the spec documents each one must produce **before** any code lands. For example, M1 (`@choo-choo/core`) requires `docs/ir.md`, `docs/rendering.md`, and `docs/builder.md` to exist and be reviewed before the package is created.

## Tooling

| Concern         | Tool                                                          |
|-----------------|---------------------------------------------------------------|
| Package manager | pnpm ≥ 10 (workspaces)                                        |
| Runtime         | Node ≥ 20                                                     |
| Language        | TypeScript, strict mode                                       |
| Build           | tsup — ESM + CJS + `.d.ts` per package                        |
| Tests           | Vitest + happy-dom                                            |
| Lint + format   | Biome (single binary; do not add ESLint or Prettier)          |

### TypeScript configuration

A `tsconfig.base.json` at the repo root applies to every package. Baseline options:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `moduleResolution: "bundler"`
- `target: "ES2022"`
- `module: "ESNext"`

Individual packages extend the base and add only what they need (JSX settings, Vue shims, etc.).

## Testing strategy

- **Unit tests for IR.** Shape invariants, builder ergonomics, factory defaults.
- **Snapshot tests for the renderer.** `toMatchInlineSnapshot` keeps the expected SVG right next to the assertion so PR diffs are reviewable.
- **Separated parser tests.** Tokenizer tests check the token stream; parser tests check the IR it produces. Don't collapse them — a failing parser test with a green tokenizer test tells you exactly where the bug is.
- **Binding tests with happy-dom.** Smoke tests covering SSR output (pure-string render) and minimal prop reactivity. Do not test framework internals.
- **Fixtures for grammars.** Each grammar package keeps a small `__fixtures__/` directory with representative sources and their expected IR + SVG outputs.

## Adding a new grammar parser (summary)

Detailed checklist in `CLAUDE.md`. In short:

1. Spec it in `docs/grammars/<name>.md`.
2. Create `packages/parser-<name>` depending on `parser-utils` and `core`.
3. Implement `GrammarParser`.
4. Test tokenizer and parser separately, plus snapshot fixtures.
5. Register in `apps/playground`.

## Adding a new framework binding (summary)

1. Spec it in `docs/bindings/<name>.md`.
2. Create `packages/<name>` depending only on `core`.
3. Accept `{ source, parser }` or `{ ir }`; call `core.render`.
4. Stay SSR-safe.
5. Re-export the shared CSS.

## Commits

Short, imperative, present tense. Conventional Commits are encouraged (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) but not enforced. A commit that adds a feature without touching the spec is suspect — either the spec change landed earlier, or something is off.

## CI

Every push and pull request runs Biome, TypeScript, Vitest, and tsup on Node 20 and 22 via GitHub Actions (`.github/workflows/ci.yml`). Locally, the same three commands — `pnpm biome check .`, `pnpm -r typecheck`, `pnpm -r test` — are the bar before opening a PR.

## Releases

Publishing is driven by [Changesets](https://github.com/changesets/changesets). See [Releasing](./releasing.md) for the policy, the workflow, and the checklist before cutting a version.
