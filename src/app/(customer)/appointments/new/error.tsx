"use client";
/**
 * Route-segment error boundary for `/appointments/new`. Per Next.js App
 * Router rules, error boundaries MUST be Client Components.
 *
 * Maps common failure modes to a friendly banner: 401 → push /login; any
 * other → retry via `reset()`. The RSC shell already handles
 * unauthenticated cases via `redirect('/login')`, but a stale session
 * may still slip through to the boundary (defense in depth).
 *
 * INV-03: 401 routing goes through `router.push('/login')`, never the
 * auth helper.
 * INV-08: no `fecha` / `fechaHoraInicio` / `fechaHoraFin` strings leak to
 * the UI — copy uses generic "date" wording.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AppointmentsNewErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

type Kind = "unauthorized" | "other";

function classify(error: Error): Kind {
  const m = error.message ?? "";
  if (/unauthorized|missing token|invalid token/i.test(m)) return "unauthorized";
  return "other";
}

const COPY: Record<Kind, { heading: string; body: string; cta: string }> = {
  unauthorized: {
    heading: "Session expired",
    body: "Please sign in again to pick a date.",
    cta: "Go to login",
  },
  other: {
    heading: "Something went wrong",
    body: "We could not load the date picker. Please try again.",
    cta: "Try again",
  },
};

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid #111827",
  borderRadius: "0.375rem",
  cursor: "pointer",
};

export default function AppointmentsNewError({
  error,
  reset,
}: AppointmentsNewErrorProps) {
  const router = useRouter();
  const kind = classify(error);
  const copy = COPY[kind];

  useEffect(() => {
    // PR1 surface only; FASE 9 (T-052) will wire observability.
    console.error("[/appointments/new] error boundary:", {
      kind,
      message: error.message,
      digest: error.digest,
    });
  }, [error, kind]);

  const onClick =
    kind === "unauthorized" ? () => router.push("/login") : reset;
  const buttonAppearance: React.CSSProperties =
    kind === "unauthorized"
      ? { ...buttonStyle, background: "#111827", color: "white" }
      : { ...buttonStyle, background: "white", color: "#111827" };

  return (
    <section role="alert" aria-labelledby="appointments-new-error-heading">
      <h1
        id="appointments-new-error-heading"
        style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}
      >
        {copy.heading}
      </h1>
      <p style={{ color: "#6b7280", margin: "0.5rem 0 1rem" }}>
        {copy.body}
      </p>
      <button type="button" onClick={onClick} style={buttonAppearance}>
        {copy.cta}
      </button>
    </section>
  );
}
