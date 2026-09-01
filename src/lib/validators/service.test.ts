/**
 * Pure Zod validator + helper tests for `src/lib/validators/service.ts`.
 * Coverage: formatDuration (45/60/75/90/120/180) + serviceIdSchema + ApiError.
 */
import { describe, expect, it } from "vitest";
import {
  ApiError,
  formatDuration,
  serviceIdSchema,
  type ApiErrorBody,
} from "@/lib/validators/service";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("formatDuration (REQ-SVC-01)", () => {
  it.each([
    [45, "45 min"],
    [60, "60 min"],
    [75, "1 h 15 min"],
    [90, "1 h 30 min"],
    [120, "2 h"],
    [180, "3 h"],
  ] as const)("%i -> '%s'", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it("non-finite / negative inputs render '0 min' (no NaN)", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(-5)).toBe("0 min");
    expect(formatDuration(Number.NaN)).toBe("0 min");
  });
});

describe("serviceIdSchema — ?serviceId= UUID guard (REQ-SVC-02)", () => {
  it("accepts a valid UUID", () => {
    const r = serviceIdSchema.safeParse(VALID_UUID);
    expect(r.success).toBe(true);
  });

  it.each([
    ["garbage"],
    [""],
    ["not-uuid"],
    ["550e8400e29b41d4a716446655440000"], // no dashes
  ])("rejects %s", (input) => {
    expect(serviceIdSchema.safeParse(input).success).toBe(false);
  });

  it("never throws — caller MUST safeParse", () => {
    expect(() => serviceIdSchema.safeParse(undefined)).not.toThrow();
    expect(() => serviceIdSchema.safeParse(null)).not.toThrow();
  });
});

describe("ApiError (client-safe mirror of lib/http/errors)", () => {
  it("carries code, status, message, issues; name === 'ApiError'; instanceof Error", () => {
    const issues: ApiErrorBody["error"]["issues"] = [{ path: ["name"], message: "dup" }];
    const err = new ApiError({ code: "SERVICE_ALREADY_EXISTS", message: "dup", status: 409, issues });
    expect(err.code).toBe("SERVICE_ALREADY_EXISTS");
    expect(err.status).toBe(409);
    expect(err.message).toBe("dup");
    expect(err.issues).toEqual(issues);
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });

  it("issues is optional", () => {
    const err = new ApiError({ code: "UNAUTHORIZED", message: "Missing token", status: 401 });
    expect(err.issues).toBeUndefined();
  });
});