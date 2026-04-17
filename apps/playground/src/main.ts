import { diagram, nonTerminal, oneOrMore, optional, sequence, terminal } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import "@choo-choo/vanilla";
import type { ChooChooElement } from "@choo-choo/vanilla";
import "@choo-choo/vanilla/styles.css";
import "./style.css";

const DEFAULT_EBNF = `(* Arithmetic expressions — edit me. *)
digit      = ? 0-9 ?;
number     = digit , { digit };
expression = term , { ("+" | "-") , term };
term       = factor , { ("*" | "/") , factor };
factor     = number | "(" , expression , ")";
`;

const MANUAL_SNIPPET = `diagram(
  sequence(
    nonTerminal("identifier"),
    terminal("("),
    optional(oneOrMore(nonTerminal("argument"), terminal(","))),
    terminal(")"),
  ),
);`;

// --- EBNF panel -------------------------------------------------------------

const ebnfSourceEl = document.querySelector<HTMLTextAreaElement>("#ebnf-source");
const ebnfOutputEl = document.querySelector<ChooChooElement>("#ebnf-output");
const ebnfRuleEl = document.querySelector<HTMLSelectElement>("#ebnf-rule");
const ebnfComposeEl = document.querySelector<HTMLSelectElement>("#ebnf-compose");

if (!ebnfSourceEl || !ebnfOutputEl || !ebnfRuleEl || !ebnfComposeEl) {
  throw new Error("playground: EBNF panel elements not found");
}

ebnfOutputEl.parser = ebnfParser;
ebnfSourceEl.value = DEFAULT_EBNF;
ebnfOutputEl.setAttribute("source", DEFAULT_EBNF);

const refreshRuleOptions = (source: string): void => {
  let ruleNames: string[] = [];
  try {
    ruleNames = ebnfParser.parse(source).rules.map((rule) => rule.name);
  } catch {
    // Keep the previous selection while the grammar is broken.
    return;
  }
  const previous = ebnfRuleEl.value;
  ebnfRuleEl.innerHTML = "";
  for (const name of ruleNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    ebnfRuleEl.append(option);
  }
  if (ruleNames.includes(previous)) {
    ebnfRuleEl.value = previous;
  } else if (ruleNames[0]) {
    ebnfRuleEl.value = ruleNames[0];
    ebnfOutputEl.setAttribute("rule", ruleNames[0]);
  }
};

refreshRuleOptions(DEFAULT_EBNF);

ebnfSourceEl.addEventListener(
  "input",
  debounce(() => {
    ebnfOutputEl.setAttribute("source", ebnfSourceEl.value);
    refreshRuleOptions(ebnfSourceEl.value);
  }, 150),
);

ebnfRuleEl.addEventListener("change", () => {
  if (ebnfRuleEl.value) {
    ebnfOutputEl.setAttribute("rule", ebnfRuleEl.value);
  } else {
    ebnfOutputEl.removeAttribute("rule");
  }
});

ebnfComposeEl.addEventListener("change", () => {
  ebnfOutputEl.setAttribute("compose", ebnfComposeEl.value);
});

// --- Manual IR panel --------------------------------------------------------

const manualCodeEl = document.querySelector<HTMLElement>("#manual-code");
const manualOutputEl = document.querySelector<ChooChooElement>("#manual-output");

if (!manualCodeEl || !manualOutputEl) {
  throw new Error("playground: Manual panel elements not found");
}

manualCodeEl.textContent = MANUAL_SNIPPET;

manualOutputEl.ir = diagram(
  sequence(
    nonTerminal("identifier"),
    terminal("("),
    optional(oneOrMore(nonTerminal("argument"), terminal(","))),
    terminal(")"),
  ),
);

// --- Helpers ----------------------------------------------------------------

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
