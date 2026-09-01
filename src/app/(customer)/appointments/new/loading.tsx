/**
 * Route-segment loading boundary for `/appointments/new`. Next.js
 * auto-wraps the page in a Suspense boundary using this component while
 * the RSC shell awaits `auth()` + `getWorkshopConfig` + `listServices`.
 *
 * Mirrors `services/loading.tsx` precedent (3-row shimmer). Inline styles
 * for PR1; PR3 may migrate to `appointments.module.css` shimmers.
 */

const fieldStyle: React.CSSProperties = {
  height: "2.5rem",
  border: "1px solid #e5e7eb",
  borderRadius: "0.375rem",
  background:
    "linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)",
  maxWidth: "16rem",
};

const headingStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 600,
  margin: "0 0 0.75rem",
  color: "#9ca3af",
  height: "2rem",
  width: "12rem",
  borderRadius: "0.375rem",
  background:
    "linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)",
};

const subheadStyle: React.CSSProperties = {
  height: "1rem",
  width: "20rem",
  borderRadius: "0.375rem",
  background:
    "linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)",
  margin: "0 0 1rem",
};

export default function AppointmentsNewLoading() {
  return (
    <section aria-busy="true" aria-label="Loading appointments">
      <h1 style={headingStyle} aria-hidden="true" />
      <p style={subheadStyle} aria-hidden="true" />
      <p style={fieldStyle} aria-hidden="true" />
    </section>
  );
}
