"use client";
/**
 * SummaryCard — atomic 4-row confirmation summary for the booking form.
 *
 * Renders `Service / Vehicle / Date / Time` as a read-only recap so the
 * user can sanity-check the 4 selections before clicking Confirm. Pulled
 * out as a separate static for two reasons:
 *   1. The compound namespace keeps each visual state in its own module
 *      so the parent (BookingForm.tsx) stays scannable.
 *   2. Tests can mount `<SummaryCard>` standalone for layout/unit tests
 *      without spinning up the whole submit pipeline.
 *
 * INV-08: only primitive props cross. No Date objects, no internal DTOs.
 *
 * Composition pattern (no boolean props): the parent decides whether to
 * render Summary alongside the form. There is no "with/without summary"
 * variant — either include `<BookingForm.Summary />` or omit it.
 */
import styles from "../appointments.module.css";

export interface SummaryCardProps {
  /** Display label for the selected service (e.g. `"Oil Change"`). */
  serviceName: string;
  /**
   * Display label for the selected vehicle. Already formatted by the
   * page (e.g. `"Toyota Corolla (2020) — AB123CD"`).
   */
  vehicleLabel: string;
  /** YYYY-MM-DD calendar string (BA timezone, already validated upstream). */
  date: string;
  /** HH:mm string (30-min step, already validated upstream). */
  slot: string;
}

export function SummaryCard({
  serviceName,
  vehicleLabel,
  date,
  slot,
}: SummaryCardProps) {
  return (
    <section
      className={styles.summary}
      aria-labelledby="booking-summary-title"
      data-testid="booking-summary"
    >
      <h2
        id="booking-summary-title"
        className={styles.bannerTitle}
      >
        Booking summary
      </h2>
      <dl className={styles.summaryList}>
        <div className={styles.summaryRow} data-testid="booking-summary-row-service">
          <dt className={styles.summaryLabel}>Service</dt>
          <dd className={styles.summaryValue}>{serviceName}</dd>
        </div>
        <div className={styles.summaryRow} data-testid="booking-summary-row-vehicle">
          <dt className={styles.summaryLabel}>Vehicle</dt>
          <dd className={styles.summaryValue}>{vehicleLabel}</dd>
        </div>
        <div className={styles.summaryRow} data-testid="booking-summary-row-date">
          <dt className={styles.summaryLabel}>Date</dt>
          <dd className={styles.summaryValue}>{date}</dd>
        </div>
        <div className={styles.summaryRow} data-testid="booking-summary-row-time">
          <dt className={styles.summaryLabel}>Time</dt>
          <dd className={styles.summaryValue}>{slot}</dd>
        </div>
      </dl>
    </section>
  );
}