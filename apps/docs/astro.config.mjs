import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "choo-choo",
      description: "Railroad diagrams from EBNF, ANTLR, and PEG grammars.",
      sidebar: [
        { label: "Introduction", link: "/" },
        {
          label: "Core",
          items: [
            { label: "Architecture", link: "/architecture/" },
            { label: "IR", link: "/ir/" },
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
            { label: "PEG", link: "/grammars/peg/" },
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
      ],
    }),
  ],
});
