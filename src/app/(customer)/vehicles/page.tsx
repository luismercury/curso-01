/**
 * RSC shell for `/vehicles` — T-039 PR1 server foundation.
 *
 * Flow (D1):
 *   1. `auth()` resolves the JWT httpOnly session server-side. No session →
 *      `redirect('/login')` (401 mapping per spec).
 *   2. `customerId` is taken from `session.user.id` (JWT `sub`) — NEVER from
 *      the URL, NEVER from the client. Golden backend rule (INV-03).
 *   3. `maxYear = currentYear + 1` is computed here so the client never
 *      instantiates `new Date()` during render (avoids hydration mismatch
 *      across the Dec 31 → Jan 1 boundary).
 *   4. `listVehiclesByCustomer(db, customerId)` is called directly on the
 *      service (no internal HTTP hop, design D1). The result is serialized
 *      to ISO strings before any future island (server-serialization rule).
 *   5. 403 paths are handled by the sibling `error.tsx`. 401 is handled here
 *      via `redirect('/login')`.
 *
 * PR1 scope: no client islands yet. `VehicleList`/`VehicleForm` land in PR2.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { listVehiclesByCustomer } from "@/services/vehicleService";
import { maxYear } from "@/lib/validators/vehicle";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VehicleDTOJson {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  createdAt: string;
  updatedAt: string;
}

const cardStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  border: "1px solid #e5e7eb",
  borderRadius: "0.5rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "1rem",
};
const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "0.75rem",
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
      <header style={{ marginBottom: "1rem" }}>
        <h1
          id="vehicles-heading"
          style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}
        >
          My vehicles
        </h1>
        <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
          {vehicles.length === 0
            ? "You have no vehicles yet."
            : `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} registered.`}
        </p>
      </header>

      {/* PR1 server-rendered list. Replaced by the `VehicleList` island in PR2. */}
      <ul data-testid="vehicle-list" style={listStyle}>
        {vehicles.map((v) => (
          <li key={v.id} data-testid="vehicle-item" style={cardStyle}>
            <span style={{ fontWeight: 500 }}>
              {v.brand} {v.model} ({v.year})
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: "0.875rem",
                color: "#374151",
              }}
            >
              {v.plate}
            </span>
          </li>
        ))}
      </ul>

      <aside
        aria-label="Create vehicle form placeholder"
        data-pr="pr1"
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1rem",
          border: "1px dashed #d1d5db",
          borderRadius: "0.5rem",
          color: "#6b7280",
          fontSize: "0.875rem",
        }}
      >
        Create-vehicle form lands in PR2 (<code>VehicleProvider</code> +{" "}
        <code>VehicleForm</code> islands). Server payload contract is pinned by{" "}
        <code>vehicleCreateInputSchema</code> in{" "}
        <code>src/lib/validators/vehicle.ts</code>.
      </aside>
    </section>
  );
}