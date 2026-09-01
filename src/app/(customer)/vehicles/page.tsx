/**
 * RSC shell for `/vehicles` — T-039 PR2 wires the client islands into the
 * server foundation shipped in PR1.
 *
 * Flow (D1, unchanged from PR1):
 *   1. `auth()` resolves the JWT httpOnly session server-side. No session →
 *      `redirect('/login')` (401 mapping per spec).
 *   2. `customerId` is taken from `session.user.id` (JWT `sub`) — NEVER from
 *      the URL, NEVER from the client. Golden backend rule (INV-03).
 *   3. `maxYear = currentYear + 1` is computed here so the client never
 *      instantiates `new Date()` during render (avoids hydration mismatch
 *      across the Dec 31 → Jan 1 boundary).
 *   4. `listVehiclesByCustomer(db, customerId)` is called directly on the
 *      service (no internal HTTP hop, design D1). The result is serialized
 *      to ISO strings before any client island (server-serialization rule,
 *      INV-08).
 *   5. 403 paths are handled by the sibling `error.tsx`. 401 is handled here
 *      via `redirect('/login')`.
 *
 * PR2 addition: the inline placeholder list/form is replaced by the
 * `<VehicleProvider>` compound from `_components/`. The RSC passes only
 * serializable primitives — `customerId` (string), `maxYear` (number), and
 * `initialVehicles` (`VehicleDTOJson[]` with ISO date strings). No `Date`
 * objects cross the RSC → client boundary.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listVehiclesByCustomer } from "@/services/vehicleService";
import { maxYear } from "@/lib/validators/vehicle";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";
import { VehicleProvider } from "./_components/VehicleProvider";
import type { VehicleDTOJson } from "@/lib/api/vehicles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headerStyle: React.CSSProperties = {
  marginBottom: "1rem",
};
const headingStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 600,
  margin: 0,
};
const subheadStyle: React.CSSProperties = {
  color: "var(--color-fg-muted, #6b7280)",
  margin: "0.25rem 0 0",
};

function toJson(dto: VehiculoDTO): VehicleDTOJson {
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

export default async function VehiclesPage() {
  const session = await auth();
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) {
    redirect("/login");
  }
  const customerId: string = sessionUserId;
  const currentMaxYear = maxYear();

  let vehicles: VehicleDTOJson[] = [];
  try {
    const dtos = await listVehiclesByCustomer(db, customerId);
    vehicles = dtos.map(toJson);
  } catch {
    // Re-throw so the sibling `error.tsx` boundary catches it.
    throw new Error("Failed to load vehicles");
  }

  return (
    <section aria-labelledby="vehicles-heading">
      <header style={headerStyle}>
        <h1 id="vehicles-heading" style={headingStyle}>
          My vehicles
        </h1>
        <p style={subheadStyle}>
          {vehicles.length === 0
            ? "You have no vehicles yet."
            : `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} registered.`}
        </p>
      </header>

      {/* Client compound — owns mutation state, reads list from props. */}
      <VehicleProvider
        customerId={customerId}
        maxYear={currentMaxYear}
        initialVehicles={vehicles}
      >
        <VehicleProvider.List vehicles={vehicles} />
        <VehicleProvider.Form />
      </VehicleProvider>
    </section>
  );
}