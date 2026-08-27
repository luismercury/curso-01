import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import fs from "node:fs";

vi.mock("server-only", () => ({}));

const mockCreateVehiculo = vi.fn();
const mockFindVehiculoById = vi.fn();
const mockFindVehiculoByPatente = vi.fn();
const mockFindVehiculosByClienteId = vi.fn();

vi.mock("@/db/repositories/vehiculos", () => ({
  createVehiculo: (...args: unknown[]) => mockCreateVehiculo(...args),
  findVehiculoById: (...args: unknown[]) => mockFindVehiculoById(...args),
  findVehiculoByPatente: (...args: unknown[]) => mockFindVehiculoByPatente(...args),
  findVehiculosByClienteId: (...args: unknown[]) =>
    mockFindVehiculosByClienteId(...args),
}));

import {
  vehicleCreateInputSchema,
  createVehicle,
  listVehiclesByCustomer,
  getVehicleById,
  findVehicleByPlate,
} from "@/services/vehicleService";
import { VehiclePlateTakenError, VehicleCustomerNotFoundError } from "@/services/errors";
import { DomainError } from "@/lib/errors";
import { normalizePatente } from "@/db/validators/vehiculo";

const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID_2 = "550e8400-e29b-41d4-a716-446655440001";
const VEHICLE_ID = "660e8400-e29b-41d4-a716-446655440002";

const nowYear = new Date().getFullYear();

const validInput = {
  customerId: CUSTOMER_ID,
  brand: "Toyota",
  model: "Corolla",
  year: nowYear,
  plate: "ABC123",
};

function makeVehiculoDTO(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VEHICLE_ID,
    customerId: CUSTOMER_ID,
    brand: "Toyota",
    model: "Corolla",
    year: nowYear,
    plate: "ABC123",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("vehicleCreateInputSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates success with valid input", () => {
    const parsed = vehicleCreateInputSchema.parse(validInput);
    expect(parsed.customerId).toBe(CUSTOMER_ID);
    expect(parsed.brand).toBe("Toyota");
    expect(parsed.plate).toBe("ABC123");
  });

  it("trims brand and model", () => {
    const parsed = vehicleCreateInputSchema.parse({
      ...validInput,
      brand: "  Toyota  ",
      model: "  Corolla  ",
    });
    expect(parsed.brand).toBe("Toyota");
    expect(parsed.model).toBe("Corolla");
  });

  it("rejects brand length 1", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, brand: "A" })).toThrow(
      z.ZodError,
    );
  });

  it("rejects brand length 101", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, brand: "a".repeat(101) }),
    ).toThrow(z.ZodError);
  });

  it("rejects brand whitespace-only (trim to empty)", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, brand: "   " }),
    ).toThrow(z.ZodError);
  });

  it("accepts brand 2 chars boundary", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, brand: "AB" })).not.toThrow();
  });

  it("accepts brand 100 chars boundary", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, brand: "a".repeat(100) }),
    ).not.toThrow();
  });

  it("rejects model length 1", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, model: "M" })).toThrow(
      z.ZodError,
    );
  });

  it("rejects model length 101", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, model: "a".repeat(101) }),
    ).toThrow(z.ZodError);
  });

  it("rejects model whitespace-only", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, model: "   " }),
    ).toThrow(z.ZodError);
  });

  it("rejects year 1899", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, year: 1899 })).toThrow(
      z.ZodError,
    );
  });

  it("accepts year 1900 lower bound", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, year: 1900 })).not.toThrow();
  });

  it("accepts year now+1 dynamic upper bound", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, year: nowYear + 1 }),
    ).not.toThrow();
  });

  it("rejects year now+2", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, year: nowYear + 2 }),
    ).toThrow(z.ZodError);
  });

  it("rejects year non-integer", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, year: 2020.5 })).toThrow(
      z.ZodError,
    );
  });

  it("rejects customerId non-uuid", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, customerId: "not-a-uuid" }),
    ).toThrow(z.ZodError);
  });

  it("normalizes plate: ' abc-123 ' -> 'ABC123' valid (6 alphanumeric)", () => {
    const parsed = vehicleCreateInputSchema.parse({ ...validInput, plate: " abc-123 " });
    expect(parsed.plate).toBe("ABC123");
  });

  it("normalizes plate: 'ABC 123' -> 'ABC123' valid", () => {
    const parsed = vehicleCreateInputSchema.parse({ ...validInput, plate: "ABC 123" });
    expect(parsed.plate).toBe("ABC123");
  });

  it("normalizes plate: 'abc 1234' -> 'ABC1234' valid 7 chars", () => {
    const parsed = vehicleCreateInputSchema.parse({ ...validInput, plate: "abc 1234" });
    expect(parsed.plate).toBe("ABC1234");
  });

  it("rejects plate 'AB@123' invalid chars", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, plate: "AB@123" })).toThrow(
      z.ZodError,
    );
  });

  it("rejects plate 5 chars after normalization (too short)", () => {
    expect(() => vehicleCreateInputSchema.parse({ ...validInput, plate: "AB123" })).toThrow(
      z.ZodError,
    );
  });

  it("rejects plate 8 chars after normalization (too long)", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({ ...validInput, plate: "ABCDEFGH" }),
    ).toThrow(z.ZodError);
  });

  it("rejects strict unknown fields (clienteId spanish)", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({
        ...validInput,
        clienteId: CUSTOMER_ID,
      } as unknown as typeof validInput),
    ).toThrow(z.ZodError);
  });

  it("rejects strict extra field", () => {
    expect(() =>
      vehicleCreateInputSchema.parse({
        ...validInput,
        extra: "field",
      } as unknown as typeof validInput),
    ).toThrow(z.ZodError);
  });

  it("normalizePatente idempotent: normalizePatente('ABC123') === 'ABC123'", () => {
    expect(normalizePatente("ABC123")).toBe("ABC123");
    expect(normalizePatente(normalizePatente("ABC123"))).toBe("ABC123");
  });

  it("normalizePatente idempotent with spaces/hyphens", () => {
    expect(normalizePatente(" abc-123 ")).toBe("ABC123");
    expect(normalizePatente(normalizePatente(" abc-123 "))).toBe("ABC123");
  });

  it("plate normalization idempotent via schema pipe", () => {
    const first = vehicleCreateInputSchema.parse({ ...validInput, plate: "abc-123" });
    const second = vehicleCreateInputSchema.parse({ ...validInput, plate: first.plate });
    expect(second.plate).toBe("ABC123");
  });

  it("does not mutate vehiculoInputSchema — base still validates Spanish keys", async () => {
    const { vehiculoInputSchema } = await import("@/db/validators/vehiculo");
    const result = vehiculoInputSchema.parse({
      clienteId: CUSTOMER_ID,
      marca: "Toyota",
      modelo: "Corolla",
      anio: nowYear,
      patente: "ABC123",
    });
    expect(result.marca).toBe("Toyota");
    expect(result.patente).toBe("ABC123");
  });
});

