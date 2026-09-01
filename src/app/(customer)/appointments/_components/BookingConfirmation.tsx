"use client";
import { createContext, use, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isBannerEligible } from "@/domain/appointmentStateMachine";
import type { TurnoDTOJson } from "@/lib/api/appointments";

interface Props { turno: TurnoDTOJson; timezone: string; children: React.ReactNode; }
interface CtxValue { turno: TurnoDTOJson; dateFormatter: Intl.DateTimeFormat; }

const Ctx = createContext<CtxValue | null>(null);
function useCtx(): CtxValue {
  const c = use(Ctx);
  if (!c) throw new Error("BookingConfirmation statics must be used inside <BookingConfirmation>");
  return c;
}

export function BookingConfirmationImpl({ turno, timezone, children }: Props) {
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }),
    [timezone],
  );
  const value = useMemo<CtxValue>(() => ({ turno, dateFormatter }), [turno, dateFormatter]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function BookingConfirmationBanner() {
  const { turno } = useCtx();
  if (!isBannerEligible(turno.status)) return null;
  const label = turno.status === "CONFIRMADO" ? "confirmed" : turno.status === "PENDIENTE" ? "received (pending confirmation)" : "recorded";
  return <section role="status" aria-live="polite" data-testid="booking-confirmation-banner"><h2>Booking confirmed</h2><p>Your appointment has been {label}.</p></section>;
}

export function BookingConfirmationDetails() {
  const { turno, dateFormatter } = useCtx();
  if (!isBannerEligible(turno.status)) return null;
  return (
    <dl data-testid="booking-confirmation-details">
      <dt>Start</dt><dd>{dateFormatter.format(new Date(turno.startDateTime))}</dd>
      <dt>End</dt><dd>{dateFormatter.format(new Date(turno.endDateTime))}</dd>
      <dt>Vehicle</dt><dd>{turno.vehicleId}</dd>
      <dt>Service</dt><dd>{turno.serviceId}</dd>
    </dl>
  );
}

export function BookingConfirmationDismiss() {
  const router = useRouter();
  const sp = useSearchParams();
  const { turno } = useCtx();
  if (!isBannerEligible(turno.status)) return null;
  return (
    <button type="button" data-testid="booking-confirmation-dismiss" aria-label="Dismiss confirmation" onClick={() => {
      const p = new URLSearchParams(sp.toString()); p.delete("confirmed");
      const q = p.toString();
      router.replace(q.length > 0 ? `/appointments?${q}` : "/appointments", { scroll: false });
    }}>Dismiss</button>
  );
}

type Compound = typeof BookingConfirmationImpl & {
  Banner: typeof BookingConfirmationBanner;
  Details: typeof BookingConfirmationDetails;
  Dismiss: typeof BookingConfirmationDismiss;
};

export const BookingConfirmation = BookingConfirmationImpl as Compound;
BookingConfirmation.Banner = BookingConfirmationBanner;
BookingConfirmation.Details = BookingConfirmationDetails;
BookingConfirmation.Dismiss = BookingConfirmationDismiss;
