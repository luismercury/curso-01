"use client";
/**
 * AppointmentList — compound namespace for the upcoming-appointments
 * screen (T-045 UI-04 + T-046 cancel affordance).
 *
 * Composition (no boolean props, no isCancellable doubling):
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
 * T-046 PR-B adds `CancelAction` (per card) + `CancelDialog` (shared
 * at Root, 1b variant of design D01) as **explicit subcomponents** —
 * never an `isCancellable` boolean on Card
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 * The native `<dialog>` element provides focus trap, ESC, and
 * inertness via `showModal()` — we never re-implement them
 * (WCAG 2.4.7 + 2.5.8).
 *
 * INV-02: `canCancel` mirrors server `canTransition`; the server is
 * truth (assertOwnership → ensureFuture → canTransition).
 * INV-06: ISO 8601 strings cross the RSC → client boundary; BA
 * wall-clock copy via `Intl.DateTimeFormat({ timeZone: ctx.timezone })`;
 * `canCancel` compares `Date#getTime()` UTC ms.
 * INV-08: only camelCase + ISO primitives cross the boundary; tests
 * assert this with a `SNAKE` negative scan extended in PR-B to cover
 * the dialog. The `useAppointment()` + `useCancel()` guards throw
 * loudly when a subcomponent is used outside `<AppointmentList.Root>`.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  buildLoginNext,
  cancelAppointment,
  canCancel,
  type EnrichedTurnoDTOJson,
} from "@/lib/api/appointments";
import { ApiError } from "@/lib/validators/service";

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

// ---------------------------------------------------------------------------
// T-046 — Cancel affordance (REQ-06/07/08/09, D01..D07).
//
// 1b variant (design D01 Choice): the dialog state lives in a
// `CancelContext` so a single `<dialog>` mounts at Root, not one per
// card. Card renders only the `CancelAction` trigger; the dialog reads
// `currentAppointment` from the context and acts on whichever row the
// user picked.
//
// Map error → user copy switches on `body.error.code` (NOT status, per
// design D06) so the UI stays stable when the server envelope evolves.
// The 409 border case (`now >= start`) renders the exact copy
// `"El turno ya comenzó"` (REQ-09, GWT 9.5) so a tampered page can be
// matched against the spec line-for-line.
// ---------------------------------------------------------------------------

interface CancelContextValue {
  /** The appointment the dialog is acting on; `null` when closed. */
  currentAppointment: EnrichedTurnoDTOJson | null;
  /** ID of the appointment whose PATCH is in flight, else `null`. */
  pendingId: string | null;
  /** True while a `startTransition` is awaiting `cancelAppointment`. */
  isTransitionPending: boolean;
  /** Last error from `cancelAppointment` (mapped copy), or `null`. */
  error: ApiError | null;
  /** Polite announcement rendered after success, or `null`. */
  successMessage: string | null;
  actions: {
    open: (appointment: EnrichedTurnoDTOJson) => void;
    close: () => void;
    confirm: () => void;
  };
}

const CancelContext = createContext<CancelContextValue | null>(null);

/**
 * Mirror of `useAppointment()` for the cancel subcomponents. Throws if
 * used outside a `<AppointmentList.Root>` provider.
 */
function useCancel(): CancelContextValue {
  const ctx = use(CancelContext);
  if (ctx === null) {
    throw new Error("AppointmentList.Cancel* must be used inside <AppointmentList.Root>");
  }
  return ctx;
}

/**
 * Pure message-mapper. Switches on `body.error.code` (NOT status) per
 * design D06. The 409 border branch (server-reported
 * `INVALID_APPOINTMENT_STATE` with `now >= startDateTime`) is
 * rewritten to the EXACT copy `"El turno ya comenzó"` required by
 * REQ-09 / GWT 9.5. Anything else falls back to the server message
 * (carries the original code + status on the `ApiError`).
 *
 * Never throws; returns a new `ApiError` so the caller can `setError`
 * it directly.
 */
