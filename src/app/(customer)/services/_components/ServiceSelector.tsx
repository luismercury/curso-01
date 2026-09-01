"use client";
/**
 * ServiceSelector — compound namespace for the `/services` islands.
 *
 * URL is the source of truth for selection (`?serviceId=`). The compound:
 *   1. Reads `serviceId` from `useSearchParams()` on every render.
 *   2. Validates with `serviceIdSchema.safeParse` + `services.some(active)`
 *      (defense in depth — the RSC already validates; the island re-runs
 *      the same check so client navigation never desyncs).
 *   3. Exposes a `select(id)` callback that writes the URL via
 *      `router.push("?serviceId=" + id, { scroll: false })`.
 *   4. Stores the resolved selection in a React 19 context that the
 *      `ServiceList` / `ServiceCard` / `SelectedBanner` islands consume
 *      via `use(ServiceSelectorContext)`.
 *
 * Composition (no boolean props):
 *   <ServiceSelector services={services}>
 *     <ServiceSelector.List />
 *     <ServiceSelector.SelectedBanner />
 *   </ServiceSelector>
 *
 * INV-08: only `ServiceDTOJson` (camelCase + ISO) crosses the boundary.
 * State persistence: refresh / deep-link / share work because the URL is
 * canonical. No `localStorage`. No `useEffect` data fetch.
 */
import { createContext, use, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { serviceIdSchema } from "@/lib/validators/service";
import type { ServiceDTOJson } from "@/lib/api/services";
import { ServiceList } from "./ServiceList";
import { ServiceCard } from "./ServiceCard";
import { SelectedBanner } from "./SelectedBanner";

export interface ServiceSelectorContextValue {
  services: ServiceDTOJson[];
  selectedId: string | null;
  selected: ServiceDTOJson | null;
  select: (id: string) => void;
}

const ServiceSelectorContext = createContext<ServiceSelectorContextValue | null>(
  null,
);

/**
 * Hook consumed by every island in this namespace. Throws if used outside
 * a `<ServiceSelector>` provider so the failure is loud at render time
 * instead of producing a silently-empty UI.
 */
export function useServiceContext(): ServiceSelectorContextValue {
  const ctx = use(ServiceSelectorContext);
  if (!ctx) {
    throw new Error(
      "useServiceContext must be used inside <ServiceSelector>",
    );
  }
  return ctx;
}

export interface ServiceSelectorProps {
  /** Active-only list (the page passes `includeInactive:false` results). */
  services: ServiceDTOJson[];
  children: React.ReactNode;
}

/**
 * Provider implementation. Owns selection state derived from the URL.
 * `useSearchParams()` is reactive — any URL change (back/forward, deep-link,
 * share) re-derives `selectedId` automatically.
 */
export function ServiceSelectorImpl({
  services,
  children,
}: ServiceSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Same safeParse+find(active) guard as the RSC. Defense in depth: tampered
  // or inactive UUIDs fall back to `null` without throwing (spec scenario:
  // "Tampered/inactive `?serviceId=` fallback"). `useSearchParams()` returns
  // a `ReadonlyURLSearchParams` in Next 16 — `get("serviceId")` returns
  // `string | null`, never undefined, so we guard for null/empty explicitly.
  const candidate = searchParams.get("serviceId");
  const validUuid =
    typeof candidate === "string" &&
    candidate.length > 0 &&
    serviceIdSchema.safeParse(candidate).success;
  const selectedId =
    validUuid && services.some((s) => s.id === candidate && s.active)
      ? (candidate as string)
      : null;

  const selected = useMemo(
    () =>
      selectedId
        ? services.find((s) => s.id === selectedId && s.active) ?? null
        : null,
    [selectedId, services],
  );

  const select = useCallback(
    (id: string) => {
      // `scroll: false` keeps the viewport stable — selection feedback is
      // local to the list, no need to scroll to top.
      router.push(`?serviceId=${id}`, { scroll: false });
    },
    [router],
  );

  const value = useMemo<ServiceSelectorContextValue>(
    () => ({ services, selectedId, selected, select }),
    [services, selectedId, selected, select],
  );

  return (
    <ServiceSelectorContext value={value}>{children}</ServiceSelectorContext>
  );
}

type Compound = typeof ServiceSelectorImpl & {
  List: typeof ServiceList;
  Card: typeof ServiceCard;
  SelectedBanner: typeof SelectedBanner;
};

/**
 * Compound namespace. Attached statics enable `<ServiceSelector.List />` /
 * `<ServiceSelector.Card />` / `<ServiceSelector.SelectedBanner />` so the
 * page composes without prop-bag boolean sprawl.
 */
export const ServiceSelector = ServiceSelectorImpl as Compound;
ServiceSelector.List = ServiceList;
ServiceSelector.Card = ServiceCard;
ServiceSelector.SelectedBanner = SelectedBanner;
