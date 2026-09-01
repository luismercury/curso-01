"use client";
/**
 * VehicleCard — atomic radio row inside `<VehicleSelector.List>`.
 *
 * Visual responsibility only:
 *   - Render `brand model (year) — plate` (mirrors `vehicles.module.css`
 *     precedent — `VehicleList.tsx:26-27` uses the same composition).
 *   - Reflect selection via `aria-checked` and the `.vehicleCardSelected`
 *     class (composed on top of `.vehicleCard`).
 *   - Delegate the click → `select(id)` from context.
 *
 * No props for selection state — the card consumes context and decides
 * locally. Toggling between selected/unselected is handled by swapping
 * the CSS class and the `aria-checked` attribute, not by boolean props
 * (vercel-composition-patterns:architecture-avoid-boolean-props).
 *
 * INV-08: never renders DB snake_case fields (`marca`, `modelo`, `anio`,
 * `patente`, `cliente_id`). Only camelCase DTO keys.
 *
 * The element is a `<button type="button" role="radio" aria-checked>` so
 * the card participates in a radiogroup under the same accessibility
 * semantics as the AvailabilitySlots (T-042) buttons — a screen reader
 * user navigates the list with arrow keys.
 */
import { useVehicleContext } from "./VehicleSelector";
import type { VehicleDTOJson } from "@/lib/api/vehicles";
import styles from "../appointments.module.css";

export interface VehicleCardProps {
  vehicle: VehicleDTOJson;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { selectedId, select } = useVehicleContext();
  const isSelected = vehicle.id === selectedId;

  const onClick = () => {
    if (isSelected) return; // re-click is a no-op (URL would not change)
    select(vehicle.id);
  };

  const className = isSelected
    ? `${styles.vehicleCard} ${styles.vehicleSelected}`
    : styles.vehicleCard;

  return (
    <li data-testid="vehicle-item" data-vehicle-id={vehicle.id}>
      <button
        type="button"
        className={className}
        role="radio"
        aria-checked={isSelected}
        aria-label={`Select ${vehicle.brand} ${vehicle.model} (${vehicle.year}) plate ${vehicle.plate}`}
        onClick={onClick}
        data-testid="vehicle-card"
      >
        <span className={styles.vehicleCardPrimary}>
          {vehicle.brand} {vehicle.model} ({vehicle.year})
        </span>
        <span className={styles.vehicleCardSecondary}>
          {vehicle.plate}
        </span>
      </button>
    </li>
  );
}