function mapError(e: ApiError, target: EnrichedTurnoDTOJson): ApiError {
  if (e.code === "FORBIDDEN") {
    return new ApiError({
      code: e.code,
      message: "No tienes permiso para cancelar este turno.",
      status: e.status,
    });
  }
  if (e.code === "NOT_FOUND" || e.code === "APPOINTMENT_NOT_FOUND") {
    return new ApiError({
      code: e.code,
      message: "El turno no existe.",
      status: e.status,
    });
  }
  if (e.code === "INVALID_APPOINTMENT_STATE") {
    const startedAlready = new Date(target.startDateTime).getTime() <= Date.now();
    if (startedAlready) {
      return new ApiError({
        code: e.code,
        message: "El turno ya comenzó",
        status: e.status,
      });
    }
    return new ApiError({
      code: e.code,
      message: "El turno ya no puede cancelarse.",
      status: e.status,
    });
  }
  return e;
}

/**
 * Cancel provider — owns the `currentAppointment / pendingId / error /
 * successMessage` state machine and exposes three actions
 * (`open / close / confirm`). `confirm` wraps `cancelAppointment` in
 * `useTransition` so the UI can disable the trigger + dialog Confirm
 * while the PATCH is in flight (guards double-`409` per design D05 +
 * REQ-08).
 */
function CancelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentAppointment, setCurrentAppointment] = useState<EnrichedTurnoDTOJson | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTransitionPending, startTransition] = useTransition();

  const close = useCallback(() => {
    setCurrentAppointment(null);
    setError(null);
  }, []);

  const open = useCallback((appointment: EnrichedTurnoDTOJson) => {
    setError(null);
    setSuccessMessage(null);
    setCurrentAppointment(appointment);
  }, []);

  /**
   * Move focus after a successful cancel. Per REQ-09 the row is gone
   * after `router.refresh()`; the trigger that opened the dialog is
   * also gone. Prefer the page heading; fall back to the next
   * `Cancelar` button; fall back to nothing.
   */
  const focusAfterRemoval = useCallback((removedId: string) => {
    requestAnimationFrame(() => {
      const heading = document.getElementById("appointments-heading");
      if (heading !== null) {
        heading.focus();
        return;
      }
      const triggers = document.querySelectorAll<HTMLButtonElement>(
        '[data-testid="appointment-cancel"]',
      );
      for (const trigger of triggers) {
        if (trigger.getAttribute("data-appointment-id") !== removedId) {
          trigger.focus();
          return;
        }
      }
    });
  }, []);

  const confirm = useCallback(() => {
    if (currentAppointment === null) return;
    const target = currentAppointment;
    setPendingId(target.id);
    setError(null);
    startTransition(async () => {
      try {
        await cancelAppointment(target.id);
        setCurrentAppointment(null);
        setPendingId(null);
        setSuccessMessage("Turno cancelado");
        router.refresh();
        focusAfterRemoval(target.id);
      } catch (caught: unknown) {
        setPendingId(null);
        if (caught instanceof ApiError) {
          if (caught.code === "UNAUTHORIZED") {
            const next = buildLoginNext(pathname, searchParams.toString());
            window.location.assign(next);
            return;
          }
          setError(mapError(caught, target));
          return;
        }
        // Non-ApiError — surface the original message verbatim.
        setError(
          new ApiError({
            code: "UNKNOWN_ERROR",
            message: caught instanceof Error ? caught.message : "Error inesperado",
            status: 0,
          }),
        );
      }
    });
  }, [currentAppointment, focusAfterRemoval, pathname, router, searchParams]);

  const value = useMemo<CancelContextValue>(
    () => ({
      currentAppointment,
      pendingId,
      isTransitionPending,
      error,
      successMessage,
      actions: { open, close, confirm },
    }),
    [currentAppointment, pendingId, isTransitionPending, error, successMessage, open, close, confirm],
  );

  return <CancelContext value={value}>{children}</CancelContext>;
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
  return (
    <AppointmentListContext value={value}>
      <CancelProvider>
        {children}
        <AppointmentListCancelDialog />
        <AppointmentListCancelLiveRegions />
      </CancelProvider>
    </AppointmentListContext>
  );
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
      <div className={styles.cardActions}>
        <AppointmentListStatusBadge status={appointment.status} />
        <AppointmentList.CancelAction appointment={appointment} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// T-046 PR-B — CancelAction + CancelDialog.
