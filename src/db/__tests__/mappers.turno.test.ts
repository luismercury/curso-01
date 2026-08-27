import { describe, expect, it } from "vitest";
import type { TurnoRow } from "@/db/schema";
import { toTurnoDTO } from "@/db/mappers/turno";

function turnoRow(): TurnoRow {
  return {
    id: "3c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
    clienteId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    vehiculoId: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    servicioId: "2b2c3d4e-5f60-8a9b-c0d1-e2f3a4b5c6d7",
    fechaHoraInicio: new Date("2026-09-10T12:00:00.000Z"),
    fechaHoraFin: new Date("2026-09-10T13:00:00.000Z"),
    estado: "PENDIENTE",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toTurnoDTO mapper (INV-08)", () => {
  it("maps clienteId→customerId, vehiculoId→vehicleId, servicioId→serviceId, fechaHoraInicio→startDateTime, fechaHoraFin→endDateTime, estado→status", () => {
    const dto = toTurnoDTO(turnoRow());
    expect(dto).toEqual({
      id: turnoRow().id,
      customerId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
      vehicleId: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      serviceId: "2b2c3d4e-5f60-8a9b-c0d1-e2f3a4b5c6d7",
      startDateTime: new Date("2026-09-10T12:00:00.000Z"),
      endDateTime: new Date("2026-09-10T13:00:00.000Z"),
      status: "PENDIENTE",
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(dto.startDateTime).toBeInstanceOf(Date);
    expect(dto.endDateTime).toBeInstanceOf(Date);
  });

  it("triangulates with different interval and status, preserves Date references", () => {
    const row = turnoRow();
    row.fechaHoraInicio = new Date("2026-09-11T09:00:00.000Z");
    row.fechaHoraFin = new Date("2026-09-11T10:30:00.000Z");
    row.estado = "CONFIRMADO";
    const dto = toTurnoDTO(row);
    expect(dto.startDateTime).toBe(row.fechaHoraInicio);
    expect(dto.endDateTime).toBe(row.fechaHoraFin);
    expect(dto.status).toBe("CONFIRMADO");
  });

  it("exposes no Spanish or snake_case leak", () => {
    const dto = toTurnoDTO(turnoRow());
    const keys = Object.keys(dto);
    expect(keys).not.toContain("cliente_id");
    expect(keys).not.toContain("vehiculo_id");
    expect(keys).not.toContain("servicio_id");
    expect(keys).not.toContain("fecha_hora_inicio");
    expect(keys).not.toContain("fecha_hora_fin");
    expect(keys).not.toContain("estado");
    expect(keys).not.toContain("created_at");
    expect(keys.every((k) => !/_[a-z]/.test(k))).toBe(true);
  });
});
