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

// ---------------------------------------------------------------------------
// Enriched DTO (T-045 UI-04)
// ---------------------------------------------------------------------------

/**
 * Row shape returned by the LEFT JOIN enrichment query in
 * `findTurnosPaginatedEnriched` — `servicios.nombre` and
 * `vehiculos.{marca, modelo, patente}` are nullable because the LEFT JOIN
 * can produce NULLs when a referenced service or vehicle was deleted (FK
 * RESTRICT preserves audit, but admin tooling may still NULL the row in
 * pathological cases). The mapper turns every NULL into a safe fallback
 * string so the UI never renders empty cells.
 *
 * INV-08: column names stay in Spanish (mirroring `TurnoRow`); only the
 * DTO types use English camelCase.
 */
export interface EnrichedTurnoRow extends TurnoRow {
  servicioNombre: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoPatente: string | null;
}

/**
 * Fallback strings the UI shows when a LEFT JOIN returns NULL (deleted
 * service / vehicle). Exported so PR2 surface tests can assert the
 * expected user-facing copy without duplicating the literals.
 */
export const ENRICHED_FALLBACK = {
  service: "Servicio no disponible",
  vehicle: "Vehículo no disponible",
} as const;

/**
 * Enriched DTO: extends `TurnoDTO` with `serviceName` / `vehicleLabel`.
 * `serviceName` is the `servicios.nombre` string or the fallback.
 * `vehicleLabel` is `"${marca} ${modelo} — ${patente}"` or the fallback
 * (em dash U+2014 matches the spec example).
 */
export interface EnrichedTurnoDTO extends TurnoDTO {
  serviceName: string;
  vehicleLabel: string;
}

/**
 * Map an enriched row to the DTO. Snake→camel mapping happens here, so
 * consumers never see `fechaHoraInicio`, `clienteId`, etc.
 */
export function toEnrichedDTO(row: EnrichedTurnoRow): EnrichedTurnoDTO {
  const base = toTurnoDTO(row);
  return {
    ...base,
    serviceName: row.servicioNombre ?? ENRICHED_FALLBACK.service,
    vehicleLabel:
      row.vehiculoMarca !== null &&
      row.vehiculoModelo !== null &&
      row.vehiculoPatente !== null
        ? `${row.vehiculoMarca} ${row.vehiculoModelo} — ${row.vehiculoPatente}`
        : ENRICHED_FALLBACK.vehicle,
  };
}

/**
 * Serialize a `Date` to an ISO 8601 string with timezone (INV-06). Helpers
 * are tolerant of `Invalid Date` so an upstream Drizzle edge case never
 * produces `null` on the wire — the caller treats `null` as "not yet
 * available" rather than crashing the React tree.
 */
function toIso(value: Date): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

/**
 * Cross the RSC → client boundary by replacing every `Date` with its ISO
 * string. The output is the exact shape `EnrichedTurnoDTOJson` declared in
 * `src/lib/api/appointments.ts` and validated by `enrichedTurnoDTOSchema`.
 * Strings (not Date instances) survive React Server Component serialization
 * without losing the timezone offset.
 */
export function toEnrichedJson(dto: EnrichedTurnoDTO): {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  startDateTime: string;
  endDateTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  serviceName: string;
  vehicleLabel: string;
} {
  return {
    id: dto.id,
    customerId: dto.customerId,
    vehicleId: dto.vehicleId,
    serviceId: dto.serviceId,
    startDateTime: toIso(dto.startDateTime) ?? "",
    endDateTime: toIso(dto.endDateTime) ?? "",
    status: dto.status,
    createdAt: toIso(dto.createdAt) ?? "",
    updatedAt: toIso(dto.updatedAt) ?? "",
    serviceName: dto.serviceName,
    vehicleLabel: dto.vehicleLabel,
  };
}
