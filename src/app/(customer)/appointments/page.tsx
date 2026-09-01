import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { getWorkshopConfig } from "@/config/workshopConfig";
import { getAppointmentById, listAppointments } from "@/services/appointmentService";
import { parseConfirmedId } from "@/lib/validators/confirmedId";
import { isBannerEligible } from "@/domain/appointmentStateMachine";
import type { TurnoDTO } from "@/db/mappers/turno";
import type { TurnoDTOJson } from "@/lib/api/appointments";
import type { AuthUser } from "@/lib/auth/requireAuth";

import { BookingConfirmation } from "./_components/BookingConfirmation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ confirmed?: string; page?: string; limit?: string }> };

function toJson(d: TurnoDTO): TurnoDTOJson {
  return {
    id: d.id, customerId: d.customerId, vehicleId: d.vehicleId, serviceId: d.serviceId,
    startDateTime: d.startDateTime.toISOString(), endDateTime: d.endDateTime.toISOString(),
    status: d.status, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  };
}

function toAuthUser(s: unknown): AuthUser {
  const u = (s as { user?: { id?: string; email?: string; role?: string } } | null)?.user;
  return { id: u?.id ?? "", email: u?.email ?? "", role: u?.role === "ADMINISTRADOR" ? "ADMINISTRADOR" : "CLIENTE" };
}

async function fetchConfirmed(id: string | null, config: Awaited<ReturnType<typeof getWorkshopConfig>>, authUser: AuthUser): Promise<TurnoDTO | null> {
  if (id === null) return null;
  try { return await getAppointmentById({ db, config }, id, authUser); } catch { return null; }
}

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const authUser = toAuthUser(session);

  const params = await searchParams;
  const confirmedId = parseConfirmedId(params.confirmed);
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const config = await getWorkshopConfig(db);

  const [confirmedTurno, list] = await Promise.all([
    fetchConfirmed(confirmedId, config, authUser),
    listAppointments({ db, config }, { page, limit }, authUser),
  ]);

  const turnoJson: TurnoDTOJson | null =
    confirmedTurno !== null && isBannerEligible(confirmedTurno.status) ? toJson(confirmedTurno) : null;

  return (
    <section aria-labelledby="appointments-heading">
      <h1 id="appointments-heading">My appointments</h1>
      <p>{turnoJson ? "Booking confirmed" : `${list.pagination.total} upcoming`}</p>

      {turnoJson ? (
        <Suspense fallback={null}>
          <BookingConfirmation turno={turnoJson} timezone={config.timezone}>
            <BookingConfirmation.Banner />
            <BookingConfirmation.Details />
            <BookingConfirmation.Dismiss />
          </BookingConfirmation>
        </Suspense>
      ) : null}

      {list.data.length === 0 ? (
        <p data-testid="appointments-empty">No upcoming appointments.</p>
      ) : (
        <ol data-testid="appointments-list">
          {list.data.map((t) => (
            <li key={t.id}><span>{t.serviceId}</span><span>{t.startDateTime.toISOString()}</span></li>
          ))}
        </ol>
      )}
    </section>
  );
}
