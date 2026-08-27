import { describe, expect, it } from "vitest";

// Production module under test (does not exist yet — RED).
import { hasPgCode } from "@/lib/errors";

/**
 * Drizzle wraps driver errors in DrizzleQueryError keeping the original pg
 * error on `cause`. hasPgCode walks the cause chain so repositories can
 * translate infrastructure errors without importing driver types.
 */
describe("t009 hasPgCode distinct mapping — 23514 vs 23P01 (RED)", () => {
  it("distinguishes 23514 CHECK violation from 23P01 EXCLUDE violation via hasPgCode and file-content mapping", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const checkErr = Object.assign(new Error("check_violation"), { code: "23514" });
    const excludeErr = Object.assign(new Error("exclusion_violation"), { code: "23P01" });
    expect(hasPgCode(checkErr, "23514")).toBe(true);
    expect(hasPgCode(checkErr, "23P01")).toBe(false);
    expect(hasPgCode(excludeErr, "23P01")).toBe(true);
    expect(hasPgCode(excludeErr, "23514")).toBe(false);
    const wrappedCheck = new Error("wrapped", { cause: checkErr });
    const wrappedExclude = new Error("wrapped", { cause: excludeErr });
    expect(hasPgCode(wrappedCheck, "23514")).toBe(true);
    expect(hasPgCode(wrappedExclude, "23P01")).toBe(true);
    expect(hasPgCode(wrappedCheck, "23P01")).toBe(false);
    // File-content dual source: errors.ts must document/map both codes distinctly
    // This assertion FAILS before GREEN because errors.ts has no mention of 23514/23P01
    const source = readFileSync(resolve("src/lib/errors.ts"), "utf8");
    expect(source).toMatch(/23514/);
    expect(source).toMatch(/23P01/);
    expect(source).toMatch(/23503/);
  });
});

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
