import type { Node } from "../ir.js";
import type { ResolvedOptions } from "./options.js";

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sourceAttributes(node: Node, options: ResolvedOptions): string {
  if (!options.emitSourceData || !node.source) return "";
  const range = node.source;
  return (
    ` data-source-offset-start="${range.start.offset}"` +
    ` data-source-offset-end="${range.end.offset}"` +
    ` data-source-line-start="${range.start.line}"` +
    ` data-source-line-end="${range.end.line}"` +
    ` data-source-column-start="${range.start.column}"` +
    ` data-source-column-end="${range.end.column}"`
  );
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
