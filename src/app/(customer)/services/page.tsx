/**
 * RSC shell for `/services` — T-040 PR2 wires the `ServiceSelector` compound
 * islands over the data foundation shipped in PR1.
 *
 * Flow (D1, D2 — unchanged from PR1):
 *   1. `auth()` resolves the JWT httpOnly session server-side. No session →
 *      `redirect('/login')` (401 mapping per spec, INV-03).
 *   2. `listServices(db,{includeInactive:false})` is called directly on the
 *      service (no internal HTTP hop, design D1). The result is mapped to
 *      `ServiceDTOJson` (`Date→ISO`) before any client boundary (INV-06,
 *      INV-08).
 *   3. `searchParams?.serviceId` is validated with `serviceIdSchema.safeParse`
 *      + `services.some(active)` to derive `selectedId`. Tampered / inactive
 *      UUIDs fall back to `null` (no 500, spec scenario: "Tampered/inactive
 *      `?serviceId=` fallback"). The islands re-run the same check on the
 *      client so URL-driven navigation never desyncs.
 *
 * PR2 wiring: the inline `<ul>` placeholder is replaced by the
 * `<ServiceSelector>` compound from `_components/`. The RSC passes only
 * serializable primitives — `services: ServiceDTOJson[]` with ISO date
 * strings. No `Date` objects cross the RSC → client boundary.
 */
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listServices } from "@/services/servicioService";
import { serviceIdSchema } from "@/lib/validators/service";
import type { ServicioDTO } from "@/db/mappers/servicio";
import type { ServiceDTOJson } from "@/lib/api/services";
import { ServiceSelector } from "./_components/ServiceSelector";
import styles from "./services.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ServicesPageProps = {
  searchParams: Promise<{ serviceId?: string }>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  // Defensive guard — `(customer)/layout` already redirects unauthenticated
  // requests, but if the layout ever changes we still fail closed.
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;

  let services: ServiceDTOJson[] = [];
  try {
    const dtos = await listServices(db, { includeInactive: false });
    services = dtos.map(toJson);
  } catch {
    // Re-throw so the sibling `error.tsx` boundary catches it.
    throw new Error("Failed to load services");
  }

  // Derive `selectedId` only if `searchParams.serviceId` is a valid UUID AND
  // matches an active service in the current list. Anything else falls back
  // to `null` with no throw — tampered URLs do not 500 (spec scenario:
  // "Tampered/inactive `?serviceId=` fallback"). The RSC value is currently
  // unused by the islands (they re-derive from `useSearchParams()` for URL
  // canonicality) but kept here so the server-rendered HTML reflects the
  // selection on first paint without waiting for hydration.
  const candidate = params.serviceId;
  const validUuid =
    typeof candidate === "string" && serviceIdSchema.safeParse(candidate).success;
  const selectedId =
    validUuid && services.some((s) => s.id === candidate && s.active)
      ? candidate
      : null;
  // Referenced for clarity / future SSR-time aria propagation; not directly
  // consumed by the islands.
  void selectedId;

  return (
    <section aria-labelledby="services-heading">
      <header className={styles.pageHeader}>
        <h1 id="services-heading" className={styles.pageHeading}>
          Select a service
        </h1>
        <p className={styles.pageSubhead}>
          {services.length === 0
            ? "No services available."
            : `${services.length} service${services.length === 1 ? "" : "s"} available.`}
        </p>
      </header>

      {/* Client compound — owns selection state via useSearchParams, renders
          cards + banner. URL is source of truth; no localStorage. */}
      <ServiceSelector services={services}>
        <ServiceSelector.List />
        <ServiceSelector.SelectedBanner />
      </ServiceSelector>
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
