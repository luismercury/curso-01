import { describe, expect, it } from "vitest";

// Production module under test (does not exist yet — RED).
import { hasPgCode } from "@/lib/errors";

/**
 * Drizzle wraps driver errors in DrizzleQueryError keeping the original pg
 * error on `cause`. hasPgCode walks the cause chain so repositories can
 * translate infrastructure errors without importing driver types.
 */
describe("hasPgCode cause-chain walker (D4)", () => {
  it("finds the code directly on the error object", () => {
    const error = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(hasPgCode(error, "23505")).toBe(true);
  });

  it("finds the code one level deep on `cause` (DrizzleQueryError wrap)", () => {
    const cause = Object.assign(new Error("duplicate key"), { code: "23505" });
    const wrapped = new Error("Query failed", { cause });
    expect(hasPgCode(wrapped, "23505")).toBe(true);
  });

  it("finds the code multiple levels down the chain", () => {
    const leaf = Object.assign(new Error("fk violation"), { code: "23503" });
    const middle = new Error("driver layer", { cause: leaf });
    const top = new Error("query wrapper", { cause: middle });
    expect(hasPgCode(top, "23503")).toBe(true);
  });

  it("returns false when the code does not match or the chain ends", () => {
    expect(hasPgCode(new Error("plain"), "23505")).toBe(false);
    const other = Object.assign(new Error("other"), { code: "42P01" });
    expect(hasPgCode(other, "23505")).toBe(false);
    expect(hasPgCode(undefined, "23505")).toBe(false);
  });
});
