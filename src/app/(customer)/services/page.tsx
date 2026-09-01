/**
 * RSC shell for `/services` — T-040 PR1 wires the data foundation; PR2
 * replaces this minimal list with the compound `ServiceSelector` islands.
 *
 * Flow (design D1, mirrors T-039):
 *   1. `auth()` resolves the JWT httpOnly session server-side. No session →
 *      `redirect('/login')` (401 mapping per spec).
 *   2. `listServices(db,{includeInactive:false})` is called directly on the
 *      service (no internal HTTP hop). Result is mapped to `ServiceDTOJson`
 *      (`Date→ISO`) before any client boundary (server-serialization, INV-08).
 *   3. `searchParams?.serviceId` is validated with `serviceIdSchema.safeParse`
 *      + `find(active)` to derive the selection. Tampered / inactive UUIDs
 *      fall back to `null` (no 500).
 *
 * PR2 will move the list rendering into a `ServiceSelector` compound and
 * wire `?serviceId=` to `useSearchParams` + `router.push`.
 *
 * INV-03: auth guard is inherited from `(customer)/layout`; we re-call
 * `auth()` here defensively (same precedent as `vehicles/page.tsx`).
 */
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listServices } from "@/services/servicioService";
import { serviceIdSchema } from "@/lib/validators/service";
import type { ServicioDTO } from "@/db/mappers/servicio";
import type { ServiceDTOJson } from "@/lib/api/services";

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
  // "Tampered/inactive `?serviceId=` fallback").
  const candidate = params.serviceId;
  const validUuid =
    typeof candidate === "string" && serviceIdSchema.safeParse(candidate).success;
  const selectedId =
    validUuid && services.some((s) => s.id === candidate && s.active)
      ? candidate
      : null;

  return (
    <section aria-labelledby="services-heading">
      <header style={{ marginBottom: "1rem" }}>
        <h1 id="services-heading" style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Select a service
        </h1>
        <p style={{ color: "var(--color-fg-muted, #6b7280)", margin: "0.25rem 0 0" }}>
          {services.length === 0
            ? "No services available."
            : `${services.length} service${services.length === 1 ? "" : "s"} available.`}
        </p>
      </header>

      {services.length === 0 ? (
        <p style={{ padding: "1rem", border: "1px dashed var(--color-border, #e5e7eb)", borderRadius: "0.5rem" }}>
          No services available.
        </p>
      ) : (
        <ul
          data-testid="services-list"
          style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}
        >
          {services.map((s) => (
            <li
              key={s.id}
              data-service-id={s.id}
              aria-pressed={s.id === selectedId}
              style={{ padding: "0.75rem 1rem", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: "0.5rem" }}
            >
              <strong>{s.name}</strong>
              <span style={{ marginLeft: "0.5rem", color: "var(--color-fg-muted, #6b7280)" }}>
                {s.durationMinutes} min
              </span>
            </li>
          ))}
        </ul>
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
