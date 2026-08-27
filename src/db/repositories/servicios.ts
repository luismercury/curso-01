import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { servicios } from "@/db/schema";
import type { ServicioDTO } from "@/db/mappers/servicio";
import { toServicioDTO } from "@/db/mappers/servicio";
import { servicioInputSchema } from "@/db/validators/servicio";
import { DomainError, hasPgCode } from "@/lib/errors";

/**
 * Public-facing creation input (INV-08): English camelCase at the
 * repository boundary; renaming to Spanish DB names happens here before
 * validation and INSERT.
 */
export interface CreateServicioInput {
  name: string;
  description?: string | null;
  durationMinutes: number;
  active?: boolean;
}

export class ServicioNombreTakenError extends DomainError {
  readonly code = "SERVICE_ALREADY_EXISTS" as const;
  readonly nombre: string;

  constructor(nombre: string, options?: { cause?: unknown }) {
    super(`A servicio with nombre "${nombre}" already exists`);
    this.name = "ServicioNombreTakenError";
    this.nombre = nombre;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thin repository: single-statement operations, no transactions in v1,
 * db handle injectable for testability.
 */
export async function createServicio(
  db: Db,
  input: CreateServicioInput,
): Promise<ServicioDTO> {
  const validated = servicioInputSchema.parse({
    nombre: input.name,
    descripcion: input.description ?? undefined,
    duracionMinutos: input.durationMinutes,
    activo: input.active,
  });
  try {
    const [row] = await db.insert(servicios).values(validated).returning();
    if (!row) {
      throw new Error("INSERT INTO servicios returned no rows");
    }
    return toServicioDTO(row);
  } catch (error) {
    if (hasPgCode(error, "23505")) {
      throw new ServicioNombreTakenError(validated.nombre, { cause: error });
    }
    throw error;
  }
}

export async function findServicioById(
  db: Db,
  id: string,
): Promise<ServicioDTO | null> {
  const rows = await db
    .select()
    .from(servicios)
    .where(eq(servicios.id, id))
    .limit(1);
  return rows[0] ? toServicioDTO(rows[0]) : null;
}

export async function findServicioByNombre(
  db: Db,
  nombre: string,
): Promise<ServicioDTO | null> {
  const rows = await db
    .select()
    .from(servicios)
    .where(eq(servicios.nombre, nombre))
    .limit(1);
  return rows[0] ? toServicioDTO(rows[0]) : null;
}

export async function listServicios(
  db: Db,
  options?: { activeOnly?: boolean },
): Promise<ServicioDTO[]> {
  const activeOnly = options?.activeOnly ?? true;
  if (activeOnly) {
    const rows = await db
      .select()
      .from(servicios)
      .where(eq(servicios.activo, true));
    return rows.map(toServicioDTO);
  }
  const rows = await db.select().from(servicios);
  return rows.map(toServicioDTO);
}

export async function updateServicio(
  db: Db,
  id: string,
  patch: { activo: boolean },
): Promise<ServicioDTO | null> {
  const rows = await db
    .update(servicios)
    .set({ activo: patch.activo, updatedAt: new Date() })
    .where(eq(servicios.id, id))
    .returning();
  const row = rows[0];
  return row ? toServicioDTO(row) : null;
}
