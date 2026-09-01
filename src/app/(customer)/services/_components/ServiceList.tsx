"use client";
/**
 * ServiceList — renders the iterable of `ServiceDTOJson[]` from context.
 *
 * Two explicit visual variants, no boolean props:
 *   - Empty state ("No services available") when `services.length === 0`.
 *   - Ordered list of `<ServiceCard>` rows when populated.
 *
 * Order is server-derived (RSC sorts ASC by `createdAt`); the list never
 * resorts client-side. Keys are stable UUIDs from the DTO (T-039 precedent).
 */
import { useServiceContext } from "./ServiceSelector";
import { ServiceCard } from "./ServiceCard";
import styles from "../services.module.css";

export function ServiceList() {
  const { services } = useServiceContext();

  if (services.length === 0) {
    return (
      <p className={styles.empty} data-testid="services-empty">
        No services available.
      </p>
    );
  }

  return (
    <ul className={styles.list} data-testid="services-list">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </ul>
  );
}
