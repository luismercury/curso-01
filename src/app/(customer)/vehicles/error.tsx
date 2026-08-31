"use client";

/**
 * Route-segment error boundary for `/vehicles`. Per Next.js App Router rules,
 * error boundaries MUST be Client Components.
 *
 * Maps common failure modes to a friendly banner: 401 → push /login (the RSC
 * shell already handles unauthenticated cases via `redirect('/login')`, but a
 * stale session may still slip through to the boundary); 403 → "Not owner";
 * anything else → generic fallback. All branches share `reset()` (Next.js
 * re-renders the segment).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface VehiclesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

type Kind = "unauthorized" | "forbidden" | "other";

function classify(error: Error): Kind {
  const m = error.message ?? "";
  if (/unauthorized|missing token|invalid token/i.test(m)) return "unauthorized";
  if (/not owner|forbidden|requires role/i.test(m)) return "forbidden";
  return "other";
}

const COPY: Record<Kind, { heading: string; body: string; cta: string }> = {
  unauthorized: {
    heading: "Session expired",
    body: "Please sign in again to view your vehicles.",
    cta: "Go to login",
  },
  forbidden: {
    heading: "Not owner",
    body: "You do not have access to this resource.",
    cta: "Try again",
  },
  other: {
    heading: "Something went wrong",
    body: "We could not load your vehicles. Please try again.",
    cta: "Try again",
  },
};

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid #111827",
  borderRadius: "0.375rem",
  cursor: "pointer",
};

export default function VehiclesError({ error, reset }: VehiclesErrorProps) {
  const router = useRouter();
  const kind = classify(error);
  const copy = COPY[kind];

  useEffect(() => {
    // PR1 surface only; FASE 9 (T-052) will wire observability.
    console.error("[/vehicles] error boundary:", {
      kind,
      message: error.message,
      digest: error.digest,
    });
  }, [error, kind]);

  const onClick = kind === "unauthorized" ? () => router.push("/login") : reset;
  const buttonAppearance: React.CSSProperties =
    kind === "unauthorized"
      ? { ...buttonStyle, background: "#111827", color: "white" }
      : { ...buttonStyle, background: "white", color: "#111827" };

  return (
    <section role="alert" aria-labelledby="vehicles-error-heading">
      <h1
        id="vehicles-error-heading"
        style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}
      >
        {copy.heading}
      </h1>
      <p style={{ color: "#6b7280", margin: "0.5rem 0 1rem" }}>{copy.body}</p>
      <button type="button" onClick={onClick} style={buttonAppearance}>
        {copy.cta}
      </button>
    </section>
  );
}