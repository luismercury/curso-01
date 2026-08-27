import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import fs from "node:fs";

vi.mock("server-only", () => ({}));

const mockListServicios = vi.fn();
const mockFindServicioById = vi.fn();
const mockCreateServicio = vi.fn();
const mockUpdateServicio = vi.fn();

vi.mock("@/db/repositories/servicios", () => ({
  listServicios: (...args: unknown[]) => mockListServicios(...args),
  findServicioById: (...args: unknown[]) => mockFindServicioById(...args),
  createServicio: (...args: unknown[]) => mockCreateServicio(...args),
  updateServicio: (...args: unknown[]) => mockUpdateServicio(...args),
  ServicioNombreTakenError: class ServicioNombreTakenError extends Error {
    code = "SERVICE_ALREADY_EXISTS";
    nombre: string;
    constructor(nombre: string) {
      super(`A servicio with nombre "${nombre}" already exists`);
      this.name = "ServicioNombreTakenError";
      this.nombre = nombre;
    }
  },
}));

import {
  listServices,
  getServiceById,
  getServiceDuration,
  createService,
  updateServiceActive,
} from "@/services/servicioService";
import { ServiceNotFoundError } from "@/services/errors";
import { DomainError } from "@/lib/errors";

const SERVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const SERVICE_ID_2 = "550e8400-e29b-41d4-a716-446655440001";
const UNKNOWN_ID = "660e8400-e29b-41d4-a716-446655440099";

function makeServicioDTO(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SERVICE_ID,
    name: "Oil Change",
    description: "Basic oil change",
    durationMinutes: 60,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const englishKeys = [
  "active",
  "createdAt",
  "description",
  "durationMinutes",
  "id",
  "name",
  "updatedAt",
].sort();

// ---------------------------------------------------------------------------
// listServices filtering
// ---------------------------------------------------------------------------
describe("listServices filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default (no opts) returns only active and maps activeOnly:true", async () => {
    const active1 = makeServicioDTO({ id: SERVICE_ID, active: true });
    const active2 = makeServicioDTO({ id: SERVICE_ID_2, active: true });
    mockListServicios.mockResolvedValue([active1, active2]);

    const result = await listServices({} as never);

    expect(mockListServicios).toHaveBeenCalledTimes(1);
    expect(mockListServicios).toHaveBeenCalledWith(expect.anything(), { activeOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.active === true)).toBe(true);
  });

  it("explicit includeInactive:false maps activeOnly:true", async () => {
    mockListServicios.mockResolvedValue([makeServicioDTO()]);
    await listServices({} as never, { includeInactive: false });
    expect(mockListServicios).toHaveBeenCalledWith(expect.anything(), { activeOnly: true });
  });

  it("includeInactive:true maps activeOnly:false and returns all", async () => {
    const active = makeServicioDTO({ id: SERVICE_ID, active: true });
    const inactive = makeServicioDTO({ id: SERVICE_ID_2, active: false, name: "Archived Service" });
    mockListServicios.mockResolvedValue([active, inactive]);

    const result = await listServices({} as never, { includeInactive: true });

    expect(mockListServicios).toHaveBeenCalledWith(expect.anything(), { activeOnly: false });
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.active === false)).toBe(true);
  });

  it("empty catalog returns [] and no error", async () => {
    mockListServicios.mockResolvedValue([]);
    const result = await listServices({} as never);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DTO shape & INV-08
// ---------------------------------------------------------------------------
describe("listServices DTO shape INV-08", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DTO has exactly English keys, no snake_case leakage via listServices", async () => {
    const dto = makeServicioDTO();
    mockListServicios.mockResolvedValue([dto]);
    const [result] = await listServices({} as never);
    expect(Object.keys(result as object).sort()).toEqual(englishKeys);
    expect(result).not.toHaveProperty("nombre");
    expect(result).not.toHaveProperty("descripcion");
    expect(result).not.toHaveProperty("duracionMinutos");
    expect(result).not.toHaveProperty("duracion_minutos");
    expect(result).not.toHaveProperty("activo");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("updated_at");
  });

  it("DTO from getServiceById has exactly English keys", async () => {
    const dto = makeServicioDTO();
    mockFindServicioById.mockResolvedValue(dto);
    const result = await getServiceById({} as never, SERVICE_ID);
    expect(Object.keys(result as object).sort()).toEqual(englishKeys);
    expect(result).not.toHaveProperty("nombre");
    expect(result).not.toHaveProperty("duracionMinutos");
    expect(result).not.toHaveProperty("activo");
  });
});

