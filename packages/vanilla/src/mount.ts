import {
  type ComposeMode,
  type Diagram,
  type GrammarParser,
  type ParsedGrammar,
  type RenderOptions,
  composeRule,
  render,
} from "@choo-choo/core";

export type MountOptions =
  | {
      ir: Diagram;
      options?: RenderOptions;
    }
  | {
      source: string;
      parser: GrammarParser;
      rule?: string;
      compose?: ComposeMode;
      options?: RenderOptions;
    };

export function mount(target: Element, options: MountOptions): () => void {
  const diagram = resolveDiagram(options);
  const svg = render(diagram, options.options);
  target.innerHTML = svg;
  return () => {
    target.innerHTML = "";
  };
}

function resolveDiagram(options: MountOptions): Diagram {
  if ("ir" in options) {
    return options.ir;
  }
  const parsed: ParsedGrammar = options.parser.parse(options.source);
  const rule = options.rule
    ? parsed.rules.find((candidate) => candidate.name === options.rule)
    : parsed.rules[0];
  if (!rule) {
    throw new Error(
      options.rule
        ? `mount: rule "${options.rule}" not found in parsed grammar`
        : "mount: parsed grammar has no rules",
    );
  }
  return composeRule(parsed, rule.name, options.compose ?? "no");
}
