"use client";
/**
 * DateSelector — compound namespace for the date selection islands.
 *
 * URL is the source of truth for the selection (`?date=YYYY-MM-DD`). The
 * compound:
 *   1. Reads `date` from `useSearchParams()` on every render.
 *   2. Re-validates with `dateSchema.safeParse` + `isPastBa` + the
 *      caller-provided `max` ceiling (defense in depth — the RSC already
 *      validated; the island re-runs the same checks so client navigation
 *      never desyncs the URL state from the resolved value).
 *   3. Exposes a `selectDate(ymd)` callback that writes the URL via
 *      `router.push("?serviceId=…&vehicleId=…&date=…", { scroll: false })`,
 *      preserving siblings. An empty `ymd` deletes the `date` param.
 *   4. Stores the resolved state in a React 19 context that the
 *      `DateSelector.Input` / `DateSelector.SelectedBanner` /
 *      `DateSelector.ClearButton` islands consume via
 *      `use(DateSelectorContext)`.
 *
 * Composition (no boolean props):
 *
 *   <DateSelector
 *     date={selectedDate} min={todayBa} max={maxBa}
 *     closedDows={closedDows} timezone={tz}
 *     serviceId={selectedService?.id ?? null} vehicleId={vehicleId}
 *   >
 *     <DateSelector.Input />
 *     <DateSelector.ClearButton />
 *     <DateSelector.SelectedBanner />
 *   </DateSelector>
 *
 * INV-08: only primitives cross the boundary (camelCase strings, no Date
 * objects). State persistence: refresh / deep-link / share work because the
 * URL is canonical. No `localStorage`. No `useEffect` data fetch. No
 * controlled-state anti-pattern: the `<input type="date">` is uncontrolled
 * (`defaultValue`) and re-mounts via `key={date}` when the URL changes,
 * which keeps it in sync with back/forward navigation without copying
 * URL state into React state.
 */
import { createContext, use, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dateSchema, isPastBa } from "@/lib/validators/date";
import styles from "../appointments.module.css";

/**
 * Shape of the context the islands consume. `date` is the resolved value
 * (validated, not raw URL), `selectDate` writes the URL with sibling
 * preservation.
 */
export interface DateSelectorContextValue {
  date: string | null;
  min: string;
  max: string;
  closedDows: number[];
  timezone: string;
  serviceId: string | null;
  vehicleId: string | null;
  selectDate: (ymd: string) => void;
}

const DateSelectorContext = createContext<DateSelectorContextValue | null>(
  null,
);

/**
 * Hook consumed by every island in this namespace. Throws if used outside
 * a `<DateSelector>` provider so the failure is loud at render time
 * instead of producing a silently-empty UI.
 */
export function useDateSelectorContext(): DateSelectorContextValue {
  const ctx = use(DateSelectorContext);
  if (!ctx) {
    throw new Error(
      "useDateSelectorContext must be used inside <DateSelector>",
    );
  }
  return ctx;
}

export interface DateSelectorProps {
  /** SSR-resolved date (already validated by the RSC). */
  date: string | null;
  /** Earliest selectable BA day (`YYYY-MM-DD`). */
  min: string;
  /** Latest selectable BA day (`YYYY-MM-DD`). */
  max: string;
  /** Workshop closed days-of-week (0=Sun..6=Sat). Drives the advisory hint. */
  closedDows: number[];
  /** IANA timezone, e.g. `America/Argentina/Buenos_Aires` (INV-06). */
  timezone: string;
  /** Active service id from the URL — drives the Continue href. */
  serviceId: string | null;
  /** Optional vehicle sibling — preserved on date changes for T-043. */
  vehicleId: string | null;
  children: React.ReactNode;
}

/**
 * Apply the same validation the RSC page uses: regex + noon round-trip +
 * past bound + max bound. Tampered / past / overflow values fall back to
 * `null` without throwing. Pure — exported for reuse by the test suite.
 */
export function resolveDate(
  candidate: string | null,
  min: string,
  max: string,
): string | null {
  if (typeof candidate !== "string" || candidate.length === 0) return null;
  const parsed = dateSchema.safeParse(candidate);
  if (!parsed.success) return null;
  if (isPastBa(parsed.data, min)) return null;
  if (parsed.data > max) return null;
  return parsed.data;
}

/**
 * Day-of-week in `tz` for a BA ymd. 0=Sun..6=Sat. Noon UTC anchor dodges
 * DST midnight shifts — same strategy as `getTodayBaYmd`.
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
  // to keep the advisory hint non-blocking.
  return idx === -1 ? 0 : idx;
}

const DOW_LABELS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DOW_LABELS_PLURAL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** "Sundays, Saturdays" — sorted, comma-separated. Returns "" when empty. */
function closedDowsLabel(dows: number[]): string {
  if (dows.length === 0) return "";
  return dows
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DOW_LABELS_PLURAL[d] ?? `Day ${d}`)
    .join(", ");
}

/**
 * Provider implementation. Reads the URL, validates, exposes a
 * `selectDate` callback that preserves siblings.
 */
