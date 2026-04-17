import type { ComposeMode, Diagram, GrammarParser, RenderOptions } from "@choo-choo/core";
import type { HTMLAttributes } from "astro/types";

type BaseProps = Omit<HTMLAttributes<"div">, "set:html"> & {
  options?: RenderOptions;
};

export type ChooChooProps =
  | (BaseProps & { ir: Diagram })
  | (BaseProps & {
      source: string;
      parser: GrammarParser;
      rule?: string;
      compose?: ComposeMode;
    });
