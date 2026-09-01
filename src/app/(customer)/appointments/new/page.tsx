/**
 * RSC shell for `/(customer)/appointments/new` — T-041 PR1 foundation.
 *
 * Mirrors T-040 /services flow:
 *   1. `auth()` → redirect /login if null (INV-03 defensive).
 *   2. `Promise.all([getWorkshopConfig, listServices])` — parallel, no
 *      waterfall.
 *   3. `?serviceId=` UUID safeParse + `services.some(active)` → `selectedService`
 *      (tampered/inactive → null, no 500).
 *   4. `?date=` `dateSchema.safeParse` + `getBaDayUtcRange` overflow +
 *      `isPastBa` + `addBaDays(today, DATE_MAX_DAYS, tz)` max bound →
 *      `selectedDate` (tampered/past/overflow → null, banner hidden).
 *   5. `closedDows: number[]` derived from `config.operatingHours` empty
 *      intervals (0=Sun..6=Sat).
 *   6. Render either CTA → /services or the date input + SelectedContext
 *      banner. `?vehicleId=` preserved on Continue href for T-043.
 *
 * PR1 ships an inline `<form method=get>` placeholder. PR2 replaces it
 * with the `<DateSelector>` compound (useSearchParams + router.push).
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listServices } from "@/services/servicioService";
import { getWorkshopConfig } from "@/config/workshopConfig";
import {
  addBaDays,
  dateSchema,
  DATE_MAX_DAYS,
  getBaDayUtcRange,
  getTodayBaYmd,
  isPastBa,
} from "@/lib/validators/date";
import { serviceIdSchema } from "@/lib/validators/service";
import type { ServicioDTO } from "@/db/mappers/servicio";
import type { ServiceDTOJson } from "@/lib/api/services";
import styles from "./appointments.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AppointmentsNewPageProps = {
  searchParams: Promise<{
    serviceId?: string;
    date?: string;
    vehicleId?: string;
  }>;
};

/** Inline shape mirroring `workshopSchedule.TimeInterval` without pulling
 *  the server-only module across the boundary. */
interface TimeInterval {
  start: string;
  end: string;
}

/** Days whose interval list is `[]` are closed. 0=Sun..6=Sat. */
function deriveClosedDows(
  operatingHours: Record<number, TimeInterval[]>,
): number[] {
  const closed: number[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    const intervals = operatingHours[dow];
    if (!intervals || intervals.length === 0) closed.push(dow);
  }
  return closed;
}

