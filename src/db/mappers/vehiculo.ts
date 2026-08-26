import type { VehiculoRow } from "@/db/schema";

/**
 * Public DTO boundary (INV-08): full English rename —
 * marca→brand, modelo→model, anio→year, patente→plate,
 * cliente_id→customerId, created_at/updated_at→createdAt/updatedAt.
 * snake_case or Spanish DB keys never appear on the DTO type.
 */
export interface VehiculoDTO {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toVehiculoDTO(row: VehiculoRow): VehiculoDTO {
  return {
    id: row.id,
    customerId: row.clienteId,
    brand: row.marca,
    model: row.modelo,
    year: row.anio,
    plate: row.patente,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
