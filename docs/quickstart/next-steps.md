---
title: Where to go next
description: Per-framework bindings and a bundler-free alternative.
---

## Pick a different framework

The `<ChooChoo>` component exists for every supported binding. See each one's package README for a drop-in example:

- [`@choo-choo/react`](https://www.npmjs.com/package/@choo-choo/react)
- [`@choo-choo/vue`](https://www.npmjs.com/package/@choo-choo/vue)
- [`@choo-choo/astro`](https://www.npmjs.com/package/@choo-choo/astro)

## Without a bundler

Vite is the pragmatic default, but if you want **zero** dev dependencies you can use an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) plus any static file server. You declare where each bare specifier resolves to, then open the page:

```html
<script type="importmap">
  {
    "imports": {
      "@choo-choo/core": "./node_modules/@choo-choo/core/dist/index.js",
      "@choo-choo/vanilla": "./node_modules/@choo-choo/vanilla/dist/index.js"
    }
  }
</script>
<script type="module" src="./src/main.js"></script>
```

Then serve the folder (ex. `pnpm dlx serve`).

> This works but is fragile: you have to maintain one entry per transitive dependency and track the internal `dist/` path of each package. For anything beyond a throwaway demo, Vite is less friction.
