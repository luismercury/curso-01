// TODO T-028: replace with AppointmentService transaction
import { DomainError } from "@/lib/errors";
import { ForbiddenError, type AuthUser } from "@/lib/auth/requireAuth";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";
import type { ServicioDTO } from "@/db/mappers/servicio";

export class InvalidServiceError extends DomainError {
  readonly code = "INVALID_SERVICE" as const;
  constructor(message?: string) {
    super(message ?? "Invalid service");
    this.name = "InvalidServiceError";
  }
}

export function assertCanCreateAppointment(
  vehicle: VehiculoDTO,
  servicio: ServicioDTO,
  authUser: AuthUser,
): void {
  if (vehicle.customerId !== authUser.id && authUser.role !== "ADMINISTRADOR") {
    throw new ForbiddenError("Not owner of this vehicle");
  }
  if (!servicio.active) {
    throw new InvalidServiceError(`Servicio "${servicio.name}" is not active`);
  }
}
