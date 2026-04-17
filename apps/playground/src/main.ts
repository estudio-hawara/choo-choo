import { ebnfParser } from "@choo-choo/parser-ebnf";
import "@choo-choo/vanilla";
import type { ChooChooElement } from "@choo-choo/vanilla";
import "@choo-choo/vanilla/styles.css";
import "./style.css";

const DEFAULT_EBNF = `(* Arithmetic expressions — edit me. *)
digit      = ? 0-9 ?;
number     = digit , { digit };
term       = factor , { ("*" | "/") , factor };
expression = term , { ("+" | "-") , term };
factor     = number | "(" , expression , ")";
`;

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
ebnfComposeEl.value = "grouped";
ebnfOutputEl.setAttribute("compose", "grouped");

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
  const last = ruleNames[ruleNames.length - 1];
  if (ruleNames.includes(previous)) {
    ebnfRuleEl.value = previous;
  } else if (last) {
    ebnfRuleEl.value = last;
    ebnfOutputEl.setAttribute("rule", last);
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