export default async function AppointmentsNewPage({
  searchParams,
}: AppointmentsNewPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;

  const [config, dtos] = await Promise.all([
    getWorkshopConfig(db),
    listServices(db, { includeInactive: false }),
  ]);

  const services: ServiceDTOJson[] = dtos.map(toJson);

  const candidateService = params.serviceId;
  const validUuid =
    typeof candidateService === "string" &&
    candidateService.length > 0 &&
    serviceIdSchema.safeParse(candidateService).success;
  const selectedService =
    validUuid &&
    services.some((s) => s.id === candidateService && s.active)
      ? services.find((s) => s.id === candidateService && s.active) ?? null
      : null;

  // Date bounds in BA calendar space (INV-06 noon anchor).
  const tz = config.timezone;
  const todayBa = getTodayBaYmd(tz);
  const maxBa = addBaDays(todayBa, DATE_MAX_DAYS, tz);

  // Validate `?date=` — regex + noon round-trip + past + max bound.
  const candidateDate = params.date;
  let selectedDate: string | null = null;
  if (typeof candidateDate === "string" && candidateDate.length > 0) {
    const parsed = dateSchema.safeParse(candidateDate);
    if (
      parsed.success &&
      !isPastBa(parsed.data, todayBa) &&
      parsed.data <= maxBa
    ) {
      try {
        // Overflow re-check at the BA-DST range layer (defense in depth).
        getBaDayUtcRange(parsed.data, tz);
        selectedDate = parsed.data;
      } catch {
        selectedDate = null;
      }
    }
  }

  const closedDows = deriveClosedDows(
    (config.operatingHours ?? {}) as Record<number, TimeInterval[]>,
  );

  // CTA branch — no service selected, do not render orphaned date input.
  if (!selectedService) {
    return (
      <section aria-labelledby="appointments-new-heading">
        <header className={styles.pageHeader}>
          <h1 id="appointments-new-heading" className={styles.pageHeading}>
            Pick a date
          </h1>
          <p className={styles.pageSubhead}>
            Select a service first to continue with your booking.
          </p>
        </header>
        <Link
          href="/services"
          className={styles.cta}
          data-testid="appointments-new-cta"
        >
          <div className={styles.bannerBody}>
            <p className={styles.ctaTitle}>Select a service first</p>
            <p className={styles.ctaBody}>
              Pick the service you want to book before choosing a date.
            </p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    );
  }

  // Preserve sibling `?vehicleId=` so T-043 (form) can read it later.
  const vehicleId = typeof params.vehicleId === "string" ? params.vehicleId : null;

  // Continue href — T-042 will read `?serviceId=&date=` (no coupling).
  const continueHref = vehicleId
    ? `/appointments/new?serviceId=${selectedService.id}&vehicleId=${vehicleId}&date=${selectedDate ?? ""}`
    : `/appointments/new?serviceId=${selectedService.id}&date=${selectedDate ?? ""}`;

  return (
    <section aria-labelledby="appointments-new-heading">
      <header className={styles.pageHeader}>
        <h1 id="appointments-new-heading" className={styles.pageHeading}>
          Pick a date
        </h1>
        <p className={styles.pageSubhead}>
          For {selectedService.name} ({selectedService.durationMinutes} min)
        </p>
      </header>

      {/* PR1 placeholder input. PR2 replaces with <DateSelector> compound
          (useSearchParams + router.push, no form submit). */}
      <form
        method="get"
        action="/appointments/new"
        className={styles.field}
        data-testid="appointments-new-form"
      >
        <label htmlFor="date-input" className={styles.fieldLabel}>
          Date
        </label>
        <input
          id="date-input"
          name="date"
          type="date"
          min={todayBa}
          max={maxBa}
          defaultValue={selectedDate ?? ""}
          className={styles.input}
          aria-describedby="date-hint"
          data-testid="appointments-new-date-input"
        />
        <input type="hidden" name="serviceId" value={selectedService.id} />
        {vehicleId && (
          <input type="hidden" name="vehicleId" value={vehicleId} />
        )}
        <p id="date-hint" className={styles.hint}>
          Pick any day from today through {maxBa} ({DATE_MAX_DAYS}-day window).
          {closedDows.length > 0
            ? ` Closed: ${closedDows.map(dowLabel).join(", ")}.`
            : ""}
        </p>
        <button
          type="submit"
          className={styles.input}
          data-testid="appointments-new-submit"
        >
          Apply
        </button>
      </form>

      {selectedDate && (
        <section
          className={styles.banner}
          role="status"
          aria-live="polite"
          aria-labelledby="selected-date-banner-title"
          data-testid="appointments-new-banner"
        >
          <div className={styles.bannerBody}>
            <h2 id="selected-date-banner-title" className={styles.bannerTitle}>
              Selected: {selectedDate}
            </h2>
            <p className={styles.bannerMeta}>
              Continue to see available time slots.
            </p>
          </div>
          <Link
            href={continueHref}
            className={styles.input}
            data-testid="appointments-new-continue"
          >
            Continue
          </Link>
        </section>
      )}
    </section>
  );
}

function toJson(dto: ServicioDTO): ServiceDTOJson {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    durationMinutes: dto.durationMinutes,
    active: dto.active,
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}

/** Render a day-of-week number (0=Sun..6=Sat) as a long label. */
function dowLabel(dow: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow] ?? `Day ${dow}`;
}
