"use client";
/**
 * VehicleSelector — compound namespace for the vehicle selection island
 * (T-043 PR1).
 *
 * URL is the source of truth for the selection (`?vehicleId=uuidV`). The
 * compound:
 *   1. Reads `vehicleId` from `useSearchParams()` and validates with
 *      `vehicleIdSchema.safeParse` + `isOwner(vehicle, userId)` so a
 *      tampered, deleted, or foreign `?vehicleId=` collapses to `null`
 *      without 500-ing.
 *   2. Exposes a `select(id)` callback that writes the URL via
 *      `router.push("?vehicleId=" + id, { scroll: false })`.
 *   3. Exposes a `clear()` callback that deletes the `vehicleId` param
 *      while preserving siblings (`serviceId`, `date`, future `slot`)
 *      via `URLSearchParams(searchParams.toString())` — same pattern as
 *      AvailabilitySlots / DateSelector.
 *   4. Stores the resolved state in a React 19 context that the
 *      `VehicleSelector.List` / `VehicleSelector.SelectedBanner` /
 *      `VehicleSelector.ClearButton` / `VehicleSelector.Empty` islands
 *      consume via `use(VehicleSelectorContext)`.
 *
 * Composition (no boolean props):
 *
 *   <VehicleSelector
 *     vehicles={vehicles} userId={session.user.id}
 *     serviceId={selectedService.id} date={selectedDate}
 *   >
 *     <VehicleSelector.List />
 *     <VehicleSelector.SelectedBanner />
 *     <VehicleSelector.ClearButton />
 *   </VehicleSelector>
 *
 * INV-03: ownership filter is enforced at the RSC layer
 * (`listVehiclesByCustomer(db, session.user.id)`) AND at the island
 * layer (`isOwner(vehicle, userId)`) so a deep-link to another user's
 * vehicle never highlights the wrong card.
 * INV-08: only `VehicleDTOJson` primitives (camelCase + ISO) cross the
 * boundary. No `marca` / `patente` / `cliente_id` / `fecha*` keys.
 *
 * State persistence: refresh / deep-link / share work because the URL
 * is canonical. No `localStorage`. No `useEffect` data fetch.
 */
import { createContext, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { vehicleIdSchema } from "@/lib/validators/vehicleId";
import type { VehicleDTOJson } from "@/lib/api/vehicles";
import { VehicleCard } from "./VehicleCard";
import styles from "../appointments.module.css";

/**
 * Shape of the context the islands consume. `selectedId` is the resolved
 * value (validated against `vehicleIdSchema` AND confirmed owned by
 * `userId`). `select` / `clear` write the URL with sibling preservation.
 */
export interface VehicleSelectorContextValue {
  vehicles: VehicleDTOJson[];
  userId: string;
  serviceId: string | null;
  date: string | null;
  selectedId: string | null;
  selected: VehicleDTOJson | null;
  select: (id: string) => void;
  clear: () => void;
}

const VehicleSelectorContext =
  createContext<VehicleSelectorContextValue | null>(null);

/**
 * Hook consumed by every island in this namespace. Throws if used outside
 * a `<VehicleSelector>` provider so the failure is loud at render time
 * instead of producing a silently-empty UI.
 */
export function useVehicleContext(): VehicleSelectorContextValue {
  const ctx = use(VehicleSelectorContext);
  if (!ctx) {
    throw new Error(
      "useVehicleContext must be used inside <VehicleSelector>",
    );
  }
  return ctx;
}

export interface VehicleSelectorProps {
  /** Owned-by-user vehicle list (server-derived, RSC filter). */
  vehicles: VehicleDTOJson[];
  /** Session user id — used for the ownership re-check (INV-03). */
  userId: string;
  /** Sibling from the URL — preserved on vehicle changes for T-042/T-043. */
  serviceId: string | null;
  /** Sibling from the URL — preserved on vehicle changes. */
  date: string | null;
  children: React.ReactNode;
}

/**
 * Provider implementation. Owns selection state derived from the URL.
 * `useSearchParams()` is reactive — any URL change (back/forward,
 * deep-link, share) re-derives `selectedId` automatically.
 */
export function VehicleSelectorImpl({
  vehicles,
  userId,
  serviceId,
  date,
  children,
}: VehicleSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Same `vehicleIdSchema.safeParse` + `vehicles.some(... owned ...)`
  // guard as the RSC. Defense in depth: tampered, deleted, or foreign
  // UUIDs fall back to `null` without throwing (spec scenario: "Tampered
  // / foreign vehicle"). `useSearchParams()` returns a
  // `ReadonlyURLSearchParams` in Next 16 — `get("vehicleId")` returns
  // `string | null`, never undefined.
  const candidate = searchParams.get("vehicleId");
  const validUuid =
    typeof candidate === "string" &&
    candidate.length > 0 &&
    vehicleIdSchema.safeParse(candidate).success;
  const candidateIsOwned =
    validUuid &&
    vehicles.some(
      (v) => v.id === candidate && v.customerId === userId,
    );
  const selectedId =
    validUuid && candidateIsOwned ? (candidate as string) : null;

  const selected = useMemo(
    () =>
      selectedId
        ? vehicles.find(
            (v) => v.id === selectedId && v.customerId === userId,
          ) ?? null
        : null,
    [selectedId, vehicles, userId],
  );

  const select = useCallback(
    (id: string) => {
      // Clone the current URL state so we can mutate without dropping
      // siblings (serviceId, date, future slot) — same pattern as the
      // `clear` callback below and as AvailabilitySlots / DateSelector.
      // `URLSearchParams.toString()` re-emits the canonical key order —
      // fine because the URL is opaque on the wire.
      const params = new URLSearchParams(searchParams.toString());
      params.set("vehicleId", id);
      const query = params.toString();
      // `scroll: false` keeps the viewport stable — selection feedback is
      // local to the list, no need to scroll to top.
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => {
    // Clone the current URL state so we can mutate without dropping
    // siblings (serviceId, date, future slot). `URLSearchParams.toString()`
    // re-emits the canonical key order — fine because the URL is opaque
    // on the wire.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("vehicleId");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const value = useMemo<VehicleSelectorContextValue>(
    () => ({
      vehicles,
      userId,
      serviceId,
      date,
      selectedId,
      selected,
      select,
      clear,
    }),
    [vehicles, userId, serviceId, date, selectedId, selected, select, clear],
  );

  return (
    <VehicleSelectorContext value={value}>{children}</VehicleSelectorContext>
  );
}

/**
 * `VehicleSelector.List` — radiogroup of vehicle cards. Renders nothing
 * when `vehicles.length === 0` so the consumer owns the empty state
 * (the page renders its own `<Link href="/vehicles">` CTA, while a
 * generic consumer can opt-in to the `VehicleSelector.Empty` static
 * instead). Two explicit visual variants, no boolean props on the
 * exported component
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export function VehicleSelectorList() {
  const { vehicles } = useVehicleContext();

  if (vehicles.length === 0) return null;

  return (
    <>
      <h3
        id="vehicle-selector-heading"
        className={styles.vehicleHeading}
        data-testid="vehicle-selector-heading"
      >
        Choose a vehicle
      </h3>
      <ul
        role="radiogroup"
        aria-labelledby="vehicle-selector-heading"
        className={styles.vehicleList}
        data-testid="vehicle-selector-list"
      >
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </ul>
    </>
  );
}

/**
 * `VehicleSelector.Empty` — CTA branch when the signed-in user has no
 * vehicles on file. Mirrors the T-040 missing-service CTA pattern:
 * single `<Link>` to `/vehicles` so the user owns the create-vehicle
 * action. Renders nothing when vehicles exist so the two states stay
 * mutually exclusive without a boolean prop.
 */
export function VehicleSelectorEmpty() {
  const { vehicles } = useVehicleContext();
  if (vehicles.length > 0) return null;

  return (
    <section
      className={styles.vehicleEmpty}
      role="status"
      aria-labelledby="vehicle-empty-title"
      data-testid="vehicle-selector-empty"
    >
      <p
        id="vehicle-empty-title"
        className={styles.vehicleEmptyTitle}
      >
        No vehicles on file
      </p>
      <p className={styles.vehicleEmptyBody}>
        Add a vehicle on the vehicles page before booking an appointment.
      </p>
      <Link
        href="/vehicles"
        className={styles.vehicleEmptyCta}
        data-testid="vehicle-selector-empty-cta"
      >
        Add a vehicle →
      </Link>
    </section>
  );
}

/**
 * `VehicleSelector.SelectedBanner` — shows the chosen vehicle summary
 * with a Clear affordance that deletes `?vehicleId=` (preserves
 * siblings). Renders nothing when `selected` is null (tampered,
 * foreign, deleted, or no selection).
 *
 * PR1: no Continue link yet — the `<BookingForm>` compound (PR2) is
 * the next affordance once all 4 selections resolve. The banner simply
 * confirms the vehicle pick and exposes a Clear button.
 */
export function VehicleSelectorSelectedBanner() {
  const { selected } = useVehicleContext();
  if (!selected) return null;

  return (
    <section
      className={styles.banner}
      role="status"
      aria-live="polite"
      aria-labelledby="vehicle-banner-title"
      data-testid="vehicle-banner"
    >
      <div className={styles.bannerBody}>
        <h2 id="vehicle-banner-title" className={styles.bannerTitle}>
          Selected: {selected.brand} {selected.model} ({selected.year})
        </h2>
        <p className={styles.bannerMeta}>Plate: {selected.plate}</p>
      </div>
    </section>
  );
}

/**
 * `VehicleSelector.ClearButton` — self-hiding island that deletes
 * `?vehicleId=` while preserving siblings. Renders `null` when no
 * vehicle is selected so it can sit anywhere in the tree without
 * leaking layout space.
 */
export function VehicleSelectorClearButton() {
  const { selectedId, clear } = useVehicleContext();
  if (!selectedId) return null;

  return (
    <button
      type="button"
      className={styles.input}
      onClick={clear}
      data-testid="vehicle-selector-clear"
    >
      Clear vehicle
    </button>
  );
}

type Compound = typeof VehicleSelectorImpl & {
  List: typeof VehicleSelectorList;
  Empty: typeof VehicleSelectorEmpty;
  SelectedBanner: typeof VehicleSelectorSelectedBanner;
  ClearButton: typeof VehicleSelectorClearButton;
};

/**
 * Compound namespace. Attached statics enable `<VehicleSelector.List />`
 * / `<VehicleSelector.Empty />` / `<VehicleSelector.SelectedBanner />` /
 * `<VehicleSelector.ClearButton />` so the page composes without
 * prop-bag boolean sprawl
 * (`vercel-composition-patterns:architecture-avoid-boolean-props`).
 */
export const VehicleSelector = VehicleSelectorImpl as Compound;
VehicleSelector.List = VehicleSelectorList;
VehicleSelector.Empty = VehicleSelectorEmpty;
VehicleSelector.SelectedBanner = VehicleSelectorSelectedBanner;
VehicleSelector.ClearButton = VehicleSelectorClearButton;
