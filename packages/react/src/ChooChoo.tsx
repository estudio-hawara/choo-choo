import {
  type ComposeMode,
  type Diagram,
  type GrammarParser,
  type ParsedGrammar,
  type RenderOptions,
  composeRule,
  render,
} from "@choo-choo/core";
import type { HTMLAttributes } from "react";

type BaseProps = Omit<HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML" | "children"> & {
  options?: RenderOptions;
};

type IrProps = BaseProps & { ir: Diagram };

type GrammarProps = BaseProps & {
  source: string;
  parser: GrammarParser;
  rule?: string;
  compose?: ComposeMode;
};

export type ChooChooProps = IrProps | GrammarProps;

export function ChooChoo(props: ChooChooProps) {
  const diagram = resolveDiagram(props);
  const svg = render(diagram, props.options);
  const wrapperProps = stripDiagramProps(props);
  return (
    <div
      {...wrapperProps}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: svg is produced by our own @choo-choo/core render() — not user input — so XSS is not a concern here
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function resolveDiagram(props: ChooChooProps): Diagram {
  if ("ir" in props) return props.ir;
  const parsed: ParsedGrammar = props.parser.parse(props.source);
  const rule = props.rule
    ? parsed.rules.find((candidate) => candidate.name === props.rule)
    : parsed.rules[0];
  if (!rule) {
    throw new Error(
      props.rule
        ? `<ChooChoo>: rule "${props.rule}" not found in parsed grammar`
        : "<ChooChoo>: parsed grammar has no rules",
    );
  }
  return composeRule(parsed, rule.name, props.compose ?? "no");
}

function stripDiagramProps(props: ChooChooProps): HTMLAttributes<HTMLDivElement> {
  if ("ir" in props) {
    const { ir: _ir, options: _options, ...wrapper } = props;
    return wrapper;
  }
  const {
    source: _source,
    parser: _parser,
    rule: _rule,
    compose: _compose,
    options: _options,
    ...wrapper
  } = props;
  return wrapper;
}
