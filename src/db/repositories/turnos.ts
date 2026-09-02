import { and, asc, desc, eq, gt, gte, lt, inArray, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "@/db";
import { servicios, turnos, vehiculos } from "@/db/schema";
import type { EnrichedTurnoDTO, TurnoDTO } from "@/db/mappers/turno";
import { toEnrichedDTO, toTurnoDTO } from "@/db/mappers/turno";
import { turnoInputSchema } from "@/db/validators/turno";
import { DomainError, hasPgCode, PG_CODES } from "@/lib/errors";
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
import { getBaDayUtcRange } from "@/services/availability/availabilityService";

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
    if (hasPgCode(error, PG_CODES.EXCLUSION_VIOLATION)) {
      throw new AppointmentNotAvailableError(
        "El horario seleccionado ya no se encuentra disponible.",
        { cause: error },
      );
    }
    if (hasPgCode(error, PG_CODES.FOREIGN_KEY_VIOLATION)) {
      throw new TurnoForeignKeyError(
        "Foreign key violation creating turno (cliente/vehiculo/servicio)",
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Count active overlapping turnos WITH FOR UPDATE lock (T-028).
 * Used INSIDE REPEATABLE READ transaction before INSERT.
 * No shared helper with read-only path — dedicated TX helper.
 */
export async function countActiveOverlappingForUpdate(
  tx: import("@/db").Tx,
  range: { fromUtc: Date; toUtc: Date },
): Promise<number> {
  if (
    !(range.fromUtc instanceof Date) ||
    Number.isNaN(range.fromUtc.getTime()) ||
    !(range.toUtc instanceof Date) ||
    Number.isNaN(range.toUtc.getTime())
  ) {
    throw new ValidationError("invalid range Date");
  }
  const result = await tx.execute(
    sql`SELECT count(*)::int AS cnt FROM turnos WHERE tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange(${range.fromUtc}, ${range.toUtc}) AND estado IN ('PENDIENTE','CONFIRMADO') FOR UPDATE`,
  );
  const rows = (result as unknown as { rows?: Array<{ cnt: number | string }> }).rows ??
    (result as unknown as Array<{ cnt: number | string }>);
  const row = Array.isArray(rows) ? rows[0] : (rows as unknown as { cnt: number | string } | undefined);
  // Handle drizzle returning array vs {rows}
  if (Array.isArray(result) && result.length > 0) {
    const first = (result as unknown as Array<{ cnt: number | string }>)[0];
    if (first) return Number(first.cnt);
  }
  if (row) return Number(row.cnt);
  // Fallback: result.rows
  const maybeRows = (result as unknown as { rows?: Array<{ cnt: number | string }> }).rows;
  if (maybeRows && maybeRows[0]) return Number(maybeRows[0].cnt);
  return 0;
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
    if (hasPgCode(error, PG_CODES.EXCLUSION_VIOLATION)) {
      throw new AppointmentNotAvailableError("El horario seleccionado ya no se encuentra disponible.", {
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
  // --- T-033 extensions (all optional, additive) ---
  status?: "PENDIENTE" | "CONFIRMADO" | "CANCELADO" | "RECHAZADO";
  from?: Date;
  to?: Date;
  date?: string;
  offset?: number;
  dateRange?: { fromUtc: Date; toUtc: Date };
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
  // --- T-033 validations ---
  if (query.offset !== undefined) {
    if (!Number.isInteger(query.offset) || query.offset < 0) {
      throw new ValidationError("offset must be >= 0");
    }
  }
  const allowedStatuses = new Set(["PENDIENTE", "CONFIRMADO", "CANCELADO", "RECHAZADO"]);
  if (query.status !== undefined && !allowedStatuses.has(query.status)) {
    throw new ValidationError("status must be PENDIENTE|CONFIRMADO|CANCELADO|RECHAZADO");
  }
  // Defensive contradiction guard (also enforced in Zod)
  if (query.status === "CANCELADO" && !query.includeCancelled) {
    throw new ValidationError("status CANCELADO requires includeCancelled=true");
  }
  if (query.status === "RECHAZADO" && !query.includeRejected) {
    throw new ValidationError("status RECHAZADO requires includeRejected=true");
  }
  // Defensive date vs from/to mutual exclusion
  if (query.date !== undefined && (query.from !== undefined || query.to !== undefined)) {
    throw new ValidationError("use date or from/to, not both");
  }
  if (query.dateRange !== undefined && (query.from !== undefined || query.to !== undefined)) {
    throw new ValidationError("use date or from/to, not both");
  }
  if (query.from !== undefined && (!(query.from instanceof Date) || Number.isNaN(query.from.getTime()))) {
    throw new ValidationError("invalid from Date");
  }
  if (query.to !== undefined && (!(query.to instanceof Date) || Number.isNaN(query.to.getTime()))) {
    throw new ValidationError("invalid to Date");
  }
  if (query.from !== undefined && query.to !== undefined && query.from.getTime() > query.to.getTime()) {
    throw new ValidationError("from must be <= to");
  }
  if (query.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }
  if (query.dateRange !== undefined) {
    const dr = query.dateRange;
    if (
      !(dr.fromUtc instanceof Date) ||
      Number.isNaN(dr.fromUtc.getTime()) ||
      !(dr.toUtc instanceof Date) ||
      Number.isNaN(dr.toUtc.getTime())
    ) {
      throw new ValidationError("invalid dateRange");
    }
    if (dr.fromUtc.getTime() > dr.toUtc.getTime()) {
      throw new ValidationError("dateRange from must be <= to");
    }
  }

  const sortDir = rawSort.includes("desc") ? "desc" : "asc";

  // Statuses: default RN-04 or exact status override
  let statuses: string[];
  if (query.status !== undefined) {
    statuses = [query.status];
  } else {
    statuses = ["PENDIENTE", "CONFIRMADO"];
    if (query.includeCancelled) statuses.push("CANCELADO");
    if (query.includeRejected) statuses.push("RECHAZADO");
  }

  // Resolve dateRange from `date` string if provided and no explicit dateRange
  let effectiveDateRange: { fromUtc: Date; toUtc: Date } | undefined = query.dateRange;
  if (!effectiveDateRange && query.date !== undefined) {
    effectiveDateRange = getBaDayUtcRange(query.date, workshopConfig.timezone);
  }

  const conditions = [
    inArray(turnos.estado, statuses),
    gt(turnos.fechaHoraInicio, now),
  ];
  if (query.customerId !== undefined) {
    conditions.push(eq(turnos.clienteId, query.customerId));
  }
  if (effectiveDateRange) {
    conditions.push(gte(turnos.fechaHoraInicio, effectiveDateRange.fromUtc));
    conditions.push(lt(turnos.fechaHoraInicio, effectiveDateRange.toUtc));
  }
  if (query.from !== undefined) {
    conditions.push(gte(turnos.fechaHoraInicio, query.from));
  }
  if (query.to !== undefined) {
    conditions.push(lt(turnos.fechaHoraInicio, query.to));
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
  // Offset handling: page wins if both page and offset provided; otherwise respect offset
  // Heuristic: when page is default 1 and offset is provided, use offset; when page >1 and offset provided, page wins
  let offsetValue: number;
  if (query.offset !== undefined && query.page === undefined) {
    offsetValue = query.offset;
  } else if (query.offset !== undefined && page === 1) {
    // page default (1) + offset explicit → honor offset (supports ?offset=20)
    // If both explicitly page=1 and offset=5, this still honors offset; page-wins for page>1 covers spec's "page overrides offset"
    offsetValue = query.offset;
  } else {
    offsetValue = (page - 1) * limit;
  }
  // Explicit page>1 overrides offset regardless
  if (query.offset !== undefined && query.page !== undefined && page !== 1) {
    offsetValue = (page - 1) * limit;
  }

  const rows = await db
    .select()
    .from(turnos)
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offsetValue);

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

// ---------------------------------------------------------------------------
// findTurnosPaginatedEnriched ??? T-045 UI-04 single LEFT JOIN enrichment
// ---------------------------------------------------------------------------

export interface FindTurnosPaginatedEnrichedQuery {
  customerId?: string;
  page?: number;
  limit?: number;
  now?: Date;
}

export interface FindTurnosPaginatedEnrichedResult {
  data: EnrichedTurnoDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single-query paginated read for the upcoming-appointments screen
 * (T-045 UI-04). Produces `EnrichedTurnoDTO[]` via ONE LEFT JOIN against
 * `servicios` + `vehiculos` and ONE `count(*)` over `turnos` ??? never N+1.
 *
 * Why LEFT JOIN (not Map+inArray): the upcoming list is small
 * (paginated to ???100 rows) and the joined columns are indexed via the
 * existing FK indexes (`idx_turno_servicio_id`, `idx_turno_vehiculo_id`).
 * A bulk Map strategy would issue 3 queries (turnos + servicios IN (???)
 * + vehiculos IN (???)) ??? not worth the savings when the LEFT JOIN keeps
 * the count and the data rows in lock-step.
 *
 * RN-04 defaults: PENDIENTE | CONFIRMADO with `startDateTime > now UTC`.
 * No `includeCancelled` / `includeRejected` flags ??? the upcoming screen
 * never surfaces CANCELADO / RECHAZADO rows by design (spec REQ-03).
 *
 * INV-02: status filter is a hard-coded UPPER_SNAKE tuple ??? no caller
 * supplied string can leak a bogus value.
 *
 * INV-08: `toEnrichedDTO` renames snake_case columns to camelCase; the
 * mapper is the single source of truth. `?page` / `?limit` clamp at the
 * validator layer (`parseAppointmentsQuery`), not here ??? the repo
 * receives already-clamped integers.
 */
export async function findTurnosPaginatedEnriched(
  db: DbOrTx,
  query: FindTurnosPaginatedEnrichedQuery = {},
): Promise<FindTurnosPaginatedEnrichedResult> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const now = query.now ?? new Date();

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("page must be >= 1");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError("limit must be between 1 and 100");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ValidationError("invalid now Date");
  }

  const conditions = [
    inArray(turnos.estado, ["PENDIENTE", "CONFIRMADO"]),
    gt(turnos.fechaHoraInicio, now),
  ];
  if (query.customerId !== undefined) {
    conditions.push(eq(turnos.clienteId, query.customerId));
  }
  const whereClause = and(...conditions);

  // Count query ??? same predicate, NO joins (cheaper and avoids
  // double-counting if a join ever multiplies rows).
  const totalRows = await db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select({ count: sql<number>`count(*)`.mapWith(Number) } as any)
    .from(turnos)
    .where(whereClause);
  const total = Number((totalRows[0] as unknown as { count: number })?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const offsetValue = (page - 1) * limit;

  // Data query ??? single LEFT JOIN servicios + LEFT JOIN vehiculos.
  // Returns one row per turno with optional enrichment columns.
  const rows = await db
    .select({
      id: turnos.id,
      clienteId: turnos.clienteId,
      vehiculoId: turnos.vehiculoId,
      servicioId: turnos.servicioId,
      fechaHoraInicio: turnos.fechaHoraInicio,
      fechaHoraFin: turnos.fechaHoraFin,
      estado: turnos.estado,
      createdAt: turnos.createdAt,
      updatedAt: turnos.updatedAt,
      servicioNombre: servicios.nombre,
      vehiculoMarca: vehiculos.marca,
      vehiculoModelo: vehiculos.modelo,
      vehiculoPatente: vehiculos.patente,
    })
    .from(turnos)
    .leftJoin(servicios, eq(servicios.id, turnos.servicioId))
    .leftJoin(vehiculos, eq(vehiculos.id, turnos.vehiculoId))
    .where(whereClause)
    .orderBy(asc(turnos.fechaHoraInicio))
    .limit(limit)
    .offset(offsetValue);

  return {
    data: rows.map(toEnrichedDTO),
    pagination: { page, limit, total, totalPages },
  };
}