//
// `CancelAction` is the per-card trigger; it consults `canCancel`
// (REQ-06, INV-02/06) and renders `null` when the appointment is in a
// terminal state or already started. When the row IS eligible, the
// button opens the shared dialog via `actions.open(appointment)` and
// reflects `isPending` from the context (disables itself + sets
// `aria-busy` so the user can't fire a second PATCH while the first
// is in flight).
//
// `CancelDialog` mounts once at Root (1b variant of design D01). The
// native `<dialog>` element gives us focus trap, ESC-to-close, and
// inertness for free via `showModal()` — we never re-implement any of
// those. `useEffect` syncs the `open` attribute to the React state
// (`currentAppointment !== null`).
// ---------------------------------------------------------------------------

interface AppointmentListCancelActionProps {
  appointment: EnrichedTurnoDTOJson;
}

/**
 * `CancelAction` — per-card `Cancelar` trigger (REQ-06, REQ-07).
 *
 * Renders only when `canCancel(appointment)` is true. The button is
 * `disabled` + `aria-busy` while the PATCH for THIS row is in flight
 * (other rows stay enabled so the user can pick a different target).
 * `data-appointment-id` is exposed for the focus-shift fallback in
 * `focusAfterRemoval`.
 */
function AppointmentListCancelAction({ appointment }: AppointmentListCancelActionProps) {
  const { actions, pendingId, isTransitionPending } = useCancel();
  if (!canCancel(appointment)) return null;
  const isPending = isTransitionPending && pendingId === appointment.id;
  return (
    <button
      type="button"
      className={styles.cancelTrigger}
      data-testid="appointment-cancel"
      data-appointment-id={appointment.id}
      aria-label="Cancelar turno"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => actions.open(appointment)}
    >
      {isPending ? "Cancelando…" : "Cancelar"}
    </button>
  );
}

/**
 * `CancelDialog` — the single shared confirmation dialog (REQ-07,
 * REQ-09). Native `<dialog>` + `showModal()` provides focus trap, ESC,
 * and inertness; the `onClose` handler is the only manual hook (so we
 * can clear `currentAppointment` when the user dismisses with ESC or
 * by clicking the backdrop).
 *
 * Error rendering uses `role="alert"` + `aria-live="assertive"` so a
 * screen reader announces the failure immediately. Success uses a
 * separate polite live region at Root (kept outside the dialog so the
 * announcement persists after the dialog closes).
 */