describe("createVehicle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates before DB access — ZodError surfaces, createVehiculo not called", async () => {
    const invalidInput = { ...validInput, brand: "A" };
    await expect(createVehicle({} as never, invalidInput)).rejects.toThrow(z.ZodError);
    expect(mockCreateVehiculo).not.toHaveBeenCalled();
  });

  it("no DB call on VALIDATION_ERROR for plate invalid", async () => {
    await expect(
      createVehicle({} as never, { ...validInput, plate: "AB@123" }),
    ).rejects.toThrow(z.ZodError);
    expect(mockCreateVehiculo).not.toHaveBeenCalled();
  });

  it("no DB call on strict unknown field", async () => {
    await expect(
      createVehicle({} as never, {
        ...validInput,
        clienteId: CUSTOMER_ID,
      } as unknown as typeof validInput),
    ).rejects.toThrow(z.ZodError);
    expect(mockCreateVehiculo).not.toHaveBeenCalled();
  });

  it("delegates to createVehiculo with normalized plate and returns DTO", async () => {
    const dto = makeVehiculoDTO();
    mockCreateVehiculo.mockResolvedValue(dto);
    const mockDb = {} as never;

    const result = await createVehicle(mockDb, { ...validInput, plate: " abc-123 " });

    expect(mockCreateVehiculo).toHaveBeenCalledTimes(1);
    expect(mockCreateVehiculo).toHaveBeenCalledWith(mockDb, {
      customerId: CUSTOMER_ID,
      brand: "Toyota",
      model: "Corolla",
      year: nowYear,
      plate: "ABC123",
    });
    expect(result).toEqual(dto);
  });

  it("returns DTO with exactly 8 keys, no snake_case leak", async () => {
    const dto = makeVehiculoDTO();
    mockCreateVehiculo.mockResolvedValue(dto);
    const result = await createVehicle({} as never, validInput);

    expect(Object.keys(result).sort()).toEqual(
      ["brand", "createdAt", "customerId", "id", "model", "plate", "updatedAt", "year"].sort(),
    );
    expect(result).not.toHaveProperty("clienteId");
    expect(result).not.toHaveProperty("marca");
    expect(result).not.toHaveProperty("modelo");
    expect(result).not.toHaveProperty("anio");
    expect(result).not.toHaveProperty("patente");
    expect(result).not.toHaveProperty("created_at");
  });

  it("throws VehiclePlateTakenError with code PLATE_ALREADY_EXISTS on 23505", async () => {
    mockCreateVehiculo.mockRejectedValue({ code: "23505" });

    await expect(createVehicle({} as never, validInput)).rejects.toThrow(VehiclePlateTakenError);

    // fresh mock for code check
    mockCreateVehiculo.mockRejectedValue({ code: "23505" });
    await expect(createVehicle({} as never, validInput)).rejects.toMatchObject({
      code: "PLATE_ALREADY_EXISTS",
    });
  });

  it("throws VehicleCustomerNotFoundError with code CUSTOMER_NOT_FOUND on 23503", async () => {
    mockCreateVehiculo.mockRejectedValue({ code: "23503" });

    await expect(createVehicle({} as never, validInput)).rejects.toThrow(
      VehicleCustomerNotFoundError,
    );

    mockCreateVehiculo.mockRejectedValue({ code: "23503" });
    await expect(createVehicle({} as never, validInput)).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
    });
  });

  it("maps PG 23505 via cause chain (wrapped Drizzle error)", async () => {
    const wrapped = new Error("wrapped", { cause: { code: "23505" } });
    mockCreateVehiculo.mockRejectedValue(wrapped);

    await expect(createVehicle({} as never, validInput)).rejects.toBeInstanceOf(
      VehiclePlateTakenError,
    );
  });

  it("maps PG 23503 via cause chain", async () => {
    const wrapped = new Error("wrapped", { cause: { code: "23503" } });
    mockCreateVehiculo.mockRejectedValue(wrapped);

    await expect(createVehicle({} as never, validInput)).rejects.toBeInstanceOf(
      VehicleCustomerNotFoundError,
    );
  });

  it("preserves cause on mapped errors", async () => {
    const pgError = { code: "23505", message: "duplicate" };
    mockCreateVehiculo.mockRejectedValue(pgError);

    try {
      await createVehicle({} as never, validInput);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { cause?: unknown }).cause).toBeDefined();
    }
  });

  it("propagates non-mapped errors unchanged", async () => {
    const otherError = { code: "23514", message: "check violation" };
    mockCreateVehiculo.mockRejectedValue(otherError);

    await expect(createVehicle({} as never, validInput)).rejects.toEqual(otherError);
    // ensure not mis-mapped
    mockCreateVehiculo.mockRejectedValue(otherError);
    await expect(createVehicle({} as never, validInput)).rejects.not.toBeInstanceOf(
      VehiclePlateTakenError,
    );
    mockCreateVehiculo.mockRejectedValue(otherError);
    await expect(createVehicle({} as never, validInput)).rejects.not.toBeInstanceOf(
      VehicleCustomerNotFoundError,
    );
  });

  it("VehiclePlateTakenError extends DomainError with correct name/code", () => {
    const err = new VehiclePlateTakenError("ABC123");
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe("VehiclePlateTakenError");
    expect(err.code).toBe("PLATE_ALREADY_EXISTS");
    expect(err.plate).toBe("ABC123");
  });

  it("VehicleCustomerNotFoundError extends DomainError with correct name/code", () => {
    const err = new VehicleCustomerNotFoundError(CUSTOMER_ID);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe("VehicleCustomerNotFoundError");
    expect(err.code).toBe("CUSTOMER_NOT_FOUND");
    expect(err.customerId).toBe(CUSTOMER_ID);
  });

  it("does not import requireAuth", () => {
    const content = fs.readFileSync("src/services/vehicleService.ts", "utf8");
    expect(content).not.toMatch(/requireAuth/);
  });

  it("imports server-only", () => {
    const content = fs.readFileSync("src/services/vehicleService.ts", "utf8");
    expect(content).toMatch(/import\s+["']server-only["']/);
  });

  it("plate normalization preserves year/customerId after parse", async () => {
    const dto = makeVehiculoDTO({ plate: "ABC123" });
    mockCreateVehiculo.mockResolvedValue(dto);
    const result = await createVehicle({} as never, {
      customerId: CUSTOMER_ID,
      brand: "Ford",
      model: "Fiesta",
      year: 2020,
      plate: "abc-123",
    });
    expect(result.plate).toBe("ABC123");
    expect(result.year).toBe(nowYear); // dto year unchanged? dto is nowYear but input was 2020 -> mock returns nowYear, ensure delegate got normalized
    expect(mockCreateVehiculo).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ plate: "ABC123", year: 2020 }));
  });
});

