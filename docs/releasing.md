---
title: Releasing
description: How choo-choo versions, builds, and publishes its packages.
---

This document describes how **Choo Choo** is versioned and published.

## Tooling

- **Changesets** drives versioning and publishing. Every workspace package that should ship to npm is scoped under `@choo-choo/*`.
- **GitHub Actions** runs the release automation. There are two workflows:
  - `ci.yml` — Biome, typecheck, tests, and build on every push and pull request.
  - `release.yml` — opens a "Version Packages" PR whenever changesets land on `main`, and publishes to npm when that PR is merged.

## Versioning policy

- **Independent versions** per package. Bumping `@choo-choo/core` does not force a bump on every binding.
- **Pre-1.0 semver.** While any package is on `0.y.z`:
  - Breaking changes bump the **minor**.
  - Feature additions and bug fixes bump the **patch**.
- Any package that imports `@choo-choo/core` at runtime declares it as a regular dependency and pins it to a `^` range. When `core` ships a breaking change, dependents open a follow-up changeset to match.

Once a package reaches `1.0.0`, standard semver applies.

## The release loop

1. **Open a PR with a changeset.**
   ```sh
   pnpm changeset
   ```
   Pick the packages the change touches, the bump type (patch / minor / major), and write a short user-facing summary. The CLI writes a file under `.changeset/` — commit it as part of the PR.

   A PR that is *not* user-facing (internal refactor, CI tweak, docs-only) does not need a changeset. In that case, add an **empty changeset** (`pnpm changeset --empty`) so the release bot does not block the merge.

2. **Merge to `main`.** CI runs, and on success the `release.yml` workflow either:
   - opens or updates a **"Version Packages"** PR that applies every pending changeset to package versions and to `CHANGELOG.md` files; or
   - if that PR is already merged, runs `pnpm release` which builds every package and calls `pnpm changeset publish` against npm.

3. **Review the Version Packages PR.** It is machine-generated — skim the version bumps and the changelog entries and merge when they look right. Merging it is what triggers the actual publish.

## Publish requirements

- All packages under `@choo-choo/*` publish with `publishConfig.access = "public"` (they are scoped and would otherwise be private by default).
- `NPM_TOKEN` must be set as a repository secret. The token needs **publish** permission on the `@choo-choo` scope.
- `GITHUB_TOKEN` is provided by Actions; `release.yml` uses it to open the Version Packages PR and to create the git tags.

## Package metadata

Every publishable `package.json` carries:

- `name`, `version`, `description`, `license: "MIT"`, `author`.
- `repository` with `type: "git"`, the repo URL, and a `directory` pointer (`packages/<name>`).
- `homepage` pointing at the docs site.
- `bugs` pointing at GitHub issues.
- `keywords` that make the package discoverable on npm.
- `sideEffects: false` where the package is pure JS (everything except the bindings that ship a CSS file — those set `sideEffects: ["./styles.css"]`).
- `publishConfig.access: "public"` and the `dist`-oriented `main` / `module` / `types` / `exports` overrides so consumers load the built output, not `src/`.

`packages/astro` is published source-only (no build step) and therefore omits the `publishConfig` dist overrides. It still sets `publishConfig.access: "public"`.

## Docs site

`apps/docs` (Astro + Starlight) is deployed to **GitHub Pages** on every push to `main` by the `docs.yml` workflow. Its sources are the canonical files under `docs/**` — the Starlight site pulls them in via symlinks, so updating a spec automatically updates the published docs on the next deploy.

## Checklist before cutting a version

- [ ] `pnpm biome check .`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build` all green.
- [ ] Every user-facing change in the release has a changeset.
- [ ] The roadmap file for the version (`docs/roadmap/<version>.md`) reflects what actually shipped.
- [ ] The Version Packages PR diff looks right.
- [ ] Merge the Version Packages PR — the release workflow takes it from there.
