"use client";
/**
 * AppointmentList — compound namespace for the upcoming-appointments
 * screen (T-045 UI-04).
 *
 * PR2a (this commit): scaffolds the namespace with Root (provider),
 * Empty (zero-state), and Skeleton (loading placeholder). Card, Badge,
 * and Pagination are no-op stubs — they return `null` so the namespace
 * shape + typecheck stay consistent while the rest of the compound
 * lands across the PR2b/PR2c/PR2d stacked chain.
 *
 * Forced-fragmentation note (T-045 PR2 chain):
 * The original single-file compound was split across 4 stacked PRs by
 * maintainer request (size budget <400 lines per PR). Card lands in
 * PR2b, Pagination in PR2c, and the page.tsx RSC integration in PR2d.
 * In this intermediate slice, Card / Badge / Pagination are placeholders
 * — UI tests for them are skipped until the corresponding slice lands.
 *
 * Composition (no boolean props, no isPending doubling):
 *
 *   <AppointmentList.Root timezone={tz} pagination={p}>
 *     {list.length === 0 ? (
 *       <AppointmentList.Empty />
 *     ) : (
 *       <>
 *         <ol data-testid="appointments-list" role="list">
 *           {list.map((a) => (
 *             <AppointmentList.Card key={a.id} appointment={a} />
 *           ))}
 *         </ol>
 *         <AppointmentList.Pagination />
 *       </>
 *     )}
 *   </AppointmentList.Root>
 *
 * INV-06: every date crosses the boundary as an ISO 8601 string;
 * `Intl.DateTimeFormat({ timeZone: ctx.timezone })` produces the BA
 * wall-clock copy. `suppressHydrationWarning` on the <time> elements
 * shields against the env-Intl-vs-server-Intl mismatch flagged by
 * React 19 hydration.
 *
 * INV-08: only camelCase + ISO primitives cross the RSC → client
 * boundary (`EnrichedTurnoDTOJson`). The compound never renders
 * snake_case keys; tests assert this with a `SNAKE` negative scan
 * (added in PR2b once Card ships and snake can leak through it).
 *
 * The `useAppointment()` guard mirrors `BookingConfirmation.useCtx` —
 * throwing inside a subcomponent used outside Root produces a loud
 * render error instead of a silently empty UI.
 */
import { createContext, use, useMemo } from "react";
import type { EnrichedTurnoDTOJson } from "@/lib/api/appointments";

import styles from "../appointments.module.css";

/**
 * Pagination envelope mirroring `FindTurnosPaginatedEnrichedResult`
 * (`src/db/repositories/turnos.ts`). Inlined so this file stays
 * client-safe — no `server-only` import, no Drizzle references.
 */
export interface AppointmentListPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AppointmentListContextValue {
  /** IANA timezone forwarded from `getWorkshopConfig(db)` (INV-06). */
  timezone: string;
  /** `dd/mm/yyyy` formatter — BA wall-clock date column. */
  dateFormatter: Intl.DateTimeFormat;
  /** `HH:mm` 24h formatter — BA wall-clock time column. */
  timeFormatter: Intl.DateTimeFormat;
  /** Pagination envelope — page/limit/total/totalPages for the controls. */
  pagination: AppointmentListPaginationMeta;
}

const AppointmentListContext = createContext<AppointmentListContextValue | null>(null);

/**
 * Hook every island consumes. Throws if used outside a
 * `<AppointmentList.Root>` provider so the failure is loud at render
 * time instead of producing a silently-empty UI.
 */
export function useAppointment(): AppointmentListContextValue {
  const ctx = use(AppointmentListContext);
  if (ctx === null) {
    throw new Error("AppointmentList subcomponents must be used inside <AppointmentList.Root>");
  }
  return ctx;
}

interface AppointmentListRootProps {
  /** IANA timezone (e.g. `America/Argentina/Buenos_Aires`). */
  timezone: string;
  /** Pagination envelope from the data layer. */
  pagination: AppointmentListPaginationMeta;
  /** Composed subcomponents — Empty / Card-list / Pagination / Skeleton. */
  children: React.ReactNode;
}

/**
 * Root provider. Owns the Intl formatters so every consumer formats
 * with the SAME instances — no per-render allocations, no timezone
 * drift. Children compose freely via the exposed subcomponents.
 */
function AppointmentListRoot({ timezone, pagination, children }: AppointmentListRootProps) {
  // Memoize the formatters on `timezone` only — the locale (`es-AR`) is
  // stable for this app. Using `es-AR` gives `dd/mm/yyyy` and 24-hour
  // `HH:mm` without forcing callers to remember the options.
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [timezone],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [timezone],
  );
  const value = useMemo<AppointmentListContextValue>(
    () => ({ timezone, dateFormatter, timeFormatter, pagination }),
    [timezone, dateFormatter, timeFormatter, pagination],
  );
  return <AppointmentListContext value={value}>{children}</AppointmentListContext>;
}

/**
 * `Empty` — zero-state panel. Rendered by the page when
 * `appointments.length === 0`. The text matches the spec
 * ("No tienes turnos próximos") and the data-testid matches the page
 * test selector.
 */
function AppointmentListEmpty() {
  return (
    <p
      className={styles.appointmentsListEmpty}
      data-testid="appointments-empty"
      role="status"
    >
      No tienes turnos próximos.
    </p>
  );
}

