---
"@choo-choo/astro": minor
---

Widen the `astro` peer dependency range to `^4 || ^5 || ^6 || ^7`, adding support for Astro 6 and 7. No component code changed — the `<ChooChoo>` source still typechecks and renders against the same `astro/types` surface (`HTMLAttributes`, `set:html`, `astro/client`) across all four major versions. Note that Astro 6+ declares `engines.node: ">=22.12.0"`; consumers on Node 20 should stay on Astro 4 or 5.