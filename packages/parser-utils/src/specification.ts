export interface TokenRule<T extends string> {
  readonly pattern: RegExp;
  readonly type: T | null;
}

export interface SpecificationMatch<T extends string> {
  readonly type: T | null;
  readonly value: string;
}

export class Specification<T extends string> {
  private readonly _rules: TokenRule<T>[] = [];

  add(pattern: RegExp, type: T | null): this {
    if (!pattern.source.startsWith("^")) {
      throw new Error(
        `Specification.add: pattern must be anchored with ^, got /${pattern.source}/`,
      );
    }
    this._rules.push({ pattern, type });
    return this;
  }

  get rules(): readonly TokenRule<T>[] {
    return this._rules;
  }

  match(input: string): SpecificationMatch<T> | null {
    for (const rule of this._rules) {
      const result = rule.pattern.exec(input);
      if (result !== null) {
        return { type: rule.type, value: result[0] };
      }
    }
    return null;
  }
}
