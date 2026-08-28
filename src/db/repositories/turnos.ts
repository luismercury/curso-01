import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { servicios, turnos } from "@/db/schema";
import type { TurnoDTO } from "@/db/mappers/turno";
import { toTurnoDTO } from "@/db/mappers/turno";
import { turnoInputSchema } from "@/db/validators/turno";
import { DomainError, hasPgCode } from "@/lib/errors";
import { workshopConfig } from "@/config/workshopConfig";
import type { WorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { calculateEndAndValidate } from "@/services/availability/duration";

/**
 * Public-facing creation input (INV-08): English camelCase at the
 * repository boundary; renaming to Spanish DB names happens here before
 * validation and INSERT. fechaHoraFin is computed as
 * startDateTime + servicio.durationMinutes (INV-05 snapshot), not supplied
 * by the client.
 */
export interface CreateTurnoInput {
  customerId: string;
  vehicleId: string;
  serviceId: string;
  startDateTime: Date;
  status: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO" | "CANCELADO";
}

export class TurnoForeignKeyError extends DomainError {
  readonly code = "23503";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "TurnoForeignKeyError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thin repository: single-statement operations, thin injectable Db, no
 * transactions in T-008 (REPEATABLE READ + SELECT FOR UPDATE lands in T-028).
 * hasPgCode reused for 23503 mapping; future 23505/23514 handled similarly.
 */
export async function createTurno(
  db: Db,
  input: CreateTurnoInput,
  config: Pick<WorkshopConfig, "timezone" | "operatingHours"> = workshopConfig,
): Promise<TurnoDTO> {
  // Resolve servicio duration for snapshot; FK will also enforce existence
  const servicioRows = await db
    .select()
    .from(servicios)
    .where(eq(servicios.id, input.serviceId))
    .limit(1);
  const servicio = servicioRows[0];
  if (!servicio) {
    // Let FK 23503 surface — but early error preserves cause chain for hasPgCode
    // If servicio missing, DB FK will also reject; we throw domain error proactively
    // using a synthetic PgError shape so callers can use hasPgCode.
    const synthetic = new Error(
      `No servicio exists with id "${input.serviceId}"`,
    ) as Error & { code?: string };
    synthetic.code = "23503";
    throw new TurnoForeignKeyError(
      `No servicio exists with id "${input.serviceId}"`,
      { cause: synthetic },
    );
  }

  // INV-05 inclusive closure via duration helper (DI config.timezone, 400 not 409)
  const durationResult = calculateEndAndValidate({
    start: input.startDateTime,
    durationMinutes: servicio.duracionMinutos,
    config,
  });
  if (!durationResult.valid) {
    throw durationResult.error ?? new ValidationError("outside operating hours");
  }
  const endDateTime = durationResult.end;

  const validated = turnoInputSchema.parse({
    clienteId: input.customerId,
    vehiculoId: input.vehicleId,
    servicioId: input.serviceId,
    fechaHoraInicio: input.startDateTime,
    fechaHoraFin: endDateTime,
    estado: input.status,
  });

  try {
    const [row] = await db.insert(turnos).values(validated).returning();
    if (!row) {
      throw new Error("INSERT INTO turnos returned no rows");
    }
    return toTurnoDTO(row);
  } catch (error) {
    if (hasPgCode(error, "23503")) {
      throw new TurnoForeignKeyError(
        "Foreign key violation creating turno (cliente/vehiculo/servicio)",
        { cause: error },
      );
    }
    throw error;
  }
}

export async function findTurnoById(
  db: Db,
  id: string,
): Promise<TurnoDTO | null> {
  const rows = await db.select().from(turnos).where(eq(turnos.id, id)).limit(1);
  return rows[0] ? toTurnoDTO(rows[0]) : null;
}

export async function findTurnosByClienteId(
  db: Db,
  customerId: string,
): Promise<TurnoDTO[]> {
  const rows = await db
    .select()
    .from(turnos)
    .where(eq(turnos.clienteId, customerId));
  return rows.map(toTurnoDTO);
}
