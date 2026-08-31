/**
 * (customer) route group layout — auth-gated shell shared by every
 * customer-facing page (`/vehicles` today, `/appointments`/`/services` for
 * future T-040..T-049).
 *
 * - Server Component (RSC) — runs on every navigation.
 * - Calls `auth()` server-side to resolve the JWT httpOnly cookie session.
 * - Unauthenticated → `redirect('/login')`. Otherwise renders a thin nav +
 *   `<main>{children}</main>` shell. No `<html>`/`<body>` (root layout owns
 *   those).
 *
 * INV-03: every customer page inherits the guard. There is no way to reach a
 * `(customer)/*` page without a valid JWT.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

const navStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  borderBottom: "1px solid var(--color-border, #e5e7eb)",
  display: "flex",
  gap: "1rem",
  alignItems: "center",
};

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "var(--color-fg, #111827)",
  fontWeight: 500,
};

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return (
    <div className="customer-shell">
      <nav aria-label="Customer navigation" style={navStyle}>
        <Link href="/vehicles" style={linkStyle}>
          Vehicles
        </Link>
      </nav>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}