import type { ServicioRow } from "@/db/schema";

/**
 * Public DTO boundary (INV-08): full English rename —
 * nombre→name, descripcion→description, duracionMinutos→durationMinutes,
 * activo→active, created_at/updated_at→createdAt/updatedAt.
 * snake_case or Spanish DB keys never appear on the DTO type.
 */
export interface ServicioDTO {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toServicioDTO(row: ServicioRow): ServicioDTO {
  return {
    id: row.id,
    name: row.nombre,
    description: row.descripcion,
    durationMinutes: row.duracionMinutos,
    active: row.activo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