export function DateSelectorImpl({
  date,
  min,
  max,
  closedDows,
  timezone,
  serviceId,
  vehicleId,
  children,
}: DateSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Re-validate the URL value with the same checks the RSC applies so the
  // island never desyncs from the SSR-rendered state (no hydration
  // mismatch for past / overflow / tampered `?date=`).
  const candidate = searchParams.get("date");
  const resolvedDate = resolveDate(candidate, min, max);

  // The SSR-resolved `date` prop wins when present; otherwise we fall back
  // to the URL value. This keeps the contract explicit (the page passes
  // the validated value as a primitive) while still letting client
  // navigation surface URL changes after hydration.
  const effectiveDate = date ?? resolvedDate;

  const selectDate = useCallback(
    (ymd: string) => {
      // Clone the current URL state so we can mutate without dropping
      // siblings (serviceId, vehicleId). `URLSearchParams.toString()`
      // re-emits the canonical key order — fine for our purposes because
      // the URL is opaque on the wire.
      const params = new URLSearchParams(searchParams.toString());
      if (ymd.length === 0) {
        params.delete("date");
      } else {
        params.set("date", ymd);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const value = useMemo<DateSelectorContextValue>(
    () => ({
      date: effectiveDate,
      min,
      max,
      closedDows,
      timezone,
      serviceId,
      vehicleId,
      selectDate,
    }),
    [
      effectiveDate,
      min,
      max,
      closedDows,
      timezone,
      serviceId,
      vehicleId,
      selectDate,
    ],
  );

  return (
    <DateSelectorContext value={value}>{children}</DateSelectorContext>
  );
}

/**
 * `DateSelector.Input` — native `<input type="date">` bound to the URL
 * state via `selectDate`. Uncontrolled (`defaultValue` + `key`) so we
 * avoid the controlled-state anti-pattern while still re-mounting when
 * the URL changes (back / forward, deep-link).
 */
export function DateSelectorInput() {
  const { date, min, max, closedDows, timezone, selectDate } =
    useDateSelectorContext();

  const hintId = "date-selector-closed-hint";
  const closedHint = closedDowsLabel(closedDows);
  const selectedDow = date ? getBaDow(date, timezone) : null;
  const selectedDowIsClosed =
    selectedDow !== null && closedDows.includes(selectedDow);

  return (
    <div
      className={styles.field}
      data-testid="date-selector"
      role="group"
      aria-labelledby="date-selector-input-label"
    >
      <label
        id="date-selector-input-label"
        htmlFor="date-selector-input"
        className={styles.fieldLabel}
      >
        Date
      </label>
      <input
        id="date-selector-input"
        type="date"
        min={min}
        max={max}
        // `key` re-mounts on URL change so back/forward reflect the new
        // value without a controlled-state copy.
        key={date ?? "empty"}
        defaultValue={date ?? ""}
        onChange={(event) => selectDate(event.target.value)}
        className={styles.input}
        aria-describedby={closedHint ? hintId : undefined}
        data-testid="date-selector-input"
      />
      {closedHint ? (
        <p
          id={hintId}
          className={styles.hint}
          data-testid="date-selector-closed-hint"
        >
          Closed: {closedHint}.
        </p>
      ) : null}
      {selectedDowIsClosed && selectedDow !== null ? (
        <p
          className={`${styles.hint} ${styles.hintWarn}`}
          data-testid="date-selector-closed-warn"
          role="status"
        >
          Heads up: {DOW_LABELS_LONG[selectedDow] ?? `Day ${selectedDow}`} is
          closed. The next step will show 0 slots.
        </p>
      ) : null}
    </div>
  );
}

/**
 * `DateSelector.SelectedBanner` — shown only when both `date` and
 * `serviceId` resolve. Continue href preserves both siblings so T-042 can
 * read them verbatim from `searchParams`.
 */
export function DateSelectorSelectedBanner() {
  const { date, serviceId, vehicleId } = useDateSelectorContext();
  if (!date || !serviceId) return null;

  const params = new URLSearchParams();
  params.set("serviceId", serviceId);
  if (vehicleId) params.set("vehicleId", vehicleId);
  params.set("date", date);
  const continueHref = `/appointments/new?${params.toString()}`;

  return (
    <section
      className={styles.banner}
      role="status"
      aria-live="polite"
      aria-labelledby="date-selector-banner-title"
      data-testid="date-selector-banner"
    >
      <div className={styles.bannerBody}>
        <h2
          id="date-selector-banner-title"
          className={styles.bannerTitle}
        >
          Selected: {date}
        </h2>
        <p className={styles.bannerMeta}>
          Continue to see available time slots.
        </p>
      </div>
      <a
        href={continueHref}
        className={styles.input}
        data-testid="date-selector-continue"
      >
        Continue
      </a>
    </section>
  );
}

/**
 * `DateSelector.ClearButton` — self-hiding island that deletes the `?date=`
 * param while preserving siblings. Renders `null` when no date is set so
 * it can sit anywhere in the tree without leaking layout space.
 */
export function DateSelectorClearButton() {
  const { date, selectDate } = useDateSelectorContext();
  if (!date) return null;

  return (
    <button
      type="button"
      className={styles.input}
      onClick={() => selectDate("")}
      data-testid="date-selector-clear"
    >
      Clear
    </button>
  );
}

type Compound = typeof DateSelectorImpl & {
  Input: typeof DateSelectorInput;
  SelectedBanner: typeof DateSelectorSelectedBanner;
  ClearButton: typeof DateSelectorClearButton;
};

/**
 * Compound namespace. Attached statics enable `<DateSelector.Input />` /
 * `<DateSelector.SelectedBanner />` / `<DateSelector.ClearButton />` so the
 * page composes without prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export const DateSelector = DateSelectorImpl as Compound;
DateSelector.Input = DateSelectorInput;
DateSelector.SelectedBanner = DateSelectorSelectedBanner;
DateSelector.ClearButton = DateSelectorClearButton;
