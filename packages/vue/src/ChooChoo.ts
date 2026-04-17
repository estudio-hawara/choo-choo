import {
  type ComposeMode,
  type Diagram,
  type GrammarParser,
  type ParsedGrammar,
  type RenderOptions,
  composeRule,
  render,
} from "@choo-choo/core";
import { type HTMLAttributes, type PropType, defineComponent, h } from "vue";

type BaseProps = Omit<HTMLAttributes, "innerHTML"> & {
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

interface InternalProps {
  ir: Diagram | undefined;
  source: string | undefined;
  parser: GrammarParser | undefined;
  rule: string | undefined;
  compose: ComposeMode | undefined;
  options: RenderOptions | undefined;
}

export const ChooChoo = defineComponent({
  name: "ChooChoo",
  inheritAttrs: false,
  props: {
    ir: { type: Object as PropType<Diagram>, default: undefined },
    source: { type: String, default: undefined },
    parser: { type: Object as PropType<GrammarParser>, default: undefined },
    rule: { type: String, default: undefined },
    compose: { type: String as PropType<ComposeMode>, default: undefined },
    options: { type: Object as PropType<RenderOptions>, default: undefined },
  },
  setup(props, { attrs }) {
    return () => {
      const diagram = resolveDiagram(props);
      const svg = render(diagram, props.options);
      return h("div", { ...attrs, innerHTML: svg });
    };
  },
});

function resolveDiagram(props: InternalProps): Diagram {
  if (props.ir !== undefined) return props.ir;
  if (props.parser === undefined || props.source === undefined) {
    throw new Error("<ChooChoo>: must pass either `ir` or both `source` and `parser`");
  }
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
