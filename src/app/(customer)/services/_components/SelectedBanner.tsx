"use client";
/**
 * SelectedBanner — shown only when the active selection resolves to a real
 * service in the list. Renders the selection summary + the `Continue` link
 * that preserves `?serviceId=` for the next route (T-041 appointment booking).
 *
 * Source of truth is `useServiceContext().selected`. The banner is hidden
 * when `selected` is `null` (tampered UUID, inactive service, no selection),
 * so a single render-output switch handles all three cases.
 *
 * The Continue href `/appointments/new?serviceId={id}` is URL-canonical —
 * preserves the canonical ?serviceId= param so the next route can re-validate
 * server-side (T-041). The route segment is intentionally a future alias —
 * no T-040 fallback required (spec scenario: "Selection success").
 */
import { useServiceContext } from "./ServiceSelector";
import { formatDuration } from "@/lib/validators/service";
import styles from "../services.module.css";

export function SelectedBanner() {
  const { selected } = useServiceContext();

  if (!selected) return null;

  const continueHref = `/appointments/new?serviceId=${selected.id}`;

  return (
    <section
      className={styles.banner}
      role="status"
      aria-live="polite"
      aria-labelledby="selected-banner-title"
      data-testid="selected-banner"
    >
      <div className={styles.bannerBody}>
        <h2 id="selected-banner-title" className={styles.bannerTitle}>
          Selected: {selected.name}
        </h2>
        <p className={styles.bannerMeta}>
          Duration: {formatDuration(selected.durationMinutes)}
        </p>
      </div>
      <a
        href={continueHref}
        className={styles.bannerCta}
        data-testid="selected-banner-continue"
      >
        Continue
      </a>
    </section>
  );
}
