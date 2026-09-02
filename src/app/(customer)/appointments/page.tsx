import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { getWorkshopConfig } from "@/config/workshopConfig";
import { getAppointmentById, listAppointmentsEnriched } from "@/services/appointmentService";
import { parseConfirmedId } from "@/lib/validators/confirmedId";
import { parseAppointmentsQuery } from "@/lib/validators/appointmentsQuery";
import { isBannerEligible } from "@/domain/appointmentStateMachine";
import { toEnrichedJson } from "@/db/mappers/turno";
import type { EnrichedTurnoDTOJson, TurnoDTOJson } from "@/lib/api/appointments";
import type { TurnoDTO } from "@/db/mappers/turno";
import type { AuthUser } from "@/lib/auth/requireAuth";

import { BookingConfirmation } from "./_components/BookingConfirmation";
import { AppointmentList } from "./_components/AppointmentList";

import styles from "./appointments.module.css";

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
  // REQ-04: `parseAppointmentsQuery` clamps `?page&limit` on parse
  // (never throws) so the page never 500s on a tampered URL.
  const { page, limit } = parseAppointmentsQuery(params);
  const config = await getWorkshopConfig(db);

  const [confirmedTurno, enrichedList] = await Promise.all([
    fetchConfirmed(confirmedId, config, authUser),
    listAppointmentsEnriched({ db, config }, { page, limit }, authUser),
  ]);

  // INV-08 + INV-06: serialize every `Date` to ISO 8601 so RSC → client
  // crosses a primitive-only boundary. `toEnrichedJson` is the single
  // source of truth (it also re-asserts the snake→camel mapping).
  const enrichedJson: EnrichedTurnoDTOJson[] = enrichedList.data.map(toEnrichedJson);
  const turnoJson: TurnoDTOJson | null =
    confirmedTurno !== null && isBannerEligible(confirmedTurno.status) ? toJson(confirmedTurno) : null;

  return (
    <section aria-labelledby="appointments-heading">
      <h1 id="appointments-heading" className={styles.headingFocusTarget} tabIndex={-1}>Próximos turnos</h1>
      <p>{turnoJson ? "Reserva confirmada" : `${enrichedList.pagination.total} turnos próximos`}</p>

      {turnoJson ? (
        <Suspense fallback={null}>
          <BookingConfirmation turno={turnoJson} timezone={config.timezone}>
            <BookingConfirmation.Banner />
            <BookingConfirmation.Details />
            <BookingConfirmation.Dismiss />
          </BookingConfirmation>
        </Suspense>
      ) : null}

      <AppointmentList.Root timezone={config.timezone} pagination={enrichedList.pagination}>
        {enrichedJson.length === 0 ? (
          <AppointmentList.Empty />
        ) : (
          <>
            <ol data-testid="appointments-list" role="list">
              {enrichedJson.map((a) => (
                <AppointmentList.Card key={a.id} appointment={a} />
              ))}
            </ol>
            <AppointmentList.Pagination />
          </>
        )}
      </AppointmentList.Root>
    </section>
  );
}