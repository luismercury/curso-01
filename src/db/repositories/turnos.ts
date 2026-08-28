import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "@/db";
import { servicios, turnos } from "@/db/schema";
import type { TurnoDTO } from "@/db/mappers/turno";
import { toTurnoDTO } from "@/db/mappers/turno";
import { turnoInputSchema } from "@/db/validators/turno";
import { DomainError, hasPgCode } from "@/lib/errors";
import { workshopConfig } from "@/config/workshopConfig";
import type { WorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { calculateEndAndValidate } from "@/services/availability/duration";
import { ACTIVE_STATUSES } from "@/services/availability/overlap";
import type { ExistingEntry } from "@/services/availability/overlap";
import {
  AppointmentNotAvailableError,
  AppointmentNotFoundError,
} from "@/services/errors";

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

/**
 * Single-statement status mutation — thin repo, injectable DbOrTx.
 * Maps 23P01 EXCLUDE violation → AppointmentNotAvailableError, empty
 * returning → AppointmentNotFoundError. No row-level locking or
 * serializable isolation here — deferred to T-028 atomic booking.
 * Preserves INV-08 via toTurnoDTO, INV-02 via schema CHECK.
 */
export async function updateTurnoStatus(
  db: DbOrTx,
  id: string,
  status: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO" | "CANCELADO",
): Promise<TurnoDTO> {
  try {
    const rows = await db
      .update(turnos)
      .set({ estado: status, updatedAt: new Date() })
      .where(eq(turnos.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new AppointmentNotFoundError(id);
    }
    return toTurnoDTO(row);
  } catch (error) {
    if (error instanceof AppointmentNotFoundError) {
      throw error;
    }
    if (hasPgCode(error, "23P01")) {
      throw new AppointmentNotAvailableError("Appointment slot not available", {
        cause: error,
      });
    }
    throw error;
  }
}

export interface FindTurnosPaginatedQuery {
  customerId?: string;
  includeCancelled?: boolean;
  includeRejected?: boolean;
  page?: number;
  limit?: number;
  sort?: "asc" | "desc" | "startAt:asc" | "startAt:desc";
  now?: Date;
}

export interface FindTurnosPaginatedResult {
  data: TurnoDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * RN-04 paginated query — workshop-user time is UTC instant only.
 * Defaults: próximos = PENDIENTE|CONFIRMADO with start > now (UTC).
 * Flags includeCancelled/includeRejected opt-in. Pagination: limit 1..100
 * default 20, page >=1, sort startAt asc|desc default asc. DbOrTx-injected
 * so T-028 can pass tx without signature change. No timezone hardcode —
 * caller supplies UTC Date via now or defaults to new Date().
 * Uses toTurnoDTO per INV-08; only the four allowed statuses (INV-02).
 */
export async function findTurnosPaginated(
  db: DbOrTx,
  query: FindTurnosPaginatedQuery = {},
): Promise<FindTurnosPaginatedResult> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const rawSort = query.sort ?? "asc";
  const now = query.now ?? new Date();

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("page must be >= 1");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError("limit must be between 1 and 100");
  }
  const allowedSorts = new Set(["asc", "desc", "startAt:asc", "startAt:desc"]);
  if (!allowedSorts.has(rawSort)) {
    throw new ValidationError("sort must be asc|desc|startAt:asc|startAt:desc");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ValidationError("invalid now Date");
  }

  const sortDir = rawSort.includes("desc") ? "desc" : "asc";

  const statuses: string[] = ["PENDIENTE", "CONFIRMADO"];
  if (query.includeCancelled) statuses.push("CANCELADO");
  if (query.includeRejected) statuses.push("RECHAZADO");

  const conditions = [
    inArray(turnos.estado, statuses),
    gt(turnos.fechaHoraInicio, now),
  ];
  if (query.customerId !== undefined) {
    conditions.push(eq(turnos.clienteId, query.customerId));
  }

  const whereClause = and(...conditions);
  const orderClause =
    sortDir === "desc" ? desc(turnos.fechaHoraInicio) : asc(turnos.fechaHoraInicio);

  const totalRows = await db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select({ count: sql<number>`count(*)`.mapWith(Number) } as any)
    .from(turnos)
    .where(whereClause);

  const total = Number((totalRows[0] as unknown as { count: number })?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(turnos)
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(toTurnoDTO),
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Bulk-fetch adapter for availability (T-024).
 * Queries WHERE tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($1,$2)
 * AND estado IN ('PENDIENTE','CONFIRMADO') — count < capacityPerSlot half-open.
 * Returns ExistingEntry[] mapped from TurnoRow preserving UTC getTime semantics.
 */
export async function findActiveTurnosByDateRange(
  db: DbOrTx,
  range: { fromUtc: Date; toUtc: Date },
): Promise<ExistingEntry[]> {
  if (
    !(range.fromUtc instanceof Date) ||
    Number.isNaN(range.fromUtc.getTime()) ||
    !(range.toUtc instanceof Date) ||
    Number.isNaN(range.toUtc.getTime())
  ) {
    throw new ValidationError("invalid range Date");
  }
  const rows = await db
    .select()
    .from(turnos)
    .where(
      sql`tstzrange(${turnos.fechaHoraInicio}, ${turnos.fechaHoraFin}) && tstzrange(${range.fromUtc}, ${range.toUtc}) AND ${turnos.estado} IN (${sql.join(
        ACTIVE_STATUSES.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  return rows.map((row) => ({
    start: row.fechaHoraInicio,
    end: row.fechaHoraFin,
    status: row.estado,
  }));
}
