import "server-only";

import { z } from "zod";

import type { DbOrTx } from "@/db";
import type { ServicioDTO } from "@/db/mappers/servicio";
import {
  createServicio,
  findServicioById,
  listServicios,
  updateServicio,
} from "@/db/repositories/servicios";
import type { ServiceCreateInput } from "@/db/validators/servicio";
import { hasPgCode } from "@/lib/errors";
import { ServiceNotFoundError } from "@/services/errors";
import { ServicioNombreTakenError } from "@/db/repositories/servicios";

const uuidSchema = z.string().uuid("Invalid service ID format");

export type ListServicesOptions = { includeInactive?: boolean };

/**
 * List services with default active-only filtering.
 * Delegates to listServicios with activeOnly = !includeInactive.
 */
export async function listServices(
  db: DbOrTx,
  opts?: ListServicesOptions,
): Promise<ServicioDTO[]> {
  const includeInactive = opts?.includeInactive ?? false;
  return listServicios(db as never, { activeOnly: !includeInactive });
}

/**
 * Get a service by id. Validates UUID before querying.
 * @throws ZodError if id is not a valid UUID
 * @throws ServiceNotFoundError if no row matches
 */
export async function getServiceById(
  db: DbOrTx,
  id: string,
): Promise<ServicioDTO> {
  uuidSchema.parse(id);
  const dto = await findServicioById(db as never, id);
  if (!dto) {
    throw new ServiceNotFoundError(id);
  }
  return dto;
}

/**
 * Get duration for a service. Delegates to getServiceById (same throw path).
 */
export async function getServiceDuration(
  db: DbOrTx,
  serviceId: string,
): Promise<number> {
  const dto = await getServiceById(db, serviceId);
  return dto.durationMinutes;
}

/**
 * Create a new service. DbOrTx injectable, server-only, no auth inside.
 * Maps PG 23505 → ServicioNombreTakenError (409 SERVICE_ALREADY_EXISTS).
 */
export async function createService(
  db: DbOrTx,
  input: ServiceCreateInput,
): Promise<ServicioDTO> {
  try {
    return await createServicio(db as never, {
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      active: input.active ?? true,
    });
  } catch (error) {
    if (error instanceof ServicioNombreTakenError) throw error;
    if (hasPgCode(error, "23505")) {
      throw new ServicioNombreTakenError(input.name, { cause: error });
    }
    throw error;
  }
}

/**
 * Update only the active flag of a service.
 * Validates UUID before DB, maps null → ServiceNotFoundError (404).
 */
export async function updateServiceActive(
  db: DbOrTx,
  id: string,
  active: boolean,
): Promise<ServicioDTO> {
  uuidSchema.parse(id);
  const result = await updateServicio(db as never, id, { activo: active });
  if (!result) {
    throw new ServiceNotFoundError(id);
  }
  return result;
}
