import "server-only";

import { ValidationError } from "@/config/workshopSchedule";

/**
 * Canonical active-status filter — single source of truth for both
 * the pure in-memory helper and the future DB adapter
 * `countOverlappingInTx` (T-028).
 *
 * Only PENDIENTE and CONFIRMADO count toward overlap (RN-04).
 * RECHAZADO and CANCELADO are ignored even when their intervals overlap.
 */
export const ACTIVE_STATUSES = ["PENDIENTE", "CONFIRMADO"] as const;

export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export type Interval = {
  start: Date;
  end: Date;
};

export type ExistingEntry = {
  start: Date;
  end: Date;
  status: string;
};

export type OverlapOptions = {
  activeStatuses?: readonly string[];
};

function assertValidInterval(interval: Interval, label = "interval"): void {
  if (
    !(interval.start instanceof Date) ||
    Number.isNaN(interval.start.getTime()) ||
    !(interval.end instanceof Date) ||
    Number.isNaN(interval.end.getTime())
  ) {
    throw new ValidationError(`${label} contains Invalid Date`);
  }
  if (interval.end.getTime() <= interval.start.getTime()) {
    throw new ValidationError(`${label} end must be after start`);
  }
}

/**
 * Half-open [) overlap predicate matching PostgreSQL `tstzrange &&`.
 *
 * Returns true iff a.start < b.end && b.start < a.end via UTC getTime().
 * Adjacent intervals (e.g. 09:00-10:00 and 10:00-11:00) do NOT overlap.
 * Symmetric and pure; no wall-time string comparison.
 *
 * Throws ValidationError (400) on Invalid Date or end <= start.
 */
export function isOverlapping(a: Interval, b: Interval): boolean {
  assertValidInterval(a, "a");
  assertValidInterval(b, "b");
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Count how many existing appointments overlap requested, filtered to
 * active statuses. Comparison is UTC via getTime() only.
 *
 * Filters existing to opts.activeStatuses ?? ACTIVE_STATUSES, then
 * counts entries where isOverlapping(requested, entry) is true.
 *
 * Throws ValidationError (400) if requested is invalid (end <= start or NaN).
 */
export function countOverlapping(
  requested: Interval,
  existing: ExistingEntry[],
  opts?: OverlapOptions,
): number {
  assertValidInterval(requested, "requested");
  const active = opts?.activeStatuses ?? ACTIVE_STATUSES;
  const activeSet = new Set<string>(active as readonly string[]);

  let count = 0;
  for (const entry of existing) {
    if (!activeSet.has(entry.status)) continue;
    // Delegate to isOverlapping for half-open semantics and validation
    // of active entries; inactive entries already skipped.
    if (isOverlapping(requested, { start: entry.start, end: entry.end })) {
      count++;
    }
  }
  return count;
}

/**
 * Availability check: slot is available when overlapping active count
 * is strictly less than capacityPerSlot (count-based, not boolean flag — INV-01).
 *
 * @param requested - desired interval [start, end)
 * @param existing - existing turnos with status
 * @param capacityPerSlot - required via DI (Pick<WorkshopConfig,'capacityPerSlot'>), int >=1
 * @param opts - optional activeStatuses override (defaults to ACTIVE_STATUSES)
 * @returns true if count < capacityPerSlot
 * @throws ValidationError (400) on invalid requested, invalid capacity (<1, non-int, NaN)
 *
 * Caller maps `false` -> DomainError('APPOINTMENT_NOT_AVAILABLE') -> HTTP 409,
 * distinct from 400 for duration/closure validation (T-022).
 */
export function isSlotAvailable(
  requested: Interval,
  existing: ExistingEntry[],
  capacityPerSlot: number,
  opts?: OverlapOptions,
): boolean {
  if (
    typeof capacityPerSlot !== "number" ||
    Number.isNaN(capacityPerSlot) ||
    !Number.isInteger(capacityPerSlot) ||
    capacityPerSlot < 1
  ) {
    throw new ValidationError(`capacityPerSlot must be integer >=1, got ${String(capacityPerSlot)}`);
  }
  return countOverlapping(requested, existing, opts) < capacityPerSlot;
}

/**
 * DB adapter contract for T-028 — NOT implemented in T-023.
 *
 * Intended implementation:
 * ```sql
 * -- REPEATABLE READ transaction
 * SELECT COUNT(*) FROM turnos
 * WHERE tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($start,$end)
 *   AND estado IN (ACTIVE_STATUSES) -- ('PENDIENTE','CONFIRMADO')
 * FOR UPDATE;
 * -- + EXCLUDE USING gist (tstzrange(...) WITH &&) WHERE estado IN (...) enforces capacity=1 at DB level
 * -- For capacity>1 the count < capacity check is authoritative.
 * ```
 */
