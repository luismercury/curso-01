import { z } from "zod";

/**
 * Appointment state machine — pure domain, zero DB dependencies.
 * Owns RN-07 / INV-02: only PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO.
 * Frozen enum via Zod for parse-time rejection.
 */

export const AppointmentStatus = [
  "PENDIENTE",
  "CONFIRMADO",
  "RECHAZADO",
  "CANCELADO",
] as const;

export type AppointmentStatus = (typeof AppointmentStatus)[number];

export const AppointmentStatusSchema = z.enum(AppointmentStatus);

export type Role = "CLIENTE" | "ADMINISTRADOR";

/**
 * RN-07 transition matrix.
 * - PENDIENTE -> CONFIRMADO | RECHAZADO : ADMINISTRADOR only
 * - PENDIENTE -> CANCELADO              : CLIENTE (owner) or ADMINISTRADOR, if future
 * - CONFIRMADO -> CANCELADO             : CLIENTE (owner) or ADMINISTRADOR, if future
 * - RECHAZADO / CANCELADO               : terminal, no outgoing
 * Time guard (now < startDateTime) is enforced when opts are provided;
 * service layer also enforces it separately for border precision.
 */
const TRANSITIONS: Record<
  AppointmentStatus,
  Partial<Record<AppointmentStatus, readonly Role[]>>
> = {
  PENDIENTE: {
    CONFIRMADO: ["ADMINISTRADOR"] as const,
    RECHAZADO: ["ADMINISTRADOR"] as const,
    CANCELADO: ["CLIENTE", "ADMINISTRADOR"] as const,
  },
  CONFIRMADO: {
    CANCELADO: ["CLIENTE", "ADMINISTRADOR"] as const,
  },
  RECHAZADO: {},
  CANCELADO: {},
};

export const allowedTransitions = TRANSITIONS;

export function isTerminal(status: AppointmentStatus): boolean {
  return status === "RECHAZADO" || status === "CANCELADO";
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: Role,
  opts?: { now?: Date; startDateTime?: Date }
): boolean {
  if (isTerminal(from)) {
    return false;
  }

  const allowedRoles = TRANSITIONS[from]?.[to];
  if (!allowedRoles) {
    return false;
  }

  if (!allowedRoles.includes(role)) {
    return false;
  }

  // Optional time guard for cancel paths: when both dates are provided
  // enforce strict future check via UTC getTime() (INV-06).
  if (to === "CANCELADO" && opts?.now && opts?.startDateTime) {
    return opts.now.getTime() < opts.startDateTime.getTime();
  }

  return true;
}
