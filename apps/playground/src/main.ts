import type { GrammarParser } from "@choo-choo/core";
import { antlrParser } from "@choo-choo/parser-antlr";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import "@choo-choo/vanilla";
import type { ChooChooElement } from "@choo-choo/vanilla";
import "@choo-choo/vanilla/styles.css";
import "./style.css";

type GrammarId = "ebnf" | "antlr";

const DEFAULT_SOURCES: Record<GrammarId, string> = {
  ebnf: `(* Arithmetic expressions — edit me. *)
digit      = ? 0-9 ?;
number     = digit , { digit };
term       = factor , { ("*" | "/") , factor };
expression = term , { ("+" | "-") , term };
factor     = number | "(" , expression , ")";
`,
  antlr: `// Arithmetic expressions — edit me.
grammar Calc;

INT    : [0-9]+ ;
WS     : [ \\t\\r\\n]+ -> skip ;

expr   : term (('+' | '-') term)* ;
term   : factor (('*' | '/') factor)* ;
factor : INT | '(' expr ')' ;
`,
};

const PARSERS: Record<GrammarId, GrammarParser> = {
  ebnf: ebnfParser,
  antlr: antlrParser,
};

interface PlaygroundElements {
  source: HTMLTextAreaElement;
  output: ChooChooElement;
  grammar: HTMLSelectElement;
  rule: HTMLSelectElement;
  compose: HTMLSelectElement;
}

function findElements(): PlaygroundElements {
  const source = document.querySelector<HTMLTextAreaElement>("#source");
  const output = document.querySelector<ChooChooElement>("#output");
  const grammar = document.querySelector<HTMLSelectElement>("#grammar-select");
  const rule = document.querySelector<HTMLSelectElement>("#rule-select");
  const compose = document.querySelector<HTMLSelectElement>("#compose-select");
  if (!source || !output || !grammar || !rule || !compose) {
    throw new Error("playground: required DOM elements not found");
  }
  return { source, output, grammar, rule, compose };
}

const els = findElements();
let currentGrammar: GrammarId = "ebnf";

applyGrammar(currentGrammar);
els.compose.value = "grouped";
els.output.setAttribute("compose", "grouped");

els.grammar.addEventListener("change", () => {
  const next = els.grammar.value as GrammarId;
  if (next === currentGrammar) return;
  currentGrammar = next;
  applyGrammar(next);
});

els.source.addEventListener(
  "input",
  debounce(() => {
    els.output.setAttribute("source", els.source.value);
    refreshRuleOptions(els.source.value);
  }, 150),
);

els.rule.addEventListener("change", () => {
  if (els.rule.value) {
    els.output.setAttribute("rule", els.rule.value);
  } else {
    els.output.removeAttribute("rule");
  }
});

els.compose.addEventListener("change", () => {
  els.output.setAttribute("compose", els.compose.value);
});

function applyGrammar(id: GrammarId): void {
  els.output.parser = PARSERS[id];
  const source = DEFAULT_SOURCES[id];
  els.source.value = source;
  els.output.setAttribute("source", source);
  refreshRuleOptions(source);
}

function refreshRuleOptions(source: string): void {
  const parser = PARSERS[currentGrammar];
  let ruleNames: string[] = [];
  try {
    ruleNames = parser.parse(source).rules.map((rule) => rule.name);
  } catch {
    // Keep the previous selection while the grammar is broken.
    return;
  }
  const previous = els.rule.value;
  els.rule.innerHTML = "";
  for (const name of ruleNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.rule.append(option);
  }
  const last = ruleNames[ruleNames.length - 1];
  if (ruleNames.includes(previous)) {
    els.rule.value = previous;
  } else if (last) {
    els.rule.value = last;
    els.output.setAttribute("rule", last);
  }
}

function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): (...args: Args) => void {
  let handle: number | undefined;
  return (...args: Args) => {
    if (handle !== undefined) window.clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), ms);
  };
}
