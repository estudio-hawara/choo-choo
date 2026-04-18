# @choo-choo/vue

Vue 3 binding for [Choo Choo](https://github.com/estudio-hawara/choo-choo): a `<ChooChoo>` component that renders a railroad diagram from a grammar source or a pre-built IR. SSR-safe, hook-free.

## Install

```sh
npm install @choo-choo/vue
```

Plus one grammar parser of your choice if you want to pass a `source`:

```sh
npm install @choo-choo/parser-ebnf
```

## Example

```vue
<script setup lang="ts">
import { ChooChoo } from "@choo-choo/vue";
import { ebnfParser } from "@choo-choo/parser-ebnf";

const source = `
digit = "0" | "1" ;
pair  = digit , digit ;
`;
</script>

<template>
  <ChooChoo :source="source" :parser="ebnfParser" rule="pair" />
</template>
```

You can also skip the parser and pass a pre-built IR via the `ir` prop — handy if you construct diagrams with `@choo-choo/core`'s builder API.

## Learn more

- [Documentation](https://estudio-hawara.github.io/choo-choo)
- [GitHub](https://github.com/estudio-hawara/choo-choo)

## License

MIT
