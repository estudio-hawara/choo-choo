import { diagram, sequence, terminal } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "./mount.js";

describe("mount()", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });

  it("renders IR into the target and returns an unmount function that clears it", () => {
    const ir = diagram(terminal("x"));
    const unmount = mount(host, { ir });
    expect(host.querySelector("svg")).not.toBeNull();
    unmount();
    expect(host.innerHTML).toBe("");
  });

  it("accepts a grammar source + parser and renders the first rule by default", () => {
    mount(host, { source: `a = "x";`, parser: ebnfParser });
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelector(".terminal")).not.toBeNull();
  });

  it("selects a rule by name when options.rule is set", () => {
    mount(host, {
      source: `a = "1"; b = "2";`,
      parser: ebnfParser,
      rule: "b",
    });
    const svg = host.innerHTML;
    expect(svg).toContain(">2</text>");
    expect(svg).not.toContain(">1</text>");
  });

  it("throws when the requested rule is not in the parsed grammar", () => {
    expect(() => mount(host, { source: `a = "x";`, parser: ebnfParser, rule: "missing" })).toThrow(
      /rule "missing" not found/,
    );
  });

  it("forwards RenderOptions (emitSourceData) to the renderer", () => {
    mount(host, {
      source: `a = "x";`,
      parser: ebnfParser,
      options: { emitSourceData: true },
    });
    expect(host.innerHTML).toContain("data-source-offset-start=");
  });

  it("renders a nontrivial IR produced by the manual builder", () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    mount(host, { ir });
    const svg = host.innerHTML;
    expect(svg).toContain(`class="sequence"`);
    expect(svg).toContain(">a</text>");
    expect(svg).toContain(">b</text>");
  });

  it("inlines prior rules when compose: 'yes'", () => {
    mount(host, {
      source: `digit = "0" | "1"; pair = digit , digit;`,
      parser: ebnfParser,
      rule: "pair",
      compose: "yes",
    });
    const svg = host.innerHTML;
    expect(svg).toContain(`class="terminal"`);
    expect(svg).not.toContain(`class="non-terminal"`);
    expect(svg).toContain(">0</text>");
    expect(svg).toContain(">1</text>");
  });

  it("wraps inlined rules in a labelled group when compose: 'grouped'", () => {
    mount(host, {
      source: `digit = "0" | "1"; pair = digit , digit;`,
      parser: ebnfParser,
      rule: "pair",
      compose: "grouped",
    });
    const svg = host.innerHTML;
    expect(svg).toContain(`class="group"`);
    expect(svg).toContain(">digit</text>");
  });
});
