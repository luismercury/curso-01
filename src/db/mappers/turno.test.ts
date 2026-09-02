/**
 * Tests for the enriched turno mapper (T-045 UI-04 PR1 data layer).
 *
 * Covers GWT 1.1 (happy enrichment), 1.3 (deleted service / vehicle
 * fallback), and 6.3 (Zod rejects snake_case at the wire boundary).
 *
 * INV-08: every assertion checks that snake_case / Spanish DB keys never
 * leak from the mapper into the DTO / JSON shape.
 */
import { describe, expect, it } from "vitest";

import {
  ENRICHED_FALLBACK,
  toEnrichedDTO,
  toEnrichedJson,
  type EnrichedTurnoRow,
} from "@/db/mappers/turno";

function baseRow(overrides: Partial<EnrichedTurnoRow> = {}): EnrichedTurnoRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clienteId: "22222222-2222-4222-8222-222222222222",
    vehiculoId: "33333333-3333-4333-8333-333333333333",
    servicioId: "44444444-4444-4444-8444-444444444444",
    fechaHoraInicio: new Date("2026-09-10T12:00:00.000Z"),
    fechaHoraFin: new Date("2026-09-10T13:00:00.000Z"),
    estado: "PENDIENTE",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    servicioNombre: "Cambio de aceite",
    vehiculoMarca: "Toyota",
    vehiculoModelo: "Corolla",
    vehiculoPatente: "ABC123",
    ...overrides,
  };
}

describe("toEnrichedDTO — happy enrichment (GWT 1.1, INV-08)", () => {
  it("renames snake_case columns to camelCase English DTO", () => {
    const dto = toEnrichedDTO(baseRow());
    expect(dto.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(dto.customerId).toBe("22222222-2222-4222-8222-222222222222");
    expect(dto.vehicleId).toBe("33333333-3333-4333-8333-333333333333");
    expect(dto.serviceId).toBe("44444444-4444-4444-8444-444444444444");
    expect(dto.startDateTime).toBeInstanceOf(Date);
    expect(dto.endDateTime).toBeInstanceOf(Date);
    expect(dto.status).toBe("PENDIENTE");
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.serviceName).toBe("Cambio de aceite");
    expect(dto.vehicleLabel).toBe("Toyota Corolla — ABC123");
  });

  it("vehicleLabel format matches spec: '${marca} ${modelo} — ${patente}' (em dash U+2014)", () => {
    const dto = toEnrichedDTO(baseRow({ vehiculoMarca: "Ford", vehiculoModelo: "Focus", vehiculoPatente: "XYZ987" }));
    expect(dto.vehicleLabel).toBe("Ford Focus — XYZ987");
    expect(dto.vehicleLabel).toContain("\u2014"); // em dash literal
  });

  it("never leaks snake_case / Spanish DB keys (INV-08)", () => {
    const dto = toEnrichedDTO(baseRow()) as unknown as Record<string, unknown>;
    // snake_case DB column names — must NOT leak through the mapper.
    expect(dto).not.toHaveProperty("cliente_id");
    expect(dto).not.toHaveProperty("vehiculo_id");
    expect(dto).not.toHaveProperty("servicio_id");
    expect(dto).not.toHaveProperty("fecha_hora_inicio");
    expect(dto).not.toHaveProperty("fecha_hora_fin");
    expect(dto).not.toHaveProperty("estado");
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
    expect(dto).not.toHaveProperty("servicioNombre");
    expect(dto).not.toHaveProperty("vehiculoMarca");
    expect(dto).not.toHaveProperty("vehiculoModelo");
    expect(dto).not.toHaveProperty("vehiculoPatente");
    // camelCase mappings ARE present (positive control).
    expect(dto).toHaveProperty("customerId");
    expect(dto).toHaveProperty("vehicleId");
    expect(dto).toHaveProperty("serviceId");
    expect(dto).toHaveProperty("startDateTime");
    expect(dto).toHaveProperty("endDateTime");
    expect(dto).toHaveProperty("status");
    expect(dto).toHaveProperty("createdAt");
    expect(dto).toHaveProperty("updatedAt");
  });
});

describe("toEnrichedDTO — deleted FK fallback (GWT 1.3, REQ-01)", () => {
  it("servicioNombre null → fallback 'Servicio no disponible'", () => {
    const dto = toEnrichedDTO(baseRow({ servicioNombre: null }));
    expect(dto.serviceName).toBe(ENRICHED_FALLBACK.service);
    expect(dto.serviceName).toBe("Servicio no disponible");
  });

  it("vehiculo columns all null → fallback 'Vehículo no disponible'", () => {
    const dto = toEnrichedDTO(
      baseRow({
        vehiculoMarca: null,
        vehiculoModelo: null,
        vehiculoPatente: null,
      }),
    );
    expect(dto.vehicleLabel).toBe(ENRICHED_FALLBACK.vehicle);
    expect(dto.vehicleLabel).toBe("Vehículo no disponible");
  });

  it("partial vehiculo columns → still falls back (don't render half-truncated row)", () => {
    const dto = toEnrichedDTO(
      baseRow({ vehiculoMarca: "Toyota", vehiculoModelo: null, vehiculoPatente: "ABC123" }),
    );
    expect(dto.vehicleLabel).toBe(ENRICHED_FALLBACK.vehicle);
  });

  it("all enrichment nulls → fallback for both fields, status still preserved", () => {
    const dto = toEnrichedDTO(
      baseRow({
        servicioNombre: null,
        vehiculoMarca: null,
        vehiculoModelo: null,
        vehiculoPatente: null,
      }),
    );
    expect(dto.serviceName).toBe(ENRICHED_FALLBACK.service);
    expect(dto.vehicleLabel).toBe(ENRICHED_FALLBACK.vehicle);
    expect(dto.status).toBe("PENDIENTE");
  });
});

describe("toEnrichedJson — ISO string serialization (GWT 5.3, INV-06)", () => {
  it("replaces every Date with its ISO 8601 string (Z suffix)", () => {
    const dto = toEnrichedDTO(baseRow());
    const json = toEnrichedJson(dto);
    expect(typeof json.startDateTime).toBe("string");
    expect(typeof json.endDateTime).toBe("string");
    expect(typeof json.createdAt).toBe("string");
    expect(typeof json.updatedAt).toBe("string");
    expect(json.startDateTime).toBe("2026-09-10T12:00:00.000Z");
    expect(json.endDateTime).toBe("2026-09-10T13:00:00.000Z");
    expect(json.createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(json.updatedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("serviceName / vehicleLabel fall through unchanged", () => {
    const json = toEnrichedJson(toEnrichedDTO(baseRow()));
    expect(json.serviceName).toBe("Cambio de aceite");
    expect(json.vehicleLabel).toBe("Toyota Corolla — ABC123");
  });

  it("never leaks snake_case keys at the wire (INV-08)", () => {
    const json = toEnrichedJson(toEnrichedDTO(baseRow())) as unknown as Record<string, unknown>;
    expect(json).not.toHaveProperty("cliente_id");
    expect(json).not.toHaveProperty("vehiculo_id");
    expect(json).not.toHaveProperty("servicio_id");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(json).not.toHaveProperty("fecha_hora_fin");
    expect(json).not.toHaveProperty("estado");
    expect(json).not.toHaveProperty("created_at");
    expect(json).not.toHaveProperty("updated_at");
    expect(json).not.toHaveProperty("servicioNombre");
    expect(json).not.toHaveProperty("vehiculoMarca");
  });
});
