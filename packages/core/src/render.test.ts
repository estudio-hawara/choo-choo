import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  choice,
  comment,
  diagram,
  end,
  group,
  nonTerminal,
  oneOrMore,
  optional,
  sequence,
  skip,
  special,
  start,
  terminal,
  zeroOrMore,
} from "./builder.js";
import type { Node } from "./ir.js";
import { render } from "./render.js";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("render / contract", () => {
  it("returns a self-contained <svg> with the expected root attributes", () => {
    const out = render(diagram(terminal("x")));
    expect(out.startsWith("<svg ")).toBe(true);
    expect(out.endsWith("</svg>")).toBe(true);
    expect(out).toContain(`xmlns="http://www.w3.org/2000/svg"`);
    expect(out).toContain(`class="choo-choo"`);
    expect(out).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(out).toMatch(/width="\d+"/);
    expect(out).toMatch(/height="\d+"/);
  });

  it("is deterministic — same IR yields the same SVG", () => {
    const ir = diagram(sequence(terminal("a"), terminal("b")));
    expect(render(ir)).toBe(render(ir));
  });

  it("throws a TypeError when the root is not a Diagram", () => {
    expect(() => render(null as unknown as Parameters<typeof render>[0])).toThrow(TypeError);
    expect(() => render(terminal("x") as unknown as Parameters<typeof render>[0])).toThrow(
      /root must be a Diagram/,
    );
  });
});

