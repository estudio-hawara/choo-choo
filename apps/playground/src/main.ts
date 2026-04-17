import {
  diagram,
  nonTerminal,
  oneOrMore,
  optional,
  sequence,
  terminal,
} from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import "@choo-choo/vanilla";
import type { ChooChooElement } from "@choo-choo/vanilla";
import "@choo-choo/vanilla/styles.css";
import "./style.css";

const DEFAULT_EBNF = `(* Arithmetic expressions — edit me. *)
expression = term , { ("+" | "-") , term };
term       = factor , { ("*" | "/") , factor };
factor     = number | "(" , expression , ")";
number     = digit , { digit };
digit      = ? 0-9 ?;
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

if (!ebnfSourceEl || !ebnfOutputEl) {
  throw new Error("playground: EBNF panel elements not found");
}

ebnfOutputEl.parser = ebnfParser;
ebnfSourceEl.value = DEFAULT_EBNF;
ebnfOutputEl.setAttribute("source", DEFAULT_EBNF);

ebnfSourceEl.addEventListener(
  "input",
  debounce(() => {
    ebnfOutputEl.setAttribute("source", ebnfSourceEl.value);
  }, 150),
);

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
