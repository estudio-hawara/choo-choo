import {
  diagram,
  nonTerminal,
  oneOrMore,
  optional,
  render,
  sequence,
  terminal,
} from "@choo-choo/core";
import { describe, it } from "vitest";
import { ebnfParser } from "./index.js";

describe("sketch", () => {
  it("renders the playground EBNF expression diagram", () => {
    const parsed = ebnfParser.parse(`expression = term , { ("+" | "-") , term };`);
    const first = parsed.rules[0]!.diagram;
    console.log(render(first));
  });

  it("renders the playground manual diagram", () => {
    const ir = diagram(
      sequence(
        nonTerminal("identifier"),
        terminal("("),
        optional(oneOrMore(nonTerminal("argument"), terminal(","))),
        terminal(")"),
      ),
    );
    console.log(render(ir));
  });
});
