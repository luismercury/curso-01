import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import type { WorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import type { TurnoDTO } from "@/db/mappers/turno";
import { toTurnoDTO } from "@/db/mappers/turno";
import { turnos } from "@/db/schema";
import { turnoInputSchema } from "@/db/validators/turno";
import {
  countActiveOverlappingForUpdate,
  findTurnoById,
  findTurnosPaginated,
  findTurnosPaginatedEnriched,
  updateTurnoStatus,
} from "@/db/repositories/turnos";
import type {
  FindTurnosPaginatedEnrichedQuery,
  FindTurnosPaginatedEnrichedResult,
  FindTurnosPaginatedQuery,
  FindTurnosPaginatedResult,
} from "@/db/repositories/turnos";
import { findVehiculoById } from "@/db/repositories/vehiculos";
import { findServicioById } from "@/db/repositories/servicios";
import { canTransition } from "@/domain/appointmentStateMachine";
import type { AppointmentStatus } from "@/domain/appointmentStateMachine";
import { calculateEndAndValidate } from "@/services/availability/duration";
import { assertOwnership, type AuthUser } from "@/lib/auth/requireAuth";
import { hasPgCode, PG_CODES } from "@/lib/errors";
import { InvalidServiceError } from "@/services/appointmentGuard";
import {
  AppointmentNotAvailableError,
  AppointmentNotFoundError,
  InvalidAppointmentStateError,
} from "@/services/errors";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface AppointmentServiceDeps {
  db: Db;
  config: Pick<WorkshopConfig, "timezone" | "operatingHours" | "capacityPerSlot">;
  now?: Date;
}

const uuidSchema = z.string().uuid();

const createInputSchema = z
  .object({
    vehicleId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startDateTime: z.coerce.date(),
  })
  .strict();

function getNow(deps: AppointmentServiceDeps): Date {
  return deps.now ?? new Date();
}

// ---------------------------------------------------------------------------
// createAppointment — atomic REPEATABLE READ + SELECT FOR UPDATE (T-028)
// ---------------------------------------------------------------------------

export interface CreateAppointmentInput {
  vehicleId: string;
  serviceId: string;
  startDateTime: Date;
  authUser: AuthUser;
}

export async function createAppointment(
  deps: AppointmentServiceDeps,
  input: CreateAppointmentInput,
): Promise<TurnoDTO> {
  const parsed = createInputSchema.parse({
    vehicleId: input.vehicleId,
    serviceId: input.serviceId,
    startDateTime: input.startDateTime,
  });

  if (!(parsed.startDateTime instanceof Date) || Number.isNaN(parsed.startDateTime.getTime())) {
    throw new ValidationError("invalid startDateTime");
  }

  try {
    const dto = await deps.db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);

      // H-13 order BEFORE lock: ownership -> servicio.active -> duration inclusive
      const vehicle = await findVehiculoById(tx, parsed.vehicleId);
      if (!vehicle) {
        throw new ValidationError(`vehicle "${parsed.vehicleId}" not found`);
      }

      assertOwnership(vehicle.customerId, input.authUser);

      const servicio = await findServicioById(tx, parsed.serviceId);
      if (!servicio) {
        throw new ValidationError(`service "${parsed.serviceId}" not found`);
      }

      if (!servicio.active) {
        throw new InvalidServiceError(`Servicio "${servicio.name}" is not active`);
      }

      const durationResult = calculateEndAndValidate({
        start: parsed.startDateTime,
        durationMinutes: servicio.durationMinutes,
        config: deps.config,
      });
      if (!durationResult.valid) {
        throw durationResult.error ?? new ValidationError("outside operating hours");
      }
      const endDateTime = durationResult.end;

      const cnt = await countActiveOverlappingForUpdate(tx, {
        fromUtc: parsed.startDateTime,
        toUtc: endDateTime,
      });
      if (cnt >= deps.config.capacityPerSlot) {
        throw new AppointmentNotAvailableError(
          "El horario seleccionado ya no se encuentra disponible.",
        );
      }

      const validated = turnoInputSchema.parse({
        clienteId: vehicle.customerId,
        vehiculoId: parsed.vehicleId,
        servicioId: parsed.serviceId,
        fechaHoraInicio: parsed.startDateTime,
        fechaHoraFin: endDateTime,
        estado: "PENDIENTE",
      });

      const [row] = await tx.insert(turnos).values(validated).returning();
      if (!row) {
        throw new Error("INSERT INTO turnos returned no rows");
      }
      return toTurnoDTO(row);
    });
    return dto;
  } catch (error) {
    if (error instanceof AppointmentNotAvailableError) {
      throw error;
    }
    if (hasPgCode(error, PG_CODES.EXCLUSION_VIOLATION)) {
      throw new AppointmentNotAvailableError(
        "El horario seleccionado ya no se encuentra disponible.",
        { cause: error },
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers for status mutations
// ---------------------------------------------------------------------------

async function loadOr404(deps: AppointmentServiceDeps, id: string): Promise<TurnoDTO> {
  uuidSchema.parse(id);
  const turno = await findTurnoById(deps.db as never, id);
  if (!turno) {
    throw new AppointmentNotFoundError(id);
  }
  return turno;
}

function ensureFuture(now: Date, startDateTime: Date): void {
  if (now.getTime() >= startDateTime.getTime()) {
    throw new InvalidAppointmentStateError("El turno ya comenzó");
  }
}

// ---------------------------------------------------------------------------
// confirm / reject — ADMINISTRADOR only via canTransition
// ---------------------------------------------------------------------------

export async function confirmAppointment(
  deps: AppointmentServiceDeps,
  id: string,
  authUser: AuthUser,
): Promise<TurnoDTO> {
  const turno = await loadOr404(deps, id);
  const now = getNow(deps);

  ensureFuture(now, turno.startDateTime);

  if (!canTransition(turno.status as AppointmentStatus, "CONFIRMADO", authUser.role as "CLIENTE" | "ADMINISTRADOR")) {
    throw new InvalidAppointmentStateError(`Cannot transition ${turno.status} -> CONFIRMADO as ${authUser.role}`);
  }

  return updateTurnoStatus(deps.db, id, "CONFIRMADO");
}

export async function rejectAppointment(
  deps: AppointmentServiceDeps,
  id: string,
  authUser: AuthUser,
): Promise<TurnoDTO> {
  const turno = await loadOr404(deps, id);
  const now = getNow(deps);

  ensureFuture(now, turno.startDateTime);

  if (!canTransition(turno.status as AppointmentStatus, "RECHAZADO", authUser.role as "CLIENTE" | "ADMINISTRADOR")) {
    throw new InvalidAppointmentStateError(`Cannot transition ${turno.status} -> RECHAZADO as ${authUser.role}`);
  }

  return updateTurnoStatus(deps.db, id, "RECHAZADO");
}

// ---------------------------------------------------------------------------
// cancel — owner/ADMIN, ownership-first, now < start UTC borders
// ---------------------------------------------------------------------------

export async function cancelAppointment(
  deps: AppointmentServiceDeps,
  id: string,
  authUser: AuthUser,
): Promise<TurnoDTO> {
  const turno = await loadOr404(deps, id);

  // Ownership check first (spec: ownership before time guard)
  assertOwnership(turno.customerId, authUser);

  const now = getNow(deps);
  ensureFuture(now, turno.startDateTime);

  const allowed = canTransition(
    turno.status as AppointmentStatus,
    "CANCELADO",
    authUser.role as "CLIENTE" | "ADMINISTRADOR",
    { now, startDateTime: turno.startDateTime },
  );
  if (!allowed) {
    // Distinguish terminal/invalid vs time — time already checked, so this is state/role
    if (now.getTime() >= turno.startDateTime.getTime()) {
      throw new InvalidAppointmentStateError("El turno ya comenzó");
    }
    throw new InvalidAppointmentStateError(`Cannot transition ${turno.status} -> CANCELADO as ${authUser.role}`);
  }

  return updateTurnoStatus(deps.db, id, "CANCELADO");
}

// ---------------------------------------------------------------------------
// getById / list — ownership + delegation RN-04
// ---------------------------------------------------------------------------

export async function getAppointmentById(
  deps: AppointmentServiceDeps,
  id: string,
  authUser: AuthUser,
): Promise<TurnoDTO> {
  const turno = await loadOr404(deps, id);
  assertOwnership(turno.customerId, authUser);
  return turno;
}

export async function listAppointments(
  deps: AppointmentServiceDeps,
  query: FindTurnosPaginatedQuery,
  authUser: AuthUser,
): Promise<FindTurnosPaginatedResult> {
  const effectiveQuery: FindTurnosPaginatedQuery = { ...query };

  if (authUser.role === "CLIENTE") {
    effectiveQuery.customerId = authUser.id;
  }

  // Inject clock for deterministic pagination now filter when not supplied
  if (!effectiveQuery.now) {
    effectiveQuery.now = getNow(deps);
  }

  return findTurnosPaginated(deps.db, effectiveQuery);
}

/**
 * Upcoming-appointments enriched list (T-045 UI-04).
 *
 * INV-03: `customerId` is INJECTED from `authUser.id` when the caller is
 * a CLIENTE — the caller-supplied value is dropped so a tampered
 * `?customerId=` query can never escalate to another user's appointments
 * (IDOR defense). ADMINISTRADOR keeps whatever `customerId` was supplied
 * (defaults to "all customers") — no ownership gate at the service
 * layer; admin tooling uses the same code path.
 *
 * `now` is forwarded from `deps.now` (DI clock) so tests can pin a
 * deterministic instant and the production path falls back to `new Date()`.
 *
 * `page` / `limit` are forwarded as-is. The page layer is expected to
 * clamp via `parseAppointmentsQuery` before calling this — the repo
 * still validates as a defense in depth.
 */
export async function listAppointmentsEnriched(
  deps: AppointmentServiceDeps,
  query: FindTurnosPaginatedEnrichedQuery,
  authUser: AuthUser,
): Promise<FindTurnosPaginatedEnrichedResult> {
  const effectiveQuery: FindTurnosPaginatedEnrichedQuery = { ...query };

  if (authUser.role === "CLIENTE") {
    // INV-03: customerId injection — caller cannot override the session
    // user. ADMINISTRADOR may pass an explicit `customerId` to filter to
    // a single customer from the admin pending query.
    effectiveQuery.customerId = authUser.id;
  }

  if (!effectiveQuery.now) {
    effectiveQuery.now = getNow(deps);
  }

  return findTurnosPaginatedEnriched(deps.db, effectiveQuery);
}
