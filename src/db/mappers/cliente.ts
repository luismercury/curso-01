import type { ClienteRow } from "@/db/schema";

/**
 * Public DTO boundary (INV-08): timestamps exposed camelCase, domain names
 * nombre/apellido/telefono stay Spanish per Technical-spec §8.1b.
 * snake_case keys never appear on the DTO type.
 */
export interface ClienteDTO {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toClienteDTO(row: ClienteRow): ClienteDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    telefono: row.telefono,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
