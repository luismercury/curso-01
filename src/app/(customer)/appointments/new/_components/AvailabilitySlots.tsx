"use client";
/**
 * AvailabilitySlots — compound namespace for the availability selection
 * island (T-042 design §A+C1).
 *
 * URL is the source of truth for the selection (`?slot=HH:mm`). The compound:
 *   1. Reads `slot` from `useSearchParams()` and validates with
 *      `slotSchema` (INV-05 step 30) plus an `includes(slots)` guard so a
 *      tampered or stale `?slot=` never desyncs from the resolved grid.
 *   2. Exposes a `selectSlot(hhmm)` callback that writes the URL via
 *      `router.push("?serviceId=…&date=…&vehicleId=…&slot=…", { scroll: false })`,
 *      preserving siblings (T-043 reads them verbatim). Empty `hhmm` deletes
 *      the `slot` param.
 *   3. Stores the resolved state in a React 19 context that the
 *      `AvailabilitySlots.Grid` / `AvailabilitySlots.Empty` /
 *      `AvailabilitySlots.SelectedBanner` islands consume via
 *      `use(AvailabilitySlotsContext)`.
 *
 * Composition (no boolean props):
 *
 *   <AvailabilitySlots
 *     slots={availableSlots} date={selectedDate}
 *     serviceId={selectedService.id} vehicleId={vehicleId}
 *     closedDows={closedDows} timezone={tz}
 *   >
 *     <AvailabilitySlots.Grid />
 *     <AvailabilitySlots.Empty />
 *     <AvailabilitySlots.SelectedBanner />
 *   </AvailabilitySlots>
 *
 * INV-08: only primitives cross the boundary (camelCase strings, no Date
 * objects, no service objects). State persistence: refresh / deep-link /
 * share work because the URL is canonical. No `localStorage`. No
 * `useEffect` data fetch.
 */
import { createContext, use, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { slotSchema } from "@/lib/validators/slot";
import styles from "../appointments.module.css";

/**
 * Shape of the context the islands consume. `selectedSlot` is the resolved
 * value (validated against `slotSchema` AND confirmed present in `slots`).
 * `selectSlot` writes the URL with sibling preservation.
 */
export interface AvailabilitySlotsContextValue {
  slots: string[];
  date: string;
  serviceId: string;
  vehicleId: string | null;
  closedDows: number[];
  timezone: string;
  selectedSlot: string | null;
  selectSlot: (hhmm: string) => void;
}

const AvailabilitySlotsContext =
  createContext<AvailabilitySlotsContextValue | null>(null);

/**
 * Hook consumed by every island in this namespace. Throws if used outside
 * an `<AvailabilitySlots>` provider so the failure is loud at render time
 * instead of producing a silently-empty UI.
 */
export function useAvailabilitySlotsContext(): AvailabilitySlotsContextValue {
  const ctx = use(AvailabilitySlotsContext);
  if (!ctx) {
    throw new Error(
      "useAvailabilitySlotsContext must be used inside <AvailabilitySlots>",
    );
  }
  return ctx;
}

export interface AvailabilitySlotsProps {
  /** SSR-resolved HH:mm grid (already filtered by duration + capacity). */
  slots: string[];
  /** YYYY-MM-DD — the date the grid belongs to. Drives Empty closed-day copy. */
  date: string;
  /** Active service id from the URL — drives SelectedBanner guard. */
  serviceId: string;
  /** Optional vehicle sibling — preserved on slot changes for T-043. */
  vehicleId: string | null;
  /** Workshop closed days-of-week (0=Sun..6=Sat). Drives Empty copy. */
  closedDows: number[];
  /** IANA timezone, e.g. `America/Argentina/Buenos_Aires` (INV-06). */
  timezone: string;
  children: React.ReactNode;
}

/**
 * Day-of-week in `tz` for a BA ymd. 0=Sun..6=Sat. Noon UTC anchor dodges
 * DST midnight shifts — same strategy as `getTodayBaYmd` / DateSelector.
 * Inlined here so this island stays a single client-safe module.
 */
function getBaDow(ymd: string, tz: string): number {
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noonUtc);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
  // idx === -1 only if Intl returns an unexpected label; treat as Sunday
  // so the advisory hint stays non-blocking.
  return idx === -1 ? 0 : idx;
}

const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Provider implementation. Reads the URL, validates the slot candidate,
 * exposes a `selectSlot` callback that preserves siblings.
 */
