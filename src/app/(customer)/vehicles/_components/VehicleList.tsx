"use client";
/**
 * VehicleList + EmptyState + ErrorBanner — server-sorted vehicle display.
 * Receives `vehicles` (sorted ASC, ISO strings). Reads banner error from
 * Provider context to switch between three explicit visual variants.
 * No boolean props on the exported component (vercel-composition-patterns).
 * Keys use stable UUIDs from the service.
 */
import { useVehicleContext } from "./VehicleProvider";
import type { BannerError } from "./VehicleProvider";
import type { VehicleDTOJson } from "@/lib/api/vehicles";
import styles from "../vehicles.module.css";

export interface VehicleListProps {
  vehicles: VehicleDTOJson[];
}

export function VehicleList({ vehicles }: VehicleListProps) {
  const { error, resetError } = useVehicleContext();
  if (error) return <ErrorBanner error={error} onDismiss={resetError} />;
  if (vehicles.length === 0) return <EmptyState />;
  return (
    <ul className={styles.list} data-testid="vehicle-list">
      {vehicles.map((v) => (
        <li key={v.id} className={styles.card} data-testid="vehicle-item" data-vehicle-id={v.id}>
          <span className={styles.cardBrand}>{v.brand} {v.model} ({v.year})</span>
          <span className={styles.cardPlate}>{v.plate}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <p className={styles.empty} data-testid="vehicle-empty">
      No vehicles yet. Add your first one below.
    </p>
  );
}

function ErrorBanner({ error, onDismiss }: { error: BannerError; onDismiss: () => void }) {
  const title =
    error.kind === "forbidden" ? "Not owner" :
    error.kind === "network" ? "Network error" :
    "Something went wrong";
  return (
    <section role="alert" aria-labelledby="vehicle-banner-title" className={styles.banner} data-testid="vehicle-error-banner">
      <h2 id="vehicle-banner-title" className={styles.bannerTitle}>{title}</h2>
      <p className={styles.bannerMsg}>{error.message}</p>
      <button type="button" onClick={onDismiss} className={styles.bannerDismiss}>Dismiss</button>
    </section>
  );
}