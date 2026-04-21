import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import rehypeRelativeMarkdownLinks from "astro-rehype-relative-markdown-links";

export default defineConfig({
  site: "https://estudio-hawara.github.io",
  base: "/choo-choo",
  markdown: {
    rehypePlugins: [
      [
        rehypeRelativeMarkdownLinks,
        {
          base: "/choo-choo",
          collectionBase: false,
          trailingSlash: "always",
        },
      ],
    ],
  },
  integrations: [
    starlight({
      title: "choo-choo",
      description: "Railroad diagrams from EBNF, ANTLR, and PEG grammars.",
      social: {
        github: "https://github.com/estudio-hawara/choo-choo",
      },
      sidebar: [
        { label: "Introduction", link: "/" },
        {
          label: "Quickstart",
          items: [
            { label: "Overview", link: "/quickstart/" },
            { label: "Hello world", link: "/quickstart/hello-world/" },
            { label: "Grammar example", link: "/quickstart/grammar/" },
            { label: "Where to go next", link: "/quickstart/next-steps/" },
          ],
        },
        {
          label: "Core",
          items: [
            { label: "Architecture", link: "/architecture/" },
            { label: "Intermediate representation", link: "/ir/" },
            { label: "Rendering", link: "/rendering/" },
            { label: "Manual builder", link: "/builder/" },
            { label: "Composition", link: "/composition/" },
          ],
        },
        {
          label: "Grammars",
          items: [
            { label: "EBNF", link: "/grammars/ebnf/" },
            { label: "ANTLR", link: "/grammars/antlr/" },
            { label: "PEG (peggy)", link: "/grammars/peg/" },
            { label: "Python PEG (pegen)", link: "/grammars/python-peg/" },
          ],
        },
        {
          label: "Bindings",
          items: [
            { label: "Vanilla JS", link: "/bindings/vanilla/" },
            { label: "React", link: "/bindings/react/" },
            { label: "Vue", link: "/bindings/vue/" },
            { label: "Astro", link: "/bindings/astro/" },
          ],
        },
        {
          label: "Contributing",
          items: [
            { label: "Development", link: "/development/" },
            { label: "Contributing", link: "/contributing/" },
            { label: "Releasing", link: "/releasing/" },
          ],
        },
      ],
    }),
  ],
});
