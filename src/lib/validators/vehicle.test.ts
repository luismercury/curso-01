/**
 * Pure Zod validator tests for `src/lib/validators/vehicle.ts`.
 * Mirror of `vehicleService.test.ts` for the client-safe surface.
 *
 * Coverage:
 *  - normalizePatente: idempotent trim/upper/strip space+dash
 *  - plate: 6-7 alnum after normalize; reject invalid chars / short / long
 *  - brand/model: trim; reject <2 / >100; whitespace-only collapses to empty
 *  - year: int; 1900..maxYear (now+1)
 *  - strict: rejects unknown keys (no Spanish snake_case leak)
 *  - ApiError: code+status+issues constructor
 */
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  ApiError,
  MAX_BRAND,
  MAX_MODEL,
  MIN_YEAR,
  maxYear,
  normalizePatente,
  vehicleCreateInputSchema,
  type ApiErrorBody,
} from "@/lib/validators/vehicle";

const nowYear = new Date().getFullYear();

const validInput = () => ({
  brand: "Toyota",
  model: "Corolla",
  year: nowYear,
  plate: "ABC123",
});

describe("normalizePatente (REQ-VEH-02)", () => {
  it("'abc-123' -> 'ABC123'", () => {
    expect(normalizePatente("abc-123")).toBe("ABC123");
  });

  it("trim + uppercase + strip space and dash", () => {
    expect(normalizePatente(" abc-123 ")).toBe("ABC123");
    expect(normalizePatente("ABC 123")).toBe("ABC123");
  });

  it("idempotent", () => {
    const first = normalizePatente("abc-123");
    expect(normalizePatente(first)).toBe(first);
  });
});

describe("vehicleCreateInputSchema — plate (REQ-VEH-02)", () => {
  it("accepts 6 alnum after normalize", () => {
    expect(vehicleCreateInputSchema.parse({ ...validInput(), plate: "ABC123" }).plate).toBe("ABC123");
  });

  it("accepts 7 alnum after normalize", () => {
    expect(vehicleCreateInputSchema.parse({ ...validInput(), plate: "ABC1234" }).plate).toBe("ABC1234");
  });

  it("rejects 'AB1' (5 chars, too short)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), plate: "AB1" })).toThrow(ZodError);
  });

  it("rejects 'AB!@#' (invalid chars, 5 chars after strip)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), plate: "AB!@#" })).toThrow(ZodError);
  });

  it("rejects 8 chars after normalize (too long)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), plate: "ABCDEFGH" })).toThrow(ZodError);
  });
});

describe("vehicleCreateInputSchema — brand/model (REQ-VEH-02)", () => {
  it("trims model whitespace", () => {
    const parsed = vehicleCreateInputSchema.parse({ ...validInput(), model: "  Corolla  " });
    expect(parsed.model).toBe("Corolla");
  });

  it("rejects brand 'a' (single char)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), brand: "a" })).toThrow(ZodError);
  });

  it("rejects brand length >MAX_BRAND", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput(), brand: "x".repeat(MAX_BRAND + 1) }),
    ).toThrow(ZodError);
  });

  it("rejects model whitespace-only (trim -> empty -> below min)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), model: "   " })).toThrow(ZodError);
  });
});

describe("vehicleCreateInputSchema — year (REQ-VEH-02)", () => {
  it("rejects year 1800 (below MIN_YEAR)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), year: 1800 })).toThrow(ZodError);
  });

  it("accepts MIN_YEAR (1900) boundary", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), year: MIN_YEAR })).not.toThrow();
  });

  it("rejects year > maxYear() (now+1)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), year: maxYear() + 1 })).toThrow(ZodError);
  });

  it("rejects year non-integer (2020.5)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput(), year: 2020.5 })).toThrow(ZodError);
  });
});

describe("vehicleCreateInputSchema — strict (INV-08)", () => {
  it("rejects snake_case keys (marca, cliente_id)", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({
        ...validInput(),
        marca: "Toyota",
        cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      } as unknown as ReturnType<typeof validInput>),
    ).toThrow(ZodError);
  });

  it("rejects extra unknown field", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput(), extra: "field" } as unknown as ReturnType<typeof validInput>),
    ).toThrow(ZodError);
  });
});

describe("ApiError (client-safe mirror of lib/http/errors)", () => {
  it("carries code, status, message, issues", () => {
    const issues: ApiErrorBody["error"]["issues"] = [{ path: ["plate"], message: "Plate already exists" }];
    const err = new ApiError({ code: "PLATE_ALREADY_EXISTS", message: "dup", status: 409, issues });
    expect(err.code).toBe("PLATE_ALREADY_EXISTS");
    expect(err.status).toBe(409);
    expect(err.message).toBe("dup");
    expect(err.issues).toEqual(issues);
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});