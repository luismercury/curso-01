import "server-only";

import { z } from "zod";

import type { DbOrTx } from "@/db";
import type { ServicioDTO } from "@/db/mappers/servicio";
import { findServicioById, listServicios } from "@/db/repositories/servicios";
import { ServiceNotFoundError } from "@/services/errors";

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
