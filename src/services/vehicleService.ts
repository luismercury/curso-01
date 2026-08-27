import "server-only";

import { z } from "zod";

import type { DbOrTx } from "@/db";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";
import {
  createVehiculo,
  findVehiculoById,
  findVehiculoByPatente,
  findVehiculosByClienteId,
} from "@/db/repositories/vehiculos";
import { normalizePatente } from "@/db/validators/vehiculo";
import { hasPgCode } from "@/lib/errors";
import {
  VehicleCustomerNotFoundError,
  VehiclePlateTakenError,
} from "@/services/errors";

/**
 * Input schema at service boundary — English camelCase, strict.
 * Composes normalizePatente for plate (idempotent dual-defense).
 * Does NOT mutate vehiculoInputSchema.
 */
export const vehicleCreateInputSchema = z
  .object({
    customerId: z.string().uuid(),
    brand: z.string().trim().min(2).max(100),
    model: z.string().trim().min(2).max(100),
    year: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1),
    plate: z
      .string()
      .transform(normalizePatente)
      .pipe(
        z
          .string()
          .regex(
            /^[A-Z0-9]{6,7}$/,
            "Plate must be 6-7 alphanumeric characters after normalization",
          ),
      ),
  })
  .strict();

export type VehicleCreateInput = z.input<typeof vehicleCreateInputSchema>;
export type VehicleCreateParsed = z.infer<typeof vehicleCreateInputSchema>;

/**
 * Create a vehicle: validates input, delegates single INSERT to repository,
 * maps PG codes to domain errors, returns VehiculoDTO.
 * No transaction wrapper (single-table atomic).
 * Auth-agnostic — ownership enforced at T-014 HTTP layer.
 */
export async function createVehicle(
  dbOrTx: DbOrTx,
  input: VehicleCreateInput,
): Promise<VehiculoDTO> {
  const parsed = vehicleCreateInputSchema.parse(
    input,
  ) as VehicleCreateParsed;

  try {
    const dto = await createVehiculo(dbOrTx, {
      customerId: parsed.customerId,
      brand: parsed.brand,
      model: parsed.model,
      year: parsed.year,
      plate: parsed.plate,
    });
    return dto;
  } catch (error) {
    if (hasPgCode(error, "23505")) {
      throw new VehiclePlateTakenError(parsed.plate, { cause: error });
    }
    if (hasPgCode(error, "23503")) {
      throw new VehicleCustomerNotFoundError(parsed.customerId, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * List vehicles for a customer. Ownership filter exposed for T-014 assertOwnership.
 */
export async function listVehiclesByCustomer(
  dbOrTx: DbOrTx,
  customerId: string,
): Promise<VehiculoDTO[]> {
  return findVehiculosByClienteId(dbOrTx, customerId);
}

/**
 * Get vehicle by id, null if not found.
 */
export async function getVehicleById(
  dbOrTx: DbOrTx,
  id: string,
): Promise<VehiculoDTO | null> {
  return findVehiculoById(dbOrTx, id);
}

/**
 * Find vehicle by plate. Normalizes arg via normalizePatente (idempotent).
 */
export async function findVehicleByPlate(
  dbOrTx: DbOrTx,
  plate: string,
): Promise<VehiculoDTO | null> {
  const normalized = normalizePatente(plate);
  return findVehiculoByPatente(dbOrTx, normalized);
}
