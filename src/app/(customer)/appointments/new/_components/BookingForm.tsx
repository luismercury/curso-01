"use client";
/**
 * BookingForm — compound namespace for the booking submit island (T-043 PR2).
 *
 * Wires the final Confirm step in the `/appointments/new` flow. Once all
 * 4 selections resolve (serviceId, date, slot, vehicleId) the page passes
 * them in as plain string props; the island owns the submit lifecycle:
 *
 *   1. `<Summary>` static — read-only 4-row recap (delegated to
 *      SummaryCard). Renders nothing if not composed (defensive — the
 *      page always composes it).
 *   2. `<Submit>` static — `<button type="button" disabled={isPending}
 *      aria-busy={isPending}>` calling `submitBooking`. Belt-and-suspenders
 *      idempotency: the handler short-circuits if `isPending` is already
 *      true; the server enforces `REPEATABLE READ` + `EXCLUDE gist` for
 *      the actual race.
 *   3. `<ErrorBanner>` static — `role="alert"` carrying the human
 *      message mapped from the `ApiError.code`. Auto-dismissed on the
 *      next successful submit (via `setError(null)` in the try block).
 *
 * Error → UI mapping (single source of truth):
 *
 *   201                         → router.push(`/appointments?confirmed=${id}`)
 *                                  (T-044 reads `?confirmed=` to flash the
 *                                  success toast.)
 *   409 APPOINTMENT_NOT_AVAILABLE → "El horario seleccionado ya no se
 *                                  encuentra disponible" + `router.refresh()`
 *                                  so the slot grid re-fetches the
 *                                  authoritative availability.
 *   403 FORBIDDEN               → "Vehicle not found or not owned" +
 *                                  `params.delete("vehicleId")` +
 *                                  `router.refresh()` (a deep-link from
 *                                  another user's URL or a server-side
 *                                  deletion in the meantime).
 *   422 INVALID_SERVICE         → "Service not active" +
 *                                  `params.delete("serviceId")` +
 *                                  `router.push("/services", {scroll:false})`.
 *   401 UNAUTHORIZED            → imperative `window.location.assign("/login
 *                                  ?next=...")` — preserves the booking
 *                                  URL so the user lands back here after
 *                                  signing in.
 *   400 VALIDATION_ERROR        → show the server message verbatim.
 *   NETWORK_ERROR / other      → "Network error. Please try again."
 *
 * INV-04 idempotency: the `isPending` gate is the client-side half of the
 * safety net. The server half lives in
 * `appointmentService.createAppointment` (`REPEATABLE READ` + `EXCLUDE
 * gist` per `route.ts:42-91`). Both layers must be present — the client
 * gate is for UX, the server guard is for correctness.
 *
 * INV-06: `buildBookingStartDateTime(date, slot)` produces
 * `${date}T${slot}:00-03:00` (BA fixed since 2009). The helper lives in
 * `lib/api/appointments.ts` so the TZ assumption is auditable + testable
 * in isolation. Never `new Date(`${date}T${slot}`).toISOString()`.
 *
 * INV-08: only primitive props cross (4 strings + 2 display labels). The
 * 201 response is parsed from `TurnoDTOJson` (camelCase + ISO strings) —
 * never `cliente_id` / `fecha*` / `estado`.
 */
