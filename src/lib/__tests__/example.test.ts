import { describe, expect, it } from "vitest";
import { sum } from "@/lib/example";

describe("sum", () => {
  it("adds two numbers", () => {
    expect(sum(1, 1)).toBe(2);
  });
});
