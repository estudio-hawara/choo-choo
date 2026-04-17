import {
  type Diagram,
  type GrammarParser,
  type RenderOptions,
  render,
} from "@choo-choo/core";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class ChooChooElement extends HTMLElement {
  static observedAttributes = ["source", "grammar", "rule"];
  static parserCache = new Map<string, Promise<GrammarParser>>();

  #ir: Diagram | undefined;
  #parser: GrammarParser | undefined;
  #options: RenderOptions | undefined;
  #capturedSource: string | undefined;
  #pendingRender = false;

  connectedCallback(): void {
    const text = (this.textContent ?? "").trim();
    if (text !== "") {
      this.#capturedSource = text;
    }
    this.#scheduleRender();
  }

  disconnectedCallback(): void {
    this.innerHTML = "";
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.#scheduleRender();
    }
  }

  get ir(): Diagram | undefined {
    return this.#ir;
  }
  set ir(value: Diagram | undefined) {
    this.#ir = value;
    if (this.isConnected) this.#scheduleRender();
  }

  get parser(): GrammarParser | undefined {
    return this.#parser;
  }
  set parser(value: GrammarParser | undefined) {
    this.#parser = value;
    if (this.isConnected) this.#scheduleRender();
  }

  get options(): RenderOptions | undefined {
    return this.#options;
  }
  set options(value: RenderOptions | undefined) {
    this.#options = value;
    if (this.isConnected) this.#scheduleRender();
  }

  #scheduleRender(): void {
    if (this.#pendingRender) return;
    this.#pendingRender = true;
    queueMicrotask(() => {
      this.#pendingRender = false;
      void this.#performRender();
    });
  }

  async #performRender(): Promise<void> {
    try {
      if (this.#ir) {
        this.#renderDiagram(this.#ir);
        return;
      }

      const sourceAttribute = this.getAttribute("source");
      const source =
        sourceAttribute !== null && sourceAttribute !== ""
          ? sourceAttribute
          : this.#capturedSource;

      if (!source) {
        this.innerHTML = "";
        return;
      }

      let parser = this.#parser;
      if (!parser) {
        const grammarId = this.getAttribute("grammar");
        if (!grammarId) {
          this.innerHTML = "";
          return;
        }
        parser = await ChooChooElement.loadParser(grammarId);
      }

      const parsed = parser.parse(source);
      const ruleName = this.getAttribute("rule");
      const rule = ruleName
        ? parsed.rules.find((candidate) => candidate.name === ruleName)
        : parsed.rules[0];
      if (!rule) {
        throw new Error(
          ruleName
            ? `<choo-choo>: rule "${ruleName}" not found in parsed grammar`
            : "<choo-choo>: parsed grammar has no rules",
        );
      }

      this.#renderDiagram(rule.diagram);
    } catch (error) {
      this.#handleError(error);
    }
  }

  #renderDiagram(diagram: Diagram): void {
    const svg = render(diagram, this.#options);
    this.innerHTML = svg;
    this.dispatchEvent(
      new CustomEvent("choo-choo-render", {
        detail: { svg },
        bubbles: true,
      }),
    );
  }

  #handleError(error: unknown): void {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    this.innerHTML = `<pre class="choo-choo-error">${escapeHtml(wrapped.message)}</pre>`;
    this.dispatchEvent(
      new CustomEvent("choo-choo-error", {
        detail: { error: wrapped },
        bubbles: true,
      }),
    );
  }

  static async loadParser(id: string): Promise<GrammarParser> {
    let cached = ChooChooElement.parserCache.get(id);
    if (!cached) {
      cached = (async () => {
        const module = (await import(
          /* @vite-ignore */ `@choo-choo/parser-${id}`
        )) as Record<string, unknown>;
        const exported = module[`${id}Parser`] ?? module.default;
        if (
          !exported ||
          typeof exported !== "object" ||
          typeof (exported as GrammarParser).parse !== "function"
        ) {
          throw new Error(
            `@choo-choo/parser-${id} must export "${id}Parser" or a default GrammarParser`,
          );
        }
        return exported as GrammarParser;
      })();
      ChooChooElement.parserCache.set(id, cached);
    }
    return cached;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("choo-choo")) {
  customElements.define("choo-choo", ChooChooElement);
}