describe("render / per-kind snapshots", () => {
  it("terminal", () => {
    expect(render(diagram(terminal("if")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 96 42" width="96" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="terminal"><rect x="0" y="-11" width="36" height="22" rx="10" ry="10"/><text x="18" y="5" text-anchor="middle">if</text></g></g><g transform="translate(66 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("nonterminal", () => {
    expect(render(diagram(nonTerminal("expression")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 160 42" width="160" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="non-terminal"><rect x="0" y="-11" width="100" height="22"/><text x="50" y="5" text-anchor="middle">expression</text></g></g><g transform="translate(130 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("special", () => {
    expect(render(diagram(special("?regex?")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 136 42" width="136" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="special"><path d="M0 0 L5 -11 H71 L76 0 L71 11 H5 Z"/><text x="38" y="5" text-anchor="middle">?regex?</text></g></g><g transform="translate(106 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("comment", () => {
    expect(render(diagram(comment("note")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 102 42" width="102" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="comment"><path d="M0 0 h42"/><text x="21" y="5" text-anchor="middle" class="comment-text">note</text></g></g><g transform="translate(72 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("skip (inside an optional)", () => {
    // skip is only meaningful inside a branching parent; wrap it in a choice.
    expect(render(diagram(choice(skip(), terminal("x"))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 61" width="128" height="61"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="choice"><path d="M0 0 h20"/><g transform="translate(20 0)"><g class="skip"></g></g><path d="M20 0 h48"/><path d="M0 0 a10 10 0 0 1 10 10 v-1 a10 10 0 0 0 10 10"/><g transform="translate(20 19)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><path d="M48 19 a10 10 0 0 0 10 -10 v1 a10 10 0 0 1 10 -10"/></g></g><g transform="translate(98 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("sequence", () => {
    expect(
      render(diagram(sequence(terminal("a"), terminal("b"), terminal("c")))),
    ).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 164 42" width="164" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="sequence"><g transform="translate(0 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">a</text></g></g><path d="M28 0 h10"/><g transform="translate(38 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">b</text></g></g><path d="M66 0 h10"/><g transform="translate(76 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">c</text></g></g></g></g><g transform="translate(134 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("choice (default normal)", () => {
    expect(
      render(diagram(choice(terminal("a"), terminal("b"), terminal("c")))),
    ).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 102" width="128" height="102"><g class="diagram"><g transform="translate(10 51)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 51)"><g class="choice"><path d="M0 0 a10 10 0 0 0 10 -10 v-10 a10 10 0 0 1 10 -10"/><g transform="translate(20 -30)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">a</text></g></g><path d="M48 -30 a10 10 0 0 1 10 10 v10 a10 10 0 0 0 10 10"/><path d="M0 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">b</text></g></g><path d="M48 0 h20"/><path d="M0 0 a10 10 0 0 1 10 10 v10 a10 10 0 0 0 10 10"/><g transform="translate(20 30)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">c</text></g></g><path d="M48 30 a10 10 0 0 0 10 -10 v-10 a10 10 0 0 1 10 -10"/></g></g><g transform="translate(98 51)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("choice (explicit normal)", () => {
    expect(
      render(diagram(choice({ normal: 0 }, terminal("a"), terminal("b"), terminal("c")))),
    ).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 102" width="128" height="102"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="choice"><path d="M0 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">a</text></g></g><path d="M48 0 h20"/><path d="M0 0 a10 10 0 0 1 10 10 v10 a10 10 0 0 0 10 10"/><g transform="translate(20 30)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">b</text></g></g><path d="M48 30 a10 10 0 0 0 10 -10 v-10 a10 10 0 0 1 10 -10"/><path d="M0 0 a10 10 0 0 1 10 10 v40 a10 10 0 0 0 10 10"/><g transform="translate(20 60)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">c</text></g></g><path d="M48 60 a10 10 0 0 0 10 -10 v-40 a10 10 0 0 1 10 -10"/></g></g><g transform="translate(98 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("optional (default skip=top)", () => {
    expect(render(diagram(optional(terminal("x"))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 70" width="128" height="70"><g class="diagram"><g transform="translate(10 49)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 49)"><g class="optional"><path d="M0 0 h20"/><path d="M48 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><path d="M0 0 a10 10 0 0 0 10 -10 v-9 a10 10 0 0 1 10 -10 H48 a10 10 0 0 1 10 10 v9 a10 10 0 0 0 10 10"/></g></g><g transform="translate(98 49)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("optional (skip=bottom)", () => {
    expect(render(diagram(optional(terminal("x"), "bottom")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 70" width="128" height="70"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="optional"><path d="M0 0 h20"/><path d="M48 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><path d="M0 0 a10 10 0 0 1 10 10 v9 a10 10 0 0 0 10 10 H48 a10 10 0 0 0 10 -10 v-9 a10 10 0 0 1 10 -10"/></g></g><g transform="translate(98 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("oneOrMore (no separator)", () => {
    expect(render(diagram(oneOrMore(terminal("x"))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 128 70" width="128" height="70"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="repetition"><path d="M0 0 h20"/><path d="M48 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><path d="M48 0 a10 10 0 0 1 10 10 v9 a10 10 0 0 1 -10 10 H20 a10 10 0 0 1 -10 -10 v-9 a10 10 0 0 1 10 -10"/></g></g><g transform="translate(98 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("oneOrMore (with separator)", () => {
    expect(render(diagram(oneOrMore(nonTerminal("arg"), terminal(","))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 144 92" width="144" height="92"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 21)"><g class="repetition"><path d="M0 0 h20"/><path d="M64 0 h20"/><g transform="translate(20 0)"><g class="non-terminal"><rect x="0" y="-11" width="44" height="22"/><text x="22" y="5" text-anchor="middle">arg</text></g></g><path d="M64 0 a10 10 0 0 1 10 10 v9 a10 10 0 0 1 -10 10 H20 a10 10 0 0 1 -10 -10 v-9 a10 10 0 0 1 10 -10"/><g transform="translate(28 29)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">,</text></g></g></g></g><g transform="translate(114 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("zeroOrMore", () => {
    expect(render(diagram(zeroOrMore(terminal("x"))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 168 98" width="168" height="98"><g class="diagram"><g transform="translate(10 49)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 49)"><g class="optional"><path d="M0 0 h20"/><path d="M88 0 h20"/><g transform="translate(20 0)"><g class="repetition"><path d="M0 0 h20"/><path d="M48 0 h20"/><g transform="translate(20 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><path d="M48 0 a10 10 0 0 1 10 10 v9 a10 10 0 0 1 -10 10 H20 a10 10 0 0 1 -10 -10 v-9 a10 10 0 0 1 10 -10"/></g></g><path d="M0 0 a10 10 0 0 0 10 -10 v-9 a10 10 0 0 1 10 -10 H88 a10 10 0 0 1 10 10 v9 a10 10 0 0 0 10 10"/></g></g><g transform="translate(138 49)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("group (no label)", () => {
    expect(render(diagram(group(terminal("x"))))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 108 50" width="108" height="50"><g class="diagram"><g transform="translate(10 25)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 25)"><g class="group"><rect x="0" y="-15" width="48" height="30" class="group-box"/><path d="M0 0 h10 M38 0 h10"/><g transform="translate(10 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g></g></g><g transform="translate(78 25)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("group (with label)", () => {
    expect(render(diagram(group(terminal("x"), "hint")))).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 108 64" width="108" height="64"><g class="diagram"><g transform="translate(10 39)"><g class="start"><path d="M0 -10 v20"/><path d="M0 0 h20"/></g></g><g transform="translate(30 39)"><g class="group"><rect x="0" y="-15" width="48" height="30" class="group-box"/><text x="10" y="-19" class="group-label">hint</text><path d="M0 0 h10 M38 0 h10"/><g transform="translate(10 0)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g></g></g><g transform="translate(78 39)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/></g></g></g></svg>"`,
    );
  });

  it("start + end complex variant with label", () => {
    expect(
      render(
        diagram(terminal("x"), {
          start: start("complex", "rule"),
          end: end("complex"),
        }),
      ),
    ).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" class="choo-choo" viewBox="0 0 88 42" width="88" height="42"><g class="diagram"><g transform="translate(10 21)"><g class="start"><path d="M0 -10 v20"/><path d="M5 -10 v20"/><path d="M0 0 h20"/><text x="0" y="-15" class="diagram-label">rule</text></g></g><g transform="translate(30 21)"><g class="terminal"><rect x="0" y="-11" width="28" height="22" rx="10" ry="10"/><text x="14" y="5" text-anchor="middle">x</text></g></g><g transform="translate(58 21)"><g class="end"><path d="M0 0 h20"/><path d="M20 -10 v20"/><path d="M15 -10 v20"/></g></g></g></svg>"`,
    );
  });
});

describe("render / emitSourceData", () => {
  const ranged: Node = {
    kind: "terminal",
    text: "x",
    source: {
      start: { offset: 4, line: 2, column: 3 },
      end: { offset: 5, line: 2, column: 4 },
    },
  };

  it("emits data-source-* attributes when the flag is on", () => {
    const out = render(diagram(ranged), { emitSourceData: true });
    expect(out).toContain(`data-source-offset-start="4"`);
    expect(out).toContain(`data-source-offset-end="5"`);
    expect(out).toContain(`data-source-line-start="2"`);
    expect(out).toContain(`data-source-line-end="2"`);
    expect(out).toContain(`data-source-column-start="3"`);
    expect(out).toContain(`data-source-column-end="4"`);
  });

  it("omits data-source-* attributes when the flag is off (default)", () => {
    const out = render(diagram(ranged));
    expect(out).not.toContain("data-source-");
  });

  it("omits attributes for nodes without a source range even under the flag", () => {
    const out = render(diagram(terminal("no-source")), { emitSourceData: true });
    expect(out).not.toContain("data-source-");
  });
});

describe("render / realistic productions", () => {
  it("renders identifier `=` expression", () => {
    const out = render(
      diagram(sequence(nonTerminal("identifier"), terminal("="), nonTerminal("expression"))),
    );
    expect(out).toContain(`class="non-terminal"`);
    expect(out).toContain(">identifier</text>");
    expect(out).toContain(">=</text>");
    expect(out).toContain(">expression</text>");
  });

  it("renders a function call with optional comma-separated arguments", () => {
    const out = render(
      diagram(
        sequence(
          nonTerminal("identifier"),
          terminal("("),
          optional(oneOrMore(nonTerminal("argument"), terminal(","))),
          terminal(")"),
        ),
      ),
    );
    expect(out).toContain(`class="optional"`);
    expect(out).toContain(`class="repetition"`);
    expect(out).toContain(">argument</text>");
  });
});
