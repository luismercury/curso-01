/**
 * Route-segment loading boundary for `/vehicles`. Next.js auto-wraps the
 * page in a Suspense boundary using this component while the RSC shell
 * awaits `auth()` + `listVehiclesByCustomer`.
 *
 * Minimal CSS (PR1). PR2 will replace the inline styles with
 * `vehicles.module.css` shimmer + tokens.
 */
const itemStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  border: "1px solid #e5e7eb",
  borderRadius: "0.5rem",
  background:
    "linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)",
  height: "3rem",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "0.75rem",
};

export default function VehiclesLoading() {
  return (
    <section aria-busy="true" aria-label="Loading vehicles">
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          margin: "0 0 0.75rem",
          color: "#9ca3af",
        }}
      >
        Loading vehicles…
      </h1>
      <ul data-testid="vehicle-list-skeleton" style={listStyle}>
        {[0, 1, 2].map((i) => (
          <li key={i} aria-hidden="true" style={itemStyle} />
        ))}
      </ul>
    </section>
  );
}