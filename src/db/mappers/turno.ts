import type { TurnoRow } from "@/db/schema";

/**
 * Public DTO boundary (INV-08): full English rename —
 * cliente_id→customerId, vehiculo_id→vehicleId, servicio_id→serviceId,
 * fecha_hora_inicio→startDateTime, fecha_hora_fin→endDateTime,
 * estado→status, created_at/updated_at→createdAt/updatedAt.
 * snake_case or Spanish DB keys never appear on the DTO type.
 */
export interface TurnoDTO {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  startDateTime: Date;
  endDateTime: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toTurnoDTO(row: TurnoRow): TurnoDTO {
  return {
    id: row.id,
    customerId: row.clienteId,
    vehicleId: row.vehiculoId,
    serviceId: row.servicioId,
    startDateTime: row.fechaHoraInicio,
    endDateTime: row.fechaHoraFin,
    status: row.estado,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
