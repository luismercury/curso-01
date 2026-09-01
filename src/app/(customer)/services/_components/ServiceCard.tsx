"use client";
/**
 * ServiceCard — presentational row inside `<ServiceSelector.List>`.
 *
 * Visual responsibility only:
 *   - Render `name`, truncated `description`, and `formatDuration(durationMinutes)`.
 *   - Reflect selection via `aria-pressed` and the `.cardSelected` class.
 *   - Delegate the click → `select(id)` from context.
 *
 * No props for selection state — the card consumes context and decides locally.
 * Toggling between selected/unselected is handled by swapping the CSS class
 * (`styles.cardSelected`) and the `aria-pressed` attribute, not by boolean
 * props (vercel-composition-patterns).
 *
 * INV-08: never renders DB snake_case fields (`nombre`, `duracionMinutos`,
 * `activo`). Only camelCase DTO keys.
 */
import { useServiceContext } from "./ServiceSelector";
import { formatDuration } from "@/lib/validators/service";
import type { ServiceDTOJson } from "@/lib/api/services";
import styles from "../services.module.css";

export interface ServiceCardProps {
  service: ServiceDTOJson;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const { selectedId, select } = useServiceContext();
  const isSelected = service.id === selectedId;

  const onClick = () => {
    if (isSelected) return; // re-click is a no-op (URL would not change)
    select(service.id);
  };

  const className = isSelected
    ? `${styles.card} ${styles.cardSelected}`
    : styles.card;

  return (
    <li data-testid="service-item" data-service-id={service.id}>
      <button
        type="button"
        className={className}
        aria-pressed={isSelected}
        aria-label={`Select ${service.name}`}
        onClick={onClick}
        data-testid="service-card"
      >
        <span className={styles.cardHeader}>
          <span className={styles.cardName}>{service.name}</span>
          <span className={styles.cardDuration}>
            {formatDuration(service.durationMinutes)}
          </span>
        </span>
        {service.description ? (
          <p className={styles.cardDescription}>{service.description}</p>
        ) : null}
      </button>
    </li>
  );
}