function AppointmentListCancelDialog() {
  const { currentAppointment, error, isTransitionPending, actions } = useCancel();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg === null) return;
    if (currentAppointment !== null && !dlg.open) {
      dlg.showModal();
    } else if (currentAppointment === null && dlg.open) {
      dlg.close();
    }
  }, [currentAppointment]);

  const open = currentAppointment !== null;
  // Volver (cancel) is the first focusable so the safer action is the
  // default. Confirmar is one Tab away. While a PATCH is in flight
  // both are disabled — guards double-cancel (REQ-08).
  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className={styles.dialog}
      data-testid="cancel-dialog"
      data-open={open ? "true" : "false"}
      onClose={() => {
        if (!isTransitionPending) actions.close();
      }}
    >
      {open && currentAppointment !== null ? (
        <div className={styles.dialogInner}>
          <h2 id={titleId} className={styles.dialogTitle} data-testid="cancel-dialog-title">
            ¿Cancelar este turno?
          </h2>
          <p className={styles.dialogMessage} data-testid="cancel-dialog-message">
            Vas a cancelar tu turno de <strong>{currentAppointment.serviceName}</strong> el día{" "}
            {new Date(currentAppointment.startDateTime).toLocaleDateString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
            . Esta acción no se puede deshacer.
          </p>
          {error !== null ? (
            <p
              className={styles.alertError}
              role="alert"
              aria-live="assertive"
              data-testid="cancel-dialog-error"
              data-error-code={error.code}
            >
              {error.message}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogCancel}
              data-testid="cancel-dialog-cancel"
              onClick={() => actions.close()}
              disabled={isTransitionPending}
            >
              Volver
            </button>
            <button
              type="button"
              className={styles.dialogConfirm}
              data-testid="cancel-dialog-confirm"
              onClick={() => actions.confirm()}
              disabled={isTransitionPending}
              aria-busy={isTransitionPending}
            >
              {isTransitionPending ? "Cancelando…" : "Confirmar"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * `CancelLiveRegions` — visually hidden polite live region for the
 * success announcement. Lives outside the dialog so the message
 * persists after the dialog closes. `aria-live="polite"` lets the
 * screen reader finish the user's current utterance before announcing.
 */
function AppointmentListCancelLiveRegions() {
  const { successMessage } = useCancel();
  return (
    <p
      className={styles.politeLive}
      aria-live="polite"
      aria-atomic="true"
      data-testid="cancel-polite-live"
    >
      {successMessage ?? ""}
    </p>
  );
}

// ---------------------------------------------------------------------------
// PR2c — Pagination. Lands in this slice.
//
// Composition pattern: Pagination reads `pagination` from the Root context
// and pushes URL updates via `next/navigation`. It renders nothing when
// the result fits on a single page (totalPages ≤ 1) so the page never
// shows "Página 1 de 1".
// ---------------------------------------------------------------------------

/**
 * `Pagination` — URL-driven `?page&limit` controls. Clicking prev/next
 * pushes the new `?page` value while preserving every other URL sibling
 * (`serviceId`, `vehicleId`, `confirmed`, etc.) — same precedent as
 * DateSelector + BookingConfirmation.Dismiss.
 */
function AppointmentListPaginationInternal() {
  const { pagination } = useAppointment();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (targetPage <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(targetPage));
      }
      const query = params.toString();
      router.push(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Paginación"
      className={styles.pagination}
      data-testid="appointments-pagination"
    >
      <button
        type="button"
        className={styles.paginationButton}
        onClick={() => goTo(page - 1)}
        disabled={!hasPrev}
        data-testid="pagination-prev"
        aria-label="Página anterior"
      >
        Anterior
      </button>
      <span className={styles.paginationLabel} data-testid="pagination-label">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        className={styles.paginationButton}
        onClick={() => goTo(page + 1)}
        disabled={!hasNext}
        data-testid="pagination-next"
        aria-label="Página siguiente"
      >
        Siguiente
      </button>
    </nav>
  );
}

type AppointmentListCompound = {
  Root: typeof AppointmentListRoot;
  Card: typeof AppointmentListCard;
  Badge: {
    PendingBadge: typeof AppointmentListPendingBadge;
    ConfirmedBadge: typeof AppointmentListConfirmedBadge;
  };
  Empty: typeof AppointmentListEmpty;
  Pagination: typeof AppointmentListPaginationInternal;
  Skeleton: typeof AppointmentListSkeleton;
  CancelAction: typeof AppointmentListCancelAction;
  CancelDialog: typeof AppointmentListCancelDialog;
};

/**
 * Compound namespace. Attached statics enable
 * `<AppointmentList.Card />` / `<AppointmentList.Empty />` etc. so the
 * page composes without prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 *
 * T-046 PR-B: `CancelAction` + `CancelDialog` are explicit variants,
 * NOT gated by an `isCancellable` boolean on Card — eligibility lives
 * inside `CancelAction` so the public Card API stays a single DTO.
 */
export const AppointmentList: AppointmentListCompound = {
  Root: AppointmentListRoot,
  Card: AppointmentListCard,
  Badge: {
    PendingBadge: AppointmentListPendingBadge,
    ConfirmedBadge: AppointmentListConfirmedBadge,
  },
  Empty: AppointmentListEmpty,
  Pagination: AppointmentListPaginationInternal,
  Skeleton: AppointmentListSkeleton,
  CancelAction: AppointmentListCancelAction,
  CancelDialog: AppointmentListCancelDialog,
};