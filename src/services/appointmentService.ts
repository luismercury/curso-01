import "server-only";

import { z } from "zod";

import type { DbOrTx } from "@/db";
import type { WorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import type { TurnoDTO } from "@/db/mappers/turno";
import {
  createTurno,
  findTurnoById,
  findTurnosPaginated,
  updateTurnoStatus,
} from "@/db/repositories/turnos";
import type { FindTurnosPaginatedQuery, FindTurnosPaginatedResult } from "@/db/repositories/turnos";
import { findVehiculoById } from "@/db/repositories/vehiculos";
import { findServicioById } from "@/db/repositories/servicios";
import { canTransition } from "@/domain/appointmentStateMachine";
import type { AppointmentStatus } from "@/domain/appointmentStateMachine";
import { calculateEndAndValidate } from "@/services/availability/duration";
import { assertOwnership, ForbiddenError, type AuthUser } from "@/lib/auth/requireAuth";
import { InvalidServiceError } from "@/services/appointmentGuard";
import {
  AppointmentNotFoundError,
  InvalidAppointmentStateError,
} from "@/services/errors";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface AppointmentServiceDeps {
  db: DbOrTx;
  config: Pick<WorkshopConfig, "timezone" | "operatingHours">;
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
// createAppointment — skeleton (no REPEATABLE READ / SELECT FOR UPDATE)
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

  const vehicle = await findVehiculoById(deps.db, parsed.vehicleId);
  if (!vehicle) {
    throw new ValidationError(`vehicle "${parsed.vehicleId}" not found`);
  }

  // Ownership-first per INV-03: vehiculo.customerId == authUser.id unless ADMIN
  assertOwnership(vehicle.customerId, input.authUser);

  const servicio = await findServicioById(deps.db as never, parsed.serviceId);
  if (!servicio) {
    throw new ValidationError(`service "${parsed.serviceId}" not found`);
  }

  if (!servicio.active) {
    throw new InvalidServiceError(`Servicio "${servicio.name}" is not active`);
  }

  // INV-05 inclusive closure via duration helper (DI config.timezone, 400 not 409)
  const durationResult = calculateEndAndValidate({
    start: parsed.startDateTime,
    durationMinutes: servicio.durationMinutes,
    config: deps.config,
  });
  if (!durationResult.valid) {
    throw durationResult.error ?? new ValidationError("outside operating hours");
  }

  // TODO T-028: wrap in REPEATABLE READ + SELECT FOR UPDATE atomically
  // Skeleton only validates preconditions; concurrency deferred.

  const dto = await createTurno(
    deps.db as never,
    {
      customerId: vehicle.customerId,
      vehicleId: parsed.vehicleId,
      serviceId: parsed.serviceId,
      startDateTime: parsed.startDateTime,
      status: "PENDIENTE",
    },
    deps.config,
  );

  return dto;
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