import { createContext, use, useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/validators/service";
import {
  buildBookingStartDateTime,
  buildLoginNext,
  submitBooking,
} from "@/lib/api/appointments";
import { SummaryCard } from "./SummaryCard";
import styles from "../appointments.module.css";

export interface BookingFormProps {
  /** UUID of the chosen active service. */
  serviceId: string;
  /** UUID of the chosen vehicle (owned by the session user — INV-03). */
  vehicleId: string;
  /** YYYY-MM-DD BA calendar string (validated by `dateSchema`). */
  date: string;
  /** HH:mm string on the 30-min step (validated by `slotSchema`). */
  slot: string;
  /** Display label for the chosen service (e.g. `"Oil Change"`). */
  serviceName: string;
  /** Display label for the chosen vehicle (e.g. `"Toyota Corolla (2020) — AB123CD"`). */
  vehicleLabel: string;
  /** Composition children — `<Summary />`, `<Submit />`, `<ErrorBanner />`. */
  children: React.ReactNode;
}

interface BookingFormContextValue {
  isPending: boolean;
  error: string | null;
  serviceName: string;
  vehicleLabel: string;
  date: string;
  slot: string;
  onSubmit: () => Promise<void>;
  clearError: () => void;
}

const BookingFormContext = createContext<BookingFormContextValue | null>(null);

/**
 * Hook consumed by every island in this namespace. Throws if used outside
 * a `<BookingForm>` provider so the failure is loud at render time
 * instead of producing a silently-empty UI — same pattern as
 * `useServiceContext` / `useVehicleContext`.
 */
function useBookingContext(): BookingFormContextValue {
  const ctx = use(BookingFormContext);
  if (!ctx) {
    throw new Error(
      "BookingForm statics must be used inside <BookingForm>",
    );
  }
  return ctx;
}

/**
 * Provider implementation. Owns the submit lifecycle; reads URL/pathname
 * for the 401 redirect target and for the 403/422 sibling-preserving
 * navigations.
 */
export function BookingFormImpl({
  serviceId,
  vehicleId,
  date,
  slot,
  serviceName,
  vehicleLabel,
  children,
}: BookingFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit handler. The component re-renders with `disabled`+`aria-busy`
   * as soon as `isPending` flips; the early-return guards against
   * double-clicks that race the React state update.
   */
  const handleSubmit = useCallback(async () => {
    if (isPending) return; // belt-and-suspenders idempotency
    setIsPending(true);
    setError(null);
    try {
      const dto = await submitBooking({
        vehicleId,
        serviceId,
        startDateTime: buildBookingStartDateTime(date, slot),
      });
      // 201 — T-044 reads `?confirmed=<id>` on `/appointments`.
      // `scroll: false` because the new page is responsible for its own
      // viewport (a success toast anchored at the top of `/appointments`).
      router.push(`/appointments?confirmed=${dto.id}`, { scroll: false });
    } catch (e) {
      if (e instanceof ApiError) {
        switch (e.code) {
          case "APPOINTMENT_NOT_AVAILABLE": {
            // Slot was taken in a race. Show copy + refresh so the grid
            // re-fetches the authoritative availability.
            setError("El horario seleccionado ya no se encuentra disponible");
            router.refresh();
            break;
          }
          case "FORBIDDEN": {
            // Vehicle not owned (server-side check) or deleted in the
            // meantime. Drop the sibling and refresh the RSC so the page
            // re-renders without the stale `?vehicleId=`.
            setError("Vehicle not found or not owned");
            const params = new URLSearchParams(searchParams.toString());
            params.delete("vehicleId");
            const query = params.toString();
            router.push(
              query ? `${pathname}?${query}` : pathname,
              { scroll: false },
            );
            router.refresh();
            break;
          }
          case "INVALID_SERVICE": {
            // Service was deactivated between page-load and submit. Drop
            // the service sibling and bounce the user to the services
            // index so they can pick another one.
            setError("Service not active");
            const params = new URLSearchParams(searchParams.toString());
            params.delete("serviceId");
            const query = params.toString();
            router.push(
              query ? `${pathname}?${query}` : pathname,
              { scroll: false },
            );
            router.push("/services", { scroll: false });
            break;
          }
          case "UNAUTHORIZED": {
            // Cookie missing or expired. Imperative assign() preserves
            // the booking URL via the `next=` query and is deterministic
            // (no Server Action round-trip).
            window.location.assign(
              buildLoginNext(pathname, searchParams.toString()),
            );
            break;
          }
          case "VALIDATION_ERROR": {
            // Server-side Zod failure (e.g. tampered TZ). Show the
            // server's message verbatim — the user probably typed
            // something the URL guard missed.
            setError(e.message);
            break;
          }
          case "NETWORK_ERROR": {
            setError("Network error. Please try again.");
            break;
          }
          default: {
            // Any other 5xx or unmapped code — generic fallback. We keep
            // the banner copy honest so the user knows to retry.
            setError("Could not book the appointment. Please try again.");
            break;
          }
        }
      } else {
        // Defensive — anything that isn't an ApiError is unexpected.
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  }, [
    isPending,
    vehicleId,
    serviceId,
    date,
    slot,
    router,
    pathname,
    searchParams,
  ]);

  const value: BookingFormContextValue = {
    isPending,
    error,
    serviceName,
    vehicleLabel,
    date,
    slot,
    onSubmit: handleSubmit,
    clearError: () => setError(null),
  };

  return (
    <BookingFormContext value={value}>
      <section
        className={styles.bookingSection}
        aria-labelledby="booking-form-heading"
        data-testid="booking-form"
      >
        <h2 id="booking-form-heading" className={styles.bannerTitle}>
          Confirm booking
        </h2>
        {children}
      </section>
    </BookingFormContext>
  );
}

/**
 * `BookingForm.Summary` — static 4-row recap (delegated to SummaryCard).
 * Pure read; no state.
 */
export function BookingFormSummary() {
  const ctx = useBookingContext();
  return (
    <SummaryCard
      serviceName={ctx.serviceName}
      vehicleLabel={ctx.vehicleLabel}
      date={ctx.date}
      slot={ctx.slot}
    />
  );
}

/**
 * `BookingForm.Submit` — `<button type="button">` that triggers the
 * submit pipeline. `disabled` and `aria-busy` reflect `isPending` for
 * idempotency (spec scenario: "Idempotent submit"). The early-return in
 * `handleSubmit` keeps the second click a no-op even if the browser
 * fires both clicks before React commits the `disabled` flip.
 */
export function BookingFormSubmit() {
  const ctx = useBookingContext();
  return (
    <button
      type="button"
      className={
        ctx.isPending
          ? `${styles.submit} ${styles.submitPending}`
          : styles.submit
      }
      onClick={() => {
        void ctx.onSubmit();
      }}
      disabled={ctx.isPending}
      aria-busy={ctx.isPending}
      data-testid="booking-submit"
    >
      {ctx.isPending ? "Booking..." : "Confirm booking"}
    </button>
  );
}

/**
 * `BookingForm.ErrorBanner` — `role="alert"` carrying the latest error
 * message. Renders nothing when there is no error so the layout stays
 * stable. Auto-dismissed by `setError(null)` at the start of every
 * successful submit (so a stale 409 from a previous click never lingers
 * after a 201). The dismiss button clears the error so the user can
 * retry without reloading.
 */
export function BookingFormErrorBanner() {
  const ctx = useBookingContext();
  if (!ctx.error) return null;
  return (
    <div
      role="alert"
      className={`${styles.errorBanner} ${styles.errorBannerDestructive}`}
      data-testid="booking-error"
    >
      <p className={styles.errorBannerBody}>{ctx.error}</p>
      <button
        type="button"
        className={styles.errorBannerDismiss}
        onClick={ctx.clearError}
        aria-label="Dismiss error"
        data-testid="booking-error-dismiss"
      >
        ×
      </button>
    </div>
  );
}

type Compound = typeof BookingFormImpl & {
  Summary: typeof BookingFormSummary;
  Submit: typeof BookingFormSubmit;
  ErrorBanner: typeof BookingFormErrorBanner;
};

/**
 * Compound namespace. Attached statics enable `<BookingForm.Summary />`
 * / `<BookingForm.Submit />` / `<BookingForm.ErrorBanner />` so the page
 * composes without prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export const BookingForm = BookingFormImpl as Compound;
BookingForm.Summary = BookingFormSummary;
BookingForm.Submit = BookingFormSubmit;
BookingForm.ErrorBanner = BookingFormErrorBanner;