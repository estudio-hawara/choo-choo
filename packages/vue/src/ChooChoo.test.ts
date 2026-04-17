import { diagram, sequence, terminal } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import { renderToString } from "@vue/server-renderer";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { ChooChoo } from "./ChooChoo.js";

describe("<ChooChoo /> — client render", () => {
  it("renders a Diagram passed via the ir prop", () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    const wrapper = mount(ChooChoo, { props: { ir } });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.html()).toContain(">a</text>");
    expect(wrapper.html()).toContain(">b</text>");
    wrapper.unmount();
  });

  it("renders grammar source + parser (first rule by default)", () => {
    const wrapper = mount(ChooChoo, {
      props: { source: `a = "1"; b = "2";`, parser: ebnfParser },
    });
    expect(wrapper.html()).toContain(">1</text>");
    expect(wrapper.html()).not.toContain(">2</text>");
    wrapper.unmount();
  });

  it("selects a rule by name via the rule prop", () => {
    const wrapper = mount(ChooChoo, {
      props: { source: `a = "1"; b = "2";`, parser: ebnfParser, rule: "b" },
    });
    expect(wrapper.html()).toContain(">2</text>");
    expect(wrapper.html()).not.toContain(">1</text>");
    wrapper.unmount();
  });

  it("inlines prior rules when compose='yes'", () => {
    const wrapper = mount(ChooChoo, {
      props: {
        source: `digit = "0" | "1"; pair = digit , digit;`,
        parser: ebnfParser,
        rule: "pair",
        compose: "yes",
      },
    });
    expect(wrapper.html()).toContain(">0</text>");
    expect(wrapper.html()).toContain(">1</text>");
    expect(wrapper.html()).not.toContain('class="non-terminal"');
    wrapper.unmount();
  });

  it("wraps inlined rules in a labelled group when compose='grouped'", () => {
    const wrapper = mount(ChooChoo, {
      props: {
        source: `digit = "0" | "1"; pair = digit , digit;`,
        parser: ebnfParser,
        rule: "pair",
        compose: "grouped",
      },
    });
    expect(wrapper.html()).toContain('class="group"');
    expect(wrapper.html()).toContain(">digit</text>");
    wrapper.unmount();
  });

  it("forwards wrapper attributes to the surrounding div", () => {
    const ir = diagram(terminal("x"));
    const wrapper = mount(ChooChoo, {
      props: { ir },
      attrs: { id: "test-wrapper", class: "custom-class", "aria-label": "railroad" },
    });
    const outerDiv = wrapper.element as HTMLElement;
    expect(outerDiv.tagName).toBe("DIV");
    expect(outerDiv.id).toBe("test-wrapper");
    expect(outerDiv.className).toContain("custom-class");
    expect(outerDiv.getAttribute("aria-label")).toBe("railroad");
    expect(wrapper.find("svg").exists()).toBe(true);
    wrapper.unmount();
  });

  it("re-renders with new props when the source changes", async () => {
    const wrapper = mount(ChooChoo, {
      props: { source: `a = "first";`, parser: ebnfParser },
    });
    expect(wrapper.html()).toContain(">first</text>");
    await wrapper.setProps({ source: `a = "second";`, parser: ebnfParser });
    expect(wrapper.html()).toContain(">second</text>");
    expect(wrapper.html()).not.toContain(">first</text>");
    wrapper.unmount();
  });
});

describe("<ChooChoo /> — server render", () => {
  it("produces a self-contained SVG string via renderToString", async () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    const app = createSSRApp({
      render: () => h(ChooChoo, { ir }),
    });
    const html = await renderToString(app);
    expect(html.startsWith("<div")).toBe(true);
    expect(html).toContain("<svg");
    expect(html).toContain(">a</text>");
    expect(html).toContain(">b</text>");
  });

  it("renders a grammar-driven diagram on the server", async () => {
    const app = createSSRApp({
      render: () => h(ChooChoo, { source: `root = "hi";`, parser: ebnfParser }),
    });
    const html = await renderToString(app);
    expect(html).toContain("<svg");
    expect(html).toContain(">hi</text>");
  });
});

describe("<ChooChoo /> — error propagation", () => {
  it("throws when the requested rule is not in the parsed grammar", async () => {
    const app = createSSRApp({
      render: () => h(ChooChoo, { source: `a = "x";`, parser: ebnfParser, rule: "missing" }),
    });
    await expect(renderToString(app)).rejects.toThrow(/rule "missing" not found/);
  });
});