/**
 * `Skeleton` — loading placeholder. Mounted when the page wants to
 * defer the list to a separate Suspense boundary (the page keeps the
 * Suspense around `BookingConfirmation`; the list itself renders
 * synchronously today, but exposing the Skeleton keeps the door open
 * for the streaming story without a follow-up refactor).
 */
function AppointmentListSkeleton() {
  return (
    <div
      className={styles.skeleton}
      data-testid="appointments-skeleton"
      aria-busy="true"
      aria-live="polite"
    />
  );
}

// ---------------------------------------------------------------------------
// PR2b — Card + Badge.{PendingBadge,ConfirmedBadge}. Lands in this slice.
//
// PR2c adds Pagination (still a no-op stub in this slice).
// ---------------------------------------------------------------------------

/**
 * `PendingBadge` — amber pill for `PENDIENTE` turns. Exposed as a
 * named subcomponent (no boolean prop on a generic Badge) so the
 * variant visual contract is a single rule in CSS Modules.
 */
function AppointmentListPendingBadge() {
  return (
    <span
      className={styles.badgePending}
      role="status"
      aria-label="Estado: PENDIENTE"
      data-testid="appointment-status"
      data-status="PENDIENTE"
    >
      PENDIENTE
    </span>
  );
}

/**
 * `ConfirmedBadge` — green pill for `CONFIRMADO` turns. Mirrors the
 * `PendingBadge` contract.
 */
function AppointmentListConfirmedBadge() {
  return (
    <span
      className={styles.badgeConfirmed}
      role="status"
      aria-label="Estado: CONFIRMADO"
      data-testid="appointment-status"
      data-status="CONFIRMADO"
    >
      CONFIRMADO
    </span>
  );
}

/**
 * Status dispatcher consumed internally by `AppointmentListCard`. Maps
 * `PENDIENTE | CONFIRMADO` to the matching variant. Anything else
 * renders nothing — REQ-03 enforces PENDIENTE | CONFIRMADO at the
 * repo layer (RN-04), so a stray `CANCELADO` / `RECHAZADO` never
 * reaches the client list.
 */
function AppointmentListStatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMADO") return <AppointmentListConfirmedBadge />;
  if (status === "PENDIENTE") return <AppointmentListPendingBadge />;
  return null;
}

interface AppointmentListCardProps {
  appointment: EnrichedTurnoDTOJson;
}

/**
 * `Card` — one <li> row. Renders Fecha, Horario (`Intl` with the
 * `timezone` from context), Servicio, Vehículo, and the matching
 * badge variant. `suppressHydrationWarning` on the <time> elements
 * because env-Intl-vs-server-Intl can disagree on a one-hour boundary
 * in rare DST edge cases — INV-06 makes BA DST-free so the actual
 * values match; the hint just silences the React 19 warning.
 *
 * `data-service-name` + `data-vehicle-label` are exposed as data
 * attributes (not just rendered text) so test selectors + downstream
 * scrapers can read the values without re-parsing visible copy.
 */
function AppointmentListCard({ appointment }: AppointmentListCardProps) {
  const { dateFormatter, timeFormatter } = useAppointment();
  const start = new Date(appointment.startDateTime);
  const end = new Date(appointment.endDateTime);
  const startText = dateFormatter.format(start);
  const timeText = `${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  return (
    <li
      role="listitem"
      className={styles.card}
      data-testid="appointment-item"
      data-service-name={appointment.serviceName}
      data-vehicle-label={appointment.vehicleLabel}
      data-appointment-id={appointment.id}
    >
      <div className={styles.cardDateRow}>
        <time
          dateTime={appointment.startDateTime}
          className={styles.cardDate}
          data-testid="card-date"
          suppressHydrationWarning
        >
          {startText}
        </time>
        <time
          dateTime={appointment.startDateTime}
          className={styles.cardTime}
          data-testid="card-time"
          suppressHydrationWarning
        >
          {timeText}
        </time>
      </div>
      <div className={styles.cardService} data-testid="card-service">
        {appointment.serviceName}
      </div>
      <div className={styles.cardVehicle} data-testid="card-vehicle">
        {appointment.vehicleLabel}
      </div>
      <AppointmentListStatusBadge status={appointment.status} />
    </li>
  );
}

// PR2c lands Pagination. Stub returns null in this slice.
const AppointmentListPagination = (): null => null;

type AppointmentListCompound = {
  Root: typeof AppointmentListRoot;
  Card: typeof AppointmentListCard;
  Badge: {
    PendingBadge: typeof AppointmentListPendingBadge;
    ConfirmedBadge: typeof AppointmentListConfirmedBadge;
  };
  Empty: typeof AppointmentListEmpty;
  Pagination: typeof AppointmentListPagination;
  Skeleton: typeof AppointmentListSkeleton;
};

/**
 * Compound namespace. Attached statics enable
 * `<AppointmentList.Card />` / `<AppointmentList.Empty />` etc. so the
 * page composes without prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export const AppointmentList: AppointmentListCompound = {
  Root: AppointmentListRoot,
  Card: AppointmentListCard,
  Badge: {
    PendingBadge: AppointmentListPendingBadge,
    ConfirmedBadge: AppointmentListConfirmedBadge,
  },
  Empty: AppointmentListEmpty,
  Pagination: AppointmentListPagination,
  Skeleton: AppointmentListSkeleton,
};