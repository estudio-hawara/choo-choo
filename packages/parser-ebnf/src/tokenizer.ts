import { Reader, Specification, Tokenizer } from "@choo-choo/parser-utils";

export type EbnfTokenType =
  | "="
  | "("
  | ")"
  | "{"
  | "}"
  | "["
  | "]"
  | "|"
  | ","
  | ";"
  | "special"
  | "terminal"
  | "identifier";

export const ebnfSpecification = new Specification<EbnfTokenType>()
  .add(/^\s+/, null)
  .add(/^\(\*[\s\S]*?\*\)/, null)
  .add(/^=/, "=")
  .add(/^\(/, "(")
  .add(/^\)/, ")")
  .add(/^\{/, "{")
  .add(/^\}/, "}")
  .add(/^\[/, "[")
  .add(/^\]/, "]")
  .add(/^\|/, "|")
  .add(/^,/, ",")
  .add(/^;/, ";")
  .add(/^\?[^?]+\?/, "special")
  .add(/^"[^"]+"/, "terminal")
  .add(/^'[^']+'/, "terminal")
  .add(/^[A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9]/, "identifier")
  .add(/^[A-Za-z]/, "identifier");

export function createEbnfTokenizer(source: string): Tokenizer<EbnfTokenType> {
  return new Tokenizer(new Reader(source), ebnfSpecification);
}