describe("read helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listVehiclesByCustomer returns 2 DTOs for customer A", async () => {
    const dto1 = makeVehiculoDTO({ id: "id-1", customerId: CUSTOMER_ID });
    const dto2 = makeVehiculoDTO({ id: "id-2", customerId: CUSTOMER_ID });
    mockFindVehiculosByClienteId.mockResolvedValue([dto1, dto2]);

    const result = await listVehiclesByCustomer({} as never, CUSTOMER_ID);

    expect(mockFindVehiculosByClienteId).toHaveBeenCalledWith(expect.anything(), CUSTOMER_ID);
    expect(result).toEqual([dto1, dto2]);
    expect(result).toHaveLength(2);
  });

  it("listVehiclesByCustomer returns 1 DTO for customer B", async () => {
    const dto = makeVehiculoDTO({ id: "id-3", customerId: CUSTOMER_ID_2 });
    mockFindVehiculosByClienteId.mockResolvedValue([dto]);

    const result = await listVehiclesByCustomer({} as never, CUSTOMER_ID_2);

    expect(result).toHaveLength(1);
    expect(result[0]?.customerId).toBe(CUSTOMER_ID_2);
  });

  it("listVehiclesByCustomer returns [] when no vehicles", async () => {
    mockFindVehiculosByClienteId.mockResolvedValue([]);

    const result = await listVehiclesByCustomer({} as never, CUSTOMER_ID);

    expect(result).toEqual([]);
  });

  it("getVehicleById returns DTO when found", async () => {
    const dto = makeVehiculoDTO({ id: VEHICLE_ID });
    mockFindVehiculoById.mockResolvedValue(dto);

    const result = await getVehicleById({} as never, VEHICLE_ID);

    expect(mockFindVehiculoById).toHaveBeenCalledWith(expect.anything(), VEHICLE_ID);
    expect(result).toEqual(dto);
  });

  it("getVehicleById returns null when not found", async () => {
    mockFindVehiculoById.mockResolvedValue(null);

    const result = await getVehicleById({} as never, "00000000-0000-4000-a000-000000000099");

    expect(result).toBeNull();
  });

  it("findVehicleByPlate normalizes arg 'abc-123' -> 'ABC123' and delegates", async () => {
    const dto = makeVehiculoDTO({ plate: "ABC123" });
    mockFindVehiculoByPatente.mockResolvedValue(dto);

    const result = await findVehicleByPlate({} as never, "abc-123");

    expect(mockFindVehiculoByPatente).toHaveBeenCalledTimes(1);
    // service normalizes before calling repo; repo also normalizes
    const calledPlate = mockFindVehiculoByPatente.mock.calls[0]?.[1];
    expect(calledPlate).toBe("ABC123");
    expect(result).toEqual(dto);
  });

  it("findVehicleByPlate normalizes 'ABC 123' -> 'ABC123'", async () => {
    const dto = makeVehiculoDTO({ plate: "ABC123" });
    mockFindVehiculoByPatente.mockResolvedValue(dto);

    await findVehicleByPlate({} as never, "ABC 123");

    expect(mockFindVehiculoByPatente).toHaveBeenCalledWith(expect.anything(), "ABC123");
  });

  it("findVehicleByPlate returns null when not found", async () => {
    mockFindVehiculoByPatente.mockResolvedValue(null);

    const result = await findVehicleByPlate({} as never, "ZZZ999");

    expect(result).toBeNull();
  });

  it("read helpers return DTOs with no snake_case leak", async () => {
    const dto = makeVehiculoDTO();
    mockFindVehiculoById.mockResolvedValue(dto);
    const result = await getVehicleById({} as never, VEHICLE_ID);
    expect(Object.keys(result as object).sort()).toEqual(
      ["brand", "createdAt", "customerId", "id", "model", "plate", "updatedAt", "year"].sort(),
    );
  });
});
