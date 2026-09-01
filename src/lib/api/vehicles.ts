/**
 * HTTP helper for vehicle client mutations.
 *
 * Why POST-only (per design D1): the list is fetched directly via the service
 * in the RSC shell (`listVehiclesByCustomer(db, customerId)`) to skip the
 * internal HTTP hop. The create path still exercises the T-014 boundary
 * (`POST /api/customers/{customerId}/vehicles`) so the JSON contract stays the
 * source of truth and any future mobile client can reuse it.
 *
 * INV-03: cookie auth (`credentials: "include"`). UI never reads/sends
 * `customerId` itself — it is always the session-derived id passed by the RSC
 * shell after `auth()` resolves server-side.
 *
 * INV-08: response is parsed from `VehiculoDTO` JSON (camelCase + ISO strings).
 *
 * 401 → caller pushes `/login`; 403 → caller shows "Not owner" banner;
 * 400 → caller maps `issues[0].path` to a field error; 409 → caller maps to
 * the `plate` field.
 */
import {
  ApiError,
  type ApiErrorBody,
  type VehicleCreatePayload,
} from "@/lib/validators/vehicle";

export interface VehicleDTOJson {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateVehicleInput {
  customerId: string;
  payload: VehicleCreatePayload;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const e = (value as { error?: unknown }).error;
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  const message = (e as { message?: unknown }).message;
  return typeof code === "string" && typeof message === "string";
}

function statusToFallbackCode(status: number): string {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return "UNKNOWN_ERROR";
}

/**
 * POST a new vehicle to `/api/customers/{customerId}/vehicles`.
 *
 * @throws ApiError on non-2xx with parsed `{ code, message, issues?, status }`.
 *         Network / parse errors surface as `ApiError` with `code:"NETWORK_ERROR"`.
 */
export async function createVehicle(
  input: CreateVehicleInput,
): Promise<VehicleDTOJson> {
  const url = `/api/customers/${encodeURIComponent(input.customerId)}/vehicles`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.payload),
    });
  } catch (e) {
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Network error",
      status: 0,
    });
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // fall through with body = null
    }
    if (isErrorBody(body)) {
      throw new ApiError({
        code: body.error.code,
        message: body.error.message,
        status: response.status,
        issues: body.error.issues,
      });
    }
    throw new ApiError({
      code: statusToFallbackCode(response.status),
      message: response.statusText || "Request failed",
      status: response.status,
    });
  }

  const data = (await response.json()) as VehicleDTOJson;
  return data;
}