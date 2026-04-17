import { diagram, sequence, terminal } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChooChoo } from "./ChooChoo.js";

describe("<ChooChoo /> — client render", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it("renders a Diagram passed via the ir prop", () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    act(() => {
      root.render(<ChooChoo ir={ir} />);
    });
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.innerHTML).toContain(">a</text>");
    expect(host.innerHTML).toContain(">b</text>");
  });

  it("renders grammar source + parser (first rule by default)", () => {
    act(() => {
      root.render(<ChooChoo source={`a = "1"; b = "2";`} parser={ebnfParser} />);
    });
    expect(host.innerHTML).toContain(">1</text>");
    expect(host.innerHTML).not.toContain(">2</text>");
  });

  it("selects a rule by name via the rule prop", () => {
    act(() => {
      root.render(<ChooChoo source={`a = "1"; b = "2";`} parser={ebnfParser} rule="b" />);
    });
    expect(host.innerHTML).toContain(">2</text>");
    expect(host.innerHTML).not.toContain(">1</text>");
  });

  it("inlines prior rules when compose='yes'", () => {
    act(() => {
      root.render(
        <ChooChoo
          source={`digit = "0" | "1"; pair = digit , digit;`}
          parser={ebnfParser}
          rule="pair"
          compose="yes"
        />,
      );
    });
    expect(host.innerHTML).toContain(">0</text>");
    expect(host.innerHTML).toContain(">1</text>");
    expect(host.innerHTML).not.toContain('class="non-terminal"');
  });

  it("wraps inlined rules in a labelled group when compose='grouped'", () => {
    act(() => {
      root.render(
        <ChooChoo
          source={`digit = "0" | "1"; pair = digit , digit;`}
          parser={ebnfParser}
          rule="pair"
          compose="grouped"
        />,
      );
    });
    expect(host.innerHTML).toContain('class="group"');
    expect(host.innerHTML).toContain(">digit</text>");
  });

  it("forwards wrapper attributes to the surrounding div", () => {
    const ir = diagram(terminal("x"));
    act(() => {
      root.render(
        <ChooChoo ir={ir} id="test-wrapper" className="custom-class" aria-label="railroad" />,
      );
    });
    const wrapper = host.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.id).toBe("test-wrapper");
    expect(wrapper.className).toBe("custom-class");
    expect(wrapper.getAttribute("aria-label")).toBe("railroad");
    expect(wrapper.querySelector("svg")).not.toBeNull();
  });

  it("re-renders with new props when the source changes", () => {
    act(() => {
      root.render(<ChooChoo source={`a = "first";`} parser={ebnfParser} />);
    });
    expect(host.innerHTML).toContain(">first</text>");
    act(() => {
      root.render(<ChooChoo source={`a = "second";`} parser={ebnfParser} />);
    });
    expect(host.innerHTML).toContain(">second</text>");
    expect(host.innerHTML).not.toContain(">first</text>");
  });
});

describe("<ChooChoo /> — server render", () => {
  it("produces a self-contained SVG string via renderToStaticMarkup", () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    const html = renderToStaticMarkup(<ChooChoo ir={ir} />);
    expect(html.startsWith("<div")).toBe(true);
    expect(html).toContain("<svg");
    expect(html).toContain(">a</text>");
    expect(html).toContain(">b</text>");
  });

  it("renders a grammar-driven diagram on the server", () => {
    const html = renderToStaticMarkup(<ChooChoo source={`root = "hi";`} parser={ebnfParser} />);
    expect(html).toContain("<svg");
    expect(html).toContain(">hi</text>");
  });
});

describe("<ChooChoo /> — error propagation", () => {
  it("throws when the requested rule is not in the parsed grammar", () => {
    expect(() =>
      renderToStaticMarkup(<ChooChoo source={`a = "x";`} parser={ebnfParser} rule="missing" />),
    ).toThrow(/rule "missing" not found/);
  });
});
