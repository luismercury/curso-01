import { eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { vehiculos } from "@/db/schema";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";
import { toVehiculoDTO } from "@/db/mappers/vehiculo";
import {
  normalizePatente,
  vehiculoInputSchema,
} from "@/db/validators/vehiculo";
import { DomainError, hasPgCode } from "@/lib/errors";

/**
 * Public-facing creation input (INV-08): English camelCase at the
 * repository boundary; renaming to Spanish DB names happens here before
 * validation and INSERT.
 */
export interface CreateVehiculoInput {
  customerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
}

export class VehiculoPatenteTakenError extends DomainError {
  readonly plate: string;

  constructor(plate: string, options?: { cause?: unknown }) {
    super(`A vehiculo with patente "${plate}" already exists`);
    this.name = "VehiculoPatenteTakenError";
    this.plate = plate;
    // Preserve the wrapped pg error for diagnostics without exposing
    // driver types on the public surface.
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class VehiculoClienteNotFoundError extends DomainError {
  readonly customerId: string;

  constructor(customerId: string, options?: { cause?: unknown }) {
    super(`No cliente exists with id "${customerId}"`);
    this.name = "VehiculoClienteNotFoundError";
    this.customerId = customerId;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thin repository (design D5): single-statement operations, no transactions
 * in v1, db handle injectable for testability.
 *
 * cliente_id is IMMUTABLE by absence: no method in this module can change a
 * vehicle's owner after creation — there is deliberately no write path other
 * than createVehiculo. Ownership changes are out of scope per REQ-VEH-06.
 */
export async function createVehiculo(
  dbOrTx: DbOrTx,
  input: CreateVehiculoInput,
): Promise<VehiculoDTO> {
  // RSK-04 dual defense: normalize here even though the Zod transform will
  // do it again during parse — callers cannot bypass both layers.
  const validated = vehiculoInputSchema.parse({
    clienteId: input.customerId,
    marca: input.brand,
    modelo: input.model,
    anio: input.year,
    patente: normalizePatente(input.plate),
  });
  try {
    const [row] = await dbOrTx.insert(vehiculos).values(validated).returning();
    if (!row) {
      throw new Error("INSERT INTO vehiculos returned no rows");
    }
    return toVehiculoDTO(row);
  } catch (error) {
    if (hasPgCode(error, "23505")) {
      throw new VehiculoPatenteTakenError(validated.patente, { cause: error });
    }
    if (hasPgCode(error, "23503")) {
      throw new VehiculoClienteNotFoundError(input.customerId, {
        cause: error,
      });
    }
    throw error;
  }
}

export async function findVehiculoById(
  dbOrTx: DbOrTx,
  id: string,
): Promise<VehiculoDTO | null> {
  const rows = await dbOrTx
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.id, id))
    .limit(1);
  return rows[0] ? toVehiculoDTO(rows[0]) : null;
}

export async function findVehiculoByPatente(
  dbOrTx: DbOrTx,
  plate: string,
): Promise<VehiculoDTO | null> {
  const rows = await dbOrTx
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.patente, normalizePatente(plate)))
    .limit(1);
  return rows[0] ? toVehiculoDTO(rows[0]) : null;
}

export async function findVehiculosByClienteId(
  dbOrTx: DbOrTx,
  customerId: string,
): Promise<VehiculoDTO[]> {
  const rows = await dbOrTx
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.clienteId, customerId));
  return rows.map(toVehiculoDTO);
}