// ---------------------------------------------------------------------------
// getServiceById
// ---------------------------------------------------------------------------
describe("getServiceById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns DTO when found and calls repo with correct id", async () => {
    const dto = makeServicioDTO({ id: SERVICE_ID });
    mockFindServicioById.mockResolvedValue(dto);

    const result = await getServiceById({} as never, SERVICE_ID);

    expect(mockFindServicioById).toHaveBeenCalledTimes(1);
    expect(mockFindServicioById).toHaveBeenCalledWith(expect.anything(), SERVICE_ID);
    expect(result).toEqual(dto);
    expect(result.id).toBe(SERVICE_ID);
  });

  it("throws ServiceNotFoundError with code SERVICE_NOT_FOUND when missing", async () => {
    mockFindServicioById.mockResolvedValue(null);
    await expect(getServiceById({} as never, UNKNOWN_ID)).rejects.toThrow(ServiceNotFoundError);
  });

  it("thrown error has code SERVICE_NOT_FOUND and serviceId field", async () => {
    mockFindServicioById.mockResolvedValue(null);
    try {
      await getServiceById({} as never, UNKNOWN_ID);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ServiceNotFoundError).code).toBe("SERVICE_NOT_FOUND");
      expect((error as ServiceNotFoundError).serviceId).toBe(UNKNOWN_ID);
      expect((error as ServiceNotFoundError).name).toBe("ServiceNotFoundError");
      expect((error as ServiceNotFoundError)).toBeInstanceOf(DomainError);
      expect((error as Error).message).toContain(UNKNOWN_ID);
    }
  });

  it("throws ZodError for invalid UUID and skips DB call", async () => {
    await expect(getServiceById({} as never, "not-a-uuid")).rejects.toThrow(z.ZodError);
    expect(mockFindServicioById).not.toHaveBeenCalled();
  });

  it("throws ZodError for empty string", async () => {
    await expect(getServiceById({} as never, "")).rejects.toThrow(z.ZodError);
    expect(mockFindServicioById).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getServiceDuration
// ---------------------------------------------------------------------------
describe("getServiceDuration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns durationMinutes via delegation", async () => {
    const dto = makeServicioDTO({ durationMinutes: 60 });
    mockFindServicioById.mockResolvedValue(dto);

    const result = await getServiceDuration({} as never, SERVICE_ID);

    expect(result).toBe(60);
    expect(mockFindServicioById).toHaveBeenCalledTimes(1);
    expect(mockFindServicioById).toHaveBeenCalledWith(expect.anything(), SERVICE_ID);
  });

  it("propagates ServiceNotFoundError unchanged", async () => {
    mockFindServicioById.mockResolvedValue(null);
    await expect(getServiceDuration({} as never, UNKNOWN_ID)).rejects.toThrow(ServiceNotFoundError);
    await expect(getServiceDuration({} as never, UNKNOWN_ID)).rejects.toMatchObject({
      code: "SERVICE_NOT_FOUND",
    });
  });

  it("propagates ZodError for invalid UUID", async () => {
    await expect(getServiceDuration({} as never, "bad-id")).rejects.toThrow(z.ZodError);
    expect(mockFindServicioById).not.toHaveBeenCalled();
  });

  it("duration invariant 30..120 %5==0 holds for returned value", async () => {
    for (const duration of [30, 60, 90, 120]) {
      mockFindServicioById.mockResolvedValue(makeServicioDTO({ durationMinutes: duration }));
      const value = await getServiceDuration({} as never, SERVICE_ID);
      expect(value).toBeGreaterThanOrEqual(30);
      expect(value).toBeLessThanOrEqual(120);
      expect(value % 5).toBe(0);
    }
  });

  it("no second query path — single findServicioById call per getServiceDuration", async () => {
    mockFindServicioById.mockResolvedValue(makeServicioDTO({ durationMinutes: 45 }));
    await getServiceDuration({} as never, SERVICE_ID);
    expect(mockFindServicioById).toHaveBeenCalledTimes(1);
    expect(mockListServicios).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Guards: server-only, no requireAuth, no snake_case in service signatures
// ---------------------------------------------------------------------------
describe("servicioService guards", () => {
  it("imports server-only", () => {
    const content = fs.readFileSync("src/services/servicioService.ts", "utf8");
    expect(content).toMatch(/import\s+["']server-only["']/);
  });

  it("does not import requireAuth", () => {
    const content = fs.readFileSync("src/services/servicioService.ts", "utf8");
    expect(content).not.toMatch(/requireAuth/);
  });

  it("ServiceNotFoundError extends DomainError with correct code", () => {
    const err = new ServiceNotFoundError(SERVICE_ID);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe("ServiceNotFoundError");
    expect(err.code).toBe("SERVICE_NOT_FOUND");
    expect(err.serviceId).toBe(SERVICE_ID);
  });
});

// ---------------------------------------------------------------------------
// createService
// ---------------------------------------------------------------------------
describe("createService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("success delegates to createServicio and returns DTO", async () => {
    const dto = makeServicioDTO({ name: "Cambio Aceite", durationMinutes: 60 });
    mockCreateServicio.mockResolvedValue(dto);
    const result = await createService({} as never, {
      name: "Cambio Aceite",
      durationMinutes: 60,
    });
    expect(mockCreateServicio).toHaveBeenCalledTimes(1);
    expect(result).toEqual(dto);
  });

  it("success with default active true", async () => {
    const dto = makeServicioDTO({ active: true });
    mockCreateServicio.mockResolvedValue(dto);
    const result = await createService({} as never, {
      name: "X",
      durationMinutes: 30,
    });
    expect(result.active).toBe(true);
  });

  it("maps 23505 PG error to ServicioNombreTakenError with code SERVICE_ALREADY_EXISTS", async () => {
    const pgError = Object.assign(new Error("duplicate key"), { code: "23505" });
    mockCreateServicio.mockRejectedValue(pgError);
    await expect(
      createService({} as never, { name: "Frenos", durationMinutes: 30 }),
    ).rejects.toMatchObject({ code: "SERVICE_ALREADY_EXISTS" });
  });

  it("propagates ServicioNombreTakenError directly", async () => {
    const { ServicioNombreTakenError } = await import("@/db/repositories/servicios");
    const err = new ServicioNombreTakenError("Frenos");
    mockCreateServicio.mockRejectedValue(err);
    await expect(
      createService({} as never, { name: "Frenos", durationMinutes: 30 }),
    ).rejects.toBe(err);
  });

  it("wraps 23505 via hasPgCode cause chain", async () => {
    const inner = Object.assign(new Error("inner"), { code: "23505" });
    const wrapped = new Error("wrapped");
    (wrapped as unknown as { cause: unknown }).cause = inner;
    mockCreateServicio.mockRejectedValue(wrapped);
    await expect(
      createService({} as never, { name: "Dup", durationMinutes: 30 }),
    ).rejects.toMatchObject({ code: "SERVICE_ALREADY_EXISTS" });
  });
});

// ---------------------------------------------------------------------------
// updateServiceActive
// ---------------------------------------------------------------------------
describe("updateServiceActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("success returns DTO with updated active", async () => {
    const dto = makeServicioDTO({ active: false });
    mockUpdateServicio.mockResolvedValue(dto);
    const result = await updateServiceActive({} as never, SERVICE_ID, false);
    expect(mockUpdateServicio).toHaveBeenCalledWith(expect.anything(), SERVICE_ID, {
      activo: false,
    });
    expect(result.active).toBe(false);
  });

  it("throws ServiceNotFoundError with code SERVICE_NOT_FOUND when repo returns null", async () => {
    mockUpdateServicio.mockResolvedValue(null);
    await expect(updateServiceActive({} as never, UNKNOWN_ID, false)).rejects.toThrow(
      ServiceNotFoundError,
    );
    await expect(updateServiceActive({} as never, UNKNOWN_ID, false)).rejects.toMatchObject({
      code: "SERVICE_NOT_FOUND",
    });
  });

  it("error contains serviceId", async () => {
    mockUpdateServicio.mockResolvedValue(null);
    try {
      await updateServiceActive({} as never, UNKNOWN_ID, true);
      expect.unreachable("should throw");
    } catch (e) {
      expect((e as ServiceNotFoundError).serviceId).toBe(UNKNOWN_ID);
    }
  });

  it("throws ZodError for invalid UUID and skips DB call", async () => {
    await expect(updateServiceActive({} as never, "not-a-uuid", true)).rejects.toThrow(
      z.ZodError,
    );
    expect(mockUpdateServicio).not.toHaveBeenCalled();
  });

  it("throws ZodError for empty string UUID", async () => {
    await expect(updateServiceActive({} as never, "", false)).rejects.toThrow(z.ZodError);
    expect(mockUpdateServicio).not.toHaveBeenCalled();
  });
});
