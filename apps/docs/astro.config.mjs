import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://estudio-hawara.github.io",
  base: "/choo-choo",
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
