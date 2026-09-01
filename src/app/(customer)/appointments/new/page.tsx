/**
 * RSC shell for `/(customer)/appointments/new` — T-041 + T-042 + T-043 PR1.
 *
 * Mirrors T-040 /services flow:
 *   1. `auth()` → redirect /login if null (INV-03 defensive).
 *   2. `Promise.all([getWorkshopConfig, listServices, listVehiclesByCustomer])`
 *      — parallel, no waterfall.
 *   3. `?serviceId=` UUID safeParse + `services.some(active)` → `selectedService`
 *      (tampered/inactive → null, no 500).
 *   4. `?date=` `dateSchema.safeParse` + `getBaDayUtcRange` overflow +
 *      `isPastBa` + `addBaDays(today, DATE_MAX_DAYS, tz)` max bound →
 *      `selectedDate` (tampered/past/overflow → null, banner hidden).
 *   5. `closedDows: number[]` derived from `config.operatingHours` empty
 *      intervals (0=Sun..6=Sat).
 *   6. T-042: when BOTH `selectedService` AND `selectedDate` resolve, a
 *      third awaited call to `getAvailableSlotsForDate` (noon-anchored,
 *      single bulk fetch via the same adapter as `/api/availability`)
 *      yields `availableSlots: string[]` of bookable HH:mm. Only
 *      primitives cross to the client island (INV-08). Otherwise
 *      `availableSlots = null` — no domain call, no 500.
 *   7. T-043 PR1: vehicles wire — `listVehiclesByCustomer(db, session.user.id)`
 *      server-direct (design D1, no `/api/customers/{id}/vehicles` hop)
 *      → `VehiculoDTO[]` → `VehicleDTOJson[]` (INV-08, brand/model/year/
 *      plate/customerId/createdAt/updatedAt ISO). When `vehicles.length === 0`
 *      the page renders the CTA branch only (no DateSelector, no
 *      AvailabilitySlots, no BookingForm) so the user can add a vehicle
 *      before the booking flow can start. PR2 wires the
 *      `<BookingForm>` compound once all four selections resolve.
 *   8. Render either CTA → /services, the 0-vehicle CTA → /vehicles,
 *      `<DateSelector>` alone, or `<DateSelector>` + `<AvailabilitySlots>`
 *      + `<VehicleSelector>` once a valid service is paired with the
 *      vehicle list. The islands own URL writes (`useSearchParams` +
 *      `router.push`) and sibling preservation (serviceId / date /
 *      vehicleId) for T-042/T-043.
 *
 * PR1 (T-043) shipped the RSC wire + 0-vehicle CTA + `<VehicleSelector>`
 * compound. PR2 wires `<BookingForm>` + submit + 409/403/422/401 envelope.
 * Confirm/submit wiring is intentionally absent in PR1 — chain discipline.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listServices } from "@/services/servicioService";
import { listVehiclesByCustomer } from "@/services/vehicleService";
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
import { findActiveTurnosByDateRange } from "@/db/repositories/turnos";
import {
  getAvailableSlotsForDate,
  type FetchActiveTurnos,
} from "@/services/availability/availabilityService";
import { formatSlotsAsHHmm } from "@/services/availability/slotGenerator";
import type { ServicioDTO } from "@/db/mappers/servicio";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";
import type { ServiceDTOJson } from "@/lib/api/services";
import type { VehicleDTOJson } from "@/lib/api/vehicles";
import styles from "./appointments.module.css";
import { DateSelector } from "./_components/DateSelector";
import { AvailabilitySlots } from "./_components/AvailabilitySlots";
import { VehicleSelector } from "./_components/VehicleSelector";

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
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) {
    redirect("/login");
  }
  // Narrow `userId` to `string` so downstream service calls (which
  // require `string`) typecheck. Mirrors the pattern in
  // `vehicles/page.tsx:64-70`.
  const userId: string = sessionUserId;

  const params = await searchParams;

  const [config, dtos, vehicleDtos] = await Promise.all([
    getWorkshopConfig(db),
    listServices(db, { includeInactive: false }),
    listVehiclesByCustomer(db, userId),
  ]);

  const services: ServiceDTOJson[] = dtos.map(toJson);

  // T-043 PR1 (INV-08): only `VehicleDTOJson` primitives cross to the
  // client island. ISO date strings, camelCase English keys
  // (brand/model/year/plate/customerId/createdAt/updatedAt) — never
  // `marca` / `modelo` / `anio` / `patente` / `cliente_id` / `created_at`.
  const vehicles: VehicleDTOJson[] = vehicleDtos.map(toVehicleJson);

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

  // T-043 PR1 — 0-vehicle CTA branch (spec scenario: "Zero vehicles").
  // No DateSelector / AvailabilitySlots / BookingForm yet — the booking
  // flow cannot start without a vehicle. The CTA mirrors the T-040
  // missing-service CTA: a single `<Link href="/vehicles">` so the user
  // owns the create-vehicle action (design D E1). PR2 keeps this branch
  // unchanged — when the user lands back here with a vehicle the page
  // re-renders the date/availability flow.
  if (vehicles.length === 0) {
    return (
      <section aria-labelledby="appointments-new-heading">
        <header className={styles.pageHeader}>
          <h1 id="appointments-new-heading" className={styles.pageHeading}>
            Pick a vehicle
          </h1>
          <p className={styles.pageSubhead}>
            For {selectedService.name} ({selectedService.durationMinutes} min)
          </p>
        </header>
        <Link
          href="/vehicles"
          className={styles.cta}
          data-testid="booking-empty-vehicles"
        >
          <div className={styles.bannerBody}>
            <p className={styles.ctaTitle}>Add a vehicle to book</p>
            <p className={styles.ctaBody}>
              You need at least one vehicle on file before you can book an
              appointment.
            </p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    );
  }

  // Preserve sibling `?vehicleId=` so T-043 (form) can read it later.
  const vehicleId = typeof params.vehicleId === "string" ? params.vehicleId : null;

  // T-042 conditional availability fetch (design §A). Only runs when
  // both `selectedService` and `selectedDate` resolved upstream — no
  // fetch for tampered/inactive serviceId, invalid date, past/overflow,
  // or missing pair. Noon UTC anchor dodges DST midnight shifts and
  // guarantees `formatSlotsAsHHmm` resolves to the BA calendar day the
  // user picked. Adapter signature mirrors `/api/availability/route.ts:96-97`
  // so we keep a single bulk-fetch path.
  let availableSlots: string[] | null = null;
  if (selectedService && selectedDate) {
    const noonDate = new Date(`${selectedDate}T12:00:00.000Z`);
    const fetchActiveTurnos: FetchActiveTurnos = (range) =>
      findActiveTurnosByDateRange(db, range);
    const slots = await getAvailableSlotsForDate({
      date: noonDate,
      durationMinutes: selectedService.durationMinutes,
      config: {
        timezone: tz,
        slotStepMinutes: config.slotStepMinutes,
        capacityPerSlot: config.capacityPerSlot,
        operatingHours: (config.operatingHours ?? {}) as Record<
          number,
          TimeInterval[]
        >,
      },
      fetchActiveTurnos,
    });
    availableSlots = formatSlotsAsHHmm(slots, tz);
  }

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

      {/* DateSelector compound — URL-canonical, no Server Actions, no
          localStorage, no useEffect fetch. The island re-validates ?date=
          with the same checks this page applies (defense in depth) so the
          SSR-resolved `date` prop and the URL state never desync. Sibling
          preservation (serviceId / vehicleId) is owned by the island via
          `URLSearchParams(searchParams.toString())`. */}
      <DateSelector
        date={selectedDate}
        min={todayBa}
        max={maxBa}
        closedDows={closedDows}
        timezone={tz}
        serviceId={selectedService.id}
        vehicleId={vehicleId}
      >
        <DateSelector.Input />
        <DateSelector.ClearButton />
        <DateSelector.SelectedBanner />
      </DateSelector>

      {/* T-042 AvailabilitySlots compound — only renders when the date
          branch is valid. `availableSlots` is non-null here because the
          wrap condition matches the fetch condition. The island owns
          URL writes for `?slot=HH:mm` (slotSchema guard + includes
          check) and re-renders on URL change. */}
      {selectedDate && availableSlots !== null ? (
        <div className={styles.slotSection}>
          <AvailabilitySlots
            slots={availableSlots}
            date={selectedDate}
            serviceId={selectedService.id}
            vehicleId={vehicleId}
            closedDows={closedDows}
            timezone={tz}
          >
            <AvailabilitySlots.Grid />
            <AvailabilitySlots.Empty />
            <AvailabilitySlots.SelectedBanner />
          </AvailabilitySlots>
        </div>
      ) : null}

      {/* T-043 PR1 — VehicleSelector compound. Reachable because the
          0-vehicle CTA branch above already returned. The island owns
          URL writes for `?vehicleId=uuidV` with `vehicleIdSchema`
          + `isOwner` defense in depth (INV-03). Sibling preservation
          (serviceId / date) is the island's responsibility via
          `URLSearchParams(searchParams.toString())`. PR2 wires the
          `<BookingForm>` Submit/Confirm once all 4 selections resolve —
          that compound is NOT present on PR1 tip (chain discipline). */}
      <VehicleSelector
        vehicles={vehicles}
        userId={userId}
        serviceId={selectedService.id}
        date={selectedDate}
      >
        <VehicleSelector.List />
        <VehicleSelector.SelectedBanner />
        <VehicleSelector.ClearButton />
      </VehicleSelector>
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

/**
 * T-043 PR1 — Map internal Spanish/Date-bearing `VehiculoDTO` to the
 * INV-08 camelCase JSON shape that crosses the RSC → client boundary.
 *
 * Mirror of `lib/api/vehicles.ts:VehicleDTOJson`. Implemented locally
 * (instead of importing `toVehiculoDTO` + mapping again) to keep the
 * dependency graph flat: page.tsx already pulls `lib/api/vehicles` for
 * the type only, so the map lives next to its consumer.
 */
function toVehicleJson(dto: VehiculoDTO): VehicleDTOJson {
  return {
    id: dto.id,
    customerId: dto.customerId,
    brand: dto.brand,
    model: dto.model,
    year: dto.year,
    plate: dto.plate,
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}
