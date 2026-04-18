---
title: Contributing
description: How to contribute to choo-choo.
---

Thanks for your interest in **Choo Choo**. This page has the rules you need to land a change.

## The short version

1. **Spec first.** Update `README.md` and/or files under `docs/**` to describe the behaviour you are adding or changing.
2. **Code.** Implement it.
3. **Tests.** Back it with Vitest tests that exercise the spec.
4. **Changeset.** Run `pnpm changeset` and commit the generated file.
5. Open a pull request.

No code without a spec. No spec without tests. See [Development](./development.md) for the full workflow.

## Prerequisites

- **Node** ≥ 20
- **pnpm** ≥ 10
- A recent git

## Setup

```sh
git clone https://github.com/estudio-hawara/choo-choo.git
cd choo-choo
pnpm install
```

Useful commands:

```sh
pnpm -r build                       # build every package
pnpm -r test                        # run every test suite
pnpm --filter @choo-choo/core test  # run one package's tests
pnpm biome check .                  # lint + format
pnpm --filter playground dev        # run the playground
pnpm --filter docs dev              # run the docs site
```

## Branches and commits

- Branch off `main`. Keep branches focused — one vertical slice per PR.
- Commits are short, imperative, and in the present tense. Conventional Commits are encouraged (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) but not enforced.
- The **project language is English** — code, comments, commit messages, PR descriptions, and docs. Issues and discussions can be in any language.

## Changesets

Every user-facing change needs a changeset so the release workflow knows what to version.

```sh
pnpm changeset
```

Select the packages the change touches, pick the bump type (patch / minor / major), and write a one-line user-facing summary. The CLI writes a markdown file under `.changeset/` — commit it with your PR.

If your change is purely internal (refactor, CI tweak, docs-only with no public-API impact), add an empty changeset so the release bot does not block merges:

```sh
pnpm changeset --empty
```

See [Releasing](./releasing.md) for the full flow from changeset to published npm package.

## Where to add things

- A new **grammar parser**? Start with `docs/grammars/<name>.md`, then `packages/parser-<name>`. See [Architecture](./architecture.md).
- A new **framework binding**? Start with `docs/bindings/<name>.md`, then `packages/<name>`.
- A new **renderer feature**? Update `docs/rendering.md` and/or `docs/ir.md` first.

The detailed checklists are in `CLAUDE.md`.

## House rules

- `@choo-choo/core` has **no runtime dependencies**. If you think it needs one, open an issue first.
- The renderer does **not touch the DOM**. It emits strings.
- Bindings do **not import parsers**. Consumers pick the parser they want.
- Everything is **SSR-safe**. No top-level `window` / `document` references in `packages/*`.

## Reporting bugs and requesting features

File an issue at [github.com/estudio-hawara/choo-choo/issues](https://github.com/estudio-hawara/choo-choo/issues). Minimal reproductions go a long way — a grammar source plus the IR you expected beats a description every time.