export function AvailabilitySlotsImpl({
  slots,
  date,
  serviceId,
  vehicleId,
  closedDows,
  timezone,
  children,
}: AvailabilitySlotsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Defense in depth: tampered `?slot=` (wrong step, out of range, empty,
  // not in the resolved grid) collapses to `null` so no button claims
  // pressed state and no 500 surfaces from a mis-typed URL.
  const candidate = searchParams.get("slot");
  const parsedSlot =
    typeof candidate === "string" && slotSchema.safeParse(candidate).success
      ? candidate
      : null;
  const selectedSlot = parsedSlot && slots.includes(parsedSlot) ? parsedSlot : null;

  const selectSlot = useCallback(
    (hhmm: string) => {
      // Clone the current URL state so we can mutate without dropping
      // siblings (serviceId, date, vehicleId). `URLSearchParams.toString()`
      // re-emits the canonical key order — fine for our purposes because
      // the URL is opaque on the wire.
      const params = new URLSearchParams(searchParams.toString());
      if (hhmm.length === 0) {
        params.delete("slot");
      } else {
        params.set("slot", hhmm);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const value = useMemo<AvailabilitySlotsContextValue>(
    () => ({
      slots,
      date,
      serviceId,
      vehicleId,
      closedDows,
      timezone,
      selectedSlot,
      selectSlot,
    }),
    [
      slots,
      date,
      serviceId,
      vehicleId,
      closedDows,
      timezone,
      selectedSlot,
      selectSlot,
    ],
  );

  return (
    <AvailabilitySlotsContext value={value}>
      {children}
    </AvailabilitySlotsContext>
  );
}

/**
 * `AvailabilitySlots.Grid` — radiogroup of slot buttons. Renders nothing
 * when `slots` is empty so the `AvailabilitySlots.Empty` island owns the
 * closed-vs-booked copy without overlap.
 */
export function AvailabilitySlotsGrid() {
  const { slots, selectedSlot, selectSlot } = useAvailabilitySlotsContext();

  if (slots.length === 0) return null;

  return (
    <>
      <h3
        id="availability-slots-heading"
        className={styles.slotHeading}
        data-testid="availability-slots-heading"
      >
        Available times
      </h3>
      <div
        role="radiogroup"
        aria-labelledby="availability-slots-heading"
        className={styles.slotGrid}
        data-testid="availability-slots-grid"
      >
        {slots.map((hhmm) => {
          const isSelected = hhmm === selectedSlot;
          return (
            <button
              key={hhmm}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectSlot(hhmm)}
              className={isSelected ? styles.slotSelected : styles.slotButton}
              data-testid={`availability-slot-${hhmm.replace(":", "")}`}
            >
              {hhmm}
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * `AvailabilitySlots.Empty` — closed-day copy vs booked copy. Renders
 * nothing when the grid has slots so the two islands stay mutually
 * exclusive without a boolean prop.
 */
export function AvailabilitySlotsEmpty() {
  const { slots, date, closedDows, timezone } = useAvailabilitySlotsContext();
  if (slots.length > 0) return null;

  const dow = getBaDow(date, timezone);
  const isClosed = closedDows.includes(dow);
  const dayName = DOW_LONG[dow] ?? `Day ${dow}`;
  const copy = isClosed
    ? `Closed on ${dayName}`
    : "No availability — try another date";

  return (
    <p
      className={styles.slotEmpty}
      role="status"
      data-testid="availability-slots-empty"
    >
      {copy}
    </p>
  );
}

/**
 * `AvailabilitySlots.SelectedBanner` — only renders when the slot survives
 * the slotSchema + `slots.includes` guard. No date/service objects cross
 * the boundary; we only show the HH:mm and the date as strings.
 */
export function AvailabilitySlotsSelectedBanner() {
  const { date, selectedSlot } = useAvailabilitySlotsContext();
  if (!selectedSlot) return null;

  return (
    <section
      className={styles.banner}
      role="status"
      aria-live="polite"
      aria-labelledby="availability-slots-banner-title"
      data-testid="availability-slots-banner"
    >
      <div className={styles.bannerBody}>
        <h2
          id="availability-slots-banner-title"
          className={styles.bannerTitle}
        >
          Selected: {selectedSlot}
        </h2>
        <p className={styles.bannerMeta}>on {date}</p>
      </div>
    </section>
  );
}

type Compound = typeof AvailabilitySlotsImpl & {
  Grid: typeof AvailabilitySlotsGrid;
  Empty: typeof AvailabilitySlotsEmpty;
  SelectedBanner: typeof AvailabilitySlotsSelectedBanner;
};

/**
 * Compound namespace. Attached statics enable `<AvailabilitySlots.Grid />` /
 * `<AvailabilitySlots.Empty />` / `<AvailabilitySlots.SelectedBanner />` so
 * the page composes without prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export const AvailabilitySlots = AvailabilitySlotsImpl as Compound;
AvailabilitySlots.Grid = AvailabilitySlotsGrid;
AvailabilitySlots.Empty = AvailabilitySlotsEmpty;
AvailabilitySlots.SelectedBanner = AvailabilitySlotsSelectedBanner;
