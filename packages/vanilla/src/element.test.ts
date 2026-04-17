import { diagram, terminal } from "@choo-choo/core";
import { ebnfParser } from "@choo-choo/parser-ebnf";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChooChooElement } from "./element.js";
import "./index.js";

async function flush(ms = 20): Promise<void> {
  // Give the render pipeline time to finish — covers both the microtask-scheduled
  // synchronous path and the dynamic-import async path (which may span several
  // macrotasks inside Vitest's module loader).
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("<choo-choo> element registration", () => {
  it("is registered against the HTML tag 'choo-choo'", () => {
    expect(customElements.get("choo-choo")).toBe(ChooChooElement);
  });

  it("can be created via document.createElement", () => {
    const element = document.createElement("choo-choo");
    expect(element).toBeInstanceOf(ChooChooElement);
  });
});

describe("<choo-choo> rendering paths", () => {
  let element: ChooChooElement;

  beforeEach(() => {
    element = document.createElement("choo-choo") as ChooChooElement;
    document.body.append(element);
  });
  afterEach(() => {
    element.remove();
  });

  it("renders from the .ir property", async () => {
    element.ir = diagram(terminal("x"));
    await flush();
    expect(element.querySelector("svg")).not.toBeNull();
  });

  it("renders from source attribute + explicit parser property", async () => {
    element.parser = ebnfParser;
    element.setAttribute("source", `a = "x";`);
    await flush();
    expect(element.querySelector("svg")).not.toBeNull();
    expect(element.querySelector(".terminal")).not.toBeNull();
  });

  it("renders from textContent when no source attribute is set", async () => {
    // Use a fresh element so connectedCallback captures the textContent we set up first.
    const freshElement = document.createElement("choo-choo") as ChooChooElement;
    freshElement.textContent = `\n  root = "multi-line";\n`;
    freshElement.parser = ebnfParser;
    document.body.append(freshElement);
    await flush();
    expect(freshElement.querySelector("svg")).not.toBeNull();
    expect(freshElement.innerHTML).toContain(">multi-line</text>");
    freshElement.remove();
  });

  it("prefers the source attribute over textContent when both are present", async () => {
    const freshElement = document.createElement("choo-choo") as ChooChooElement;
    freshElement.textContent = `a = "from-content";`;
    freshElement.parser = ebnfParser;
    freshElement.setAttribute("source", `a = "from-attr";`);
    document.body.append(freshElement);
    await flush();
    expect(freshElement.innerHTML).toContain(">from-attr</text>");
    expect(freshElement.innerHTML).not.toContain(">from-content</text>");
    freshElement.remove();
  });

  it("selects a rule by the rule attribute", async () => {
    element.parser = ebnfParser;
    element.setAttribute("source", `a = "1"; b = "2";`);
    element.setAttribute("rule", "b");
    await flush();
    expect(element.innerHTML).toContain(">2</text>");
    expect(element.innerHTML).not.toContain(">1</text>");
  });

  it("inlines prior rules when compose='yes'", async () => {
    element.parser = ebnfParser;
    element.setAttribute("source", `digit = "0" | "1"; pair = digit , digit;`);
    element.setAttribute("rule", "pair");
    element.setAttribute("compose", "yes");
    await flush();
    expect(element.innerHTML).toContain(">0</text>");
    expect(element.innerHTML).toContain(">1</text>");
    expect(element.innerHTML).not.toContain(`class="non-terminal"`);
  });

  it("wraps inlined rules in a labelled group when compose='grouped'", async () => {
    element.parser = ebnfParser;
    element.setAttribute("source", `digit = "0" | "1"; pair = digit , digit;`);
    element.setAttribute("rule", "pair");
    element.setAttribute("compose", "grouped");
    await flush();
    expect(element.innerHTML).toContain(`class="group"`);
    expect(element.innerHTML).toContain(">digit</text>");
  });

  it("surfaces a choo-choo-error on an invalid compose value", async () => {
    const received: Error[] = [];
    element.addEventListener("choo-choo-error", (event) => {
      received.push((event as CustomEvent<{ error: Error }>).detail.error);
    });
    element.parser = ebnfParser;
    element.setAttribute("source", `a = "x";`);
    element.setAttribute("compose", "maybe");
    await flush();
    expect(received).toHaveLength(1);
    expect(received[0]?.message).toMatch(/compose must be/);
  });

  it("clears the element when source and grammar are both absent", async () => {
    element.innerHTML = "<span>placeholder</span>";
    element.parser = ebnfParser;
    await flush();
    expect(element.innerHTML).toBe("");
  });

  it("re-renders when the source attribute changes", async () => {
    element.parser = ebnfParser;
    element.setAttribute("source", `a = "first";`);
    await flush();
    expect(element.innerHTML).toContain(">first</text>");
    element.setAttribute("source", `a = "second";`);
    await flush();
    expect(element.innerHTML).toContain(">second</text>");
    expect(element.innerHTML).not.toContain(">first</text>");
  });

  it("clears itself on disconnectedCallback", async () => {
    element.ir = diagram(terminal("x"));
    await flush();
    expect(element.querySelector("svg")).not.toBeNull();
    element.remove();
    expect(element.innerHTML).toBe("");
  });
});

describe("<choo-choo> events", () => {
  let element: ChooChooElement;

  beforeEach(() => {
    element = document.createElement("choo-choo") as ChooChooElement;
    document.body.append(element);
  });
  afterEach(() => {
    element.remove();
  });

  it("dispatches 'choo-choo-render' after a successful render", async () => {
    const received: string[] = [];
    element.addEventListener("choo-choo-render", (event) => {
      received.push((event as CustomEvent<{ svg: string }>).detail.svg);
    });
    element.ir = diagram(terminal("x"));
    await flush();
    expect(received).toHaveLength(1);
    expect(received[0]?.startsWith("<svg ")).toBe(true);
  });

  it("dispatches 'choo-choo-error' and renders an inline error on a parser failure", async () => {
    const received: Error[] = [];
    element.addEventListener("choo-choo-error", (event) => {
      received.push((event as CustomEvent<{ error: Error }>).detail.error);
    });
    element.parser = ebnfParser;
    element.setAttribute("source", `a = @;`); // tokenizer error
    await flush();
    expect(received).toHaveLength(1);
    expect(element.querySelector(".choo-choo-error")).not.toBeNull();
    expect(element.querySelector("svg")).toBeNull();
  });
});

describe("<choo-choo> dynamic parser loading", () => {
  it("resolves @choo-choo/parser-ebnf via a dynamic import when grammar is set", async () => {
    const element = document.createElement("choo-choo") as ChooChooElement;
    element.setAttribute("grammar", "ebnf");
    element.setAttribute("source", `a = "dyn";`);
    document.body.append(element);
    // Dynamic imports in Vitest resolve across several macrotasks; wait longer.
    await flush(200);
    expect(element.querySelector("svg")).not.toBeNull();
    expect(element.innerHTML).toContain(">dyn</text>");
    element.remove();
  });

  it("surfaces 'choo-choo-error' when the grammar id is unknown", async () => {
    const element = document.createElement("choo-choo") as ChooChooElement;
    const received: Error[] = [];
    element.addEventListener("choo-choo-error", (event) => {
      received.push((event as CustomEvent<{ error: Error }>).detail.error);
    });
    element.setAttribute("grammar", "nonexistent-grammar-id");
    element.setAttribute("source", `a = "x";`);
    document.body.append(element);
    await flush(200);
    expect(received.length).toBeGreaterThan(0);
    expect(element.querySelector(".choo-choo-error")).not.toBeNull();
    element.remove();
  });
});
