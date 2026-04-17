import { describe, expect, it } from "vitest";
import { Reader } from "./reader.js";

describe("Reader", () => {
  it("reports end-of-input for an empty source", () => {
    const reader = new Reader("");
    expect(reader.isAtEnd()).toBe(true);
    expect(reader.rest()).toBe("");
    expect(reader.current()).toBe("");
    expect(reader.position).toEqual({ offset: 0, line: 1, column: 1 });
  });

  it("initial position is offset=0, line=1, column=1", () => {
    const reader = new Reader("abc");
    expect(reader.isAtEnd()).toBe(false);
    expect(reader.offset).toBe(0);
    expect(reader.line).toBe(1);
    expect(reader.column).toBe(1);
  });

  it("advance(1) moves one character forward on the same line", () => {
    const reader = new Reader("abc");
    reader.advance(1);
    expect(reader.offset).toBe(1);
    expect(reader.line).toBe(1);
    expect(reader.column).toBe(2);
    expect(reader.current()).toBe("b");
    expect(reader.rest()).toBe("bc");
  });

  it("advance(n) handles newlines — line increments, column resets to 1", () => {
    const reader = new Reader("ab\ncd");
    reader.advance(3); // past 'ab\n'
    expect(reader.offset).toBe(3);
    expect(reader.line).toBe(2);
    expect(reader.column).toBe(1);
    expect(reader.current()).toBe("c");
  });

  it("advance across multiple lines tracks lines and columns correctly", () => {
    const reader = new Reader("a\nb\nc");
    reader.advance(5);
    expect(reader.offset).toBe(5);
    expect(reader.line).toBe(3);
    expect(reader.column).toBe(2);
    expect(reader.isAtEnd()).toBe(true);
  });

  it("advance past end of input stops at end and does not throw", () => {
    const reader = new Reader("abc");
    reader.advance(100);
    expect(reader.offset).toBe(3);
    expect(reader.isAtEnd()).toBe(true);
    expect(reader.current()).toBe("");
  });

  it("position snapshots are independent of later advances", () => {
    const reader = new Reader("abcdef");
    reader.advance(2);
    const snapshot = reader.position;
    reader.advance(2);
    expect(snapshot).toEqual({ offset: 2, line: 1, column: 3 });
    expect(reader.position).toEqual({ offset: 4, line: 1, column: 5 });
  });
});
