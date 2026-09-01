/**
 * HTTP helper for service client refetch.
 *
 * Why a thin helper exists at all (per design D1):
 *   - The primary list path is RSC-direct (`listServices(db,{includeInactive:false})`).
 *   - This helper exists for parity with `lib/api/vehicles.ts` so any future
 *     client island (e.g. admin `includeInactive=true` refresh) can reuse
 *     the JSON contract + error parsing without duplicating it.
 *
 * INV-03: cookie auth (`credentials: "include"`). The helper sends cookies so
 * the server can re-derive the user; for public active-only lists the route
 * is public so the cookie is optional — we still send it for parity.
 *
 * INV-08: response is parsed from `ServicioDTO` JSON (camelCase + ISO
 * strings). `Date` never crosses the wire.
 *
 * 401 → caller pushes `/login`; 403 → caller shows "Not admin" banner;
 * 400 → caller maps `issues` to a field error; otherwise generic.
 */
import {
  ApiError,
  type ApiErrorBody,
} from "@/lib/validators/service";

/**
 * Wire-safe service DTO (INV-08). `Date` objects are serialized to ISO
 * strings by the server before reaching the client.
 */
export interface ServiceDTOJson {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListServicesInput {
  includeInactive?: boolean;
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
  return "UNKNOWN_ERROR";
}

/**
 * GET `/api/services?includeInactive=...` returning `ServiceDTOJson[]`.
 *
 * @throws ApiError on non-2xx with parsed `{ code, message, issues?, status }`.
 *         Network / parse errors surface as `ApiError` with
 *         `code:"NETWORK_ERROR"`.
 */
export async function listServices(
  input?: ListServicesInput,
): Promise<ServiceDTOJson[]> {
  const includeInactive = input?.includeInactive ?? false;
  const qs = new URLSearchParams({
    includeInactive: includeInactive ? "true" : "false",
  });
  const url = `/api/services?${qs.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
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

  const data = (await response.json()) as ServiceDTOJson[];
  return data;
}
