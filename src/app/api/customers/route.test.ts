import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const createCustomerMock = vi.fn();

vi.mock("@/services/customerService", async () => {
  const actual = await vi.importActual<typeof import("@/services/customerService")>(
    "@/services/customerService",
  );
  return {
    ...actual,
    createCustomer: (...args: unknown[]) => createCustomerMock(...(args as never[])),
  };
});

import { CustomerEmailTakenError } from "@/services/errors";
import { POST } from "@/app/api/customers/route";

function makeRequest(body: unknown, rawBody?: string): Request {
  if (rawBody !== undefined) {
    return new Request("http://localhost/api/customers", {
      method: "POST",
      body: rawBody,
      headers: { "content-type": "application/json" },
    });
  }
  return new Request("http://localhost/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validBody = {
  nombre: "Juan",
  apellido: "Perez",
  email: "juan@example.com",
  telefono: "+54 11 1234-5678",
  password: "Secret123",
};

const dto5 = {
  id: "00000000-0000-4000-a000-000000000001",
  nombre: "Juan",
  apellido: "Perez",
  email: "juan@example.com",
  telefono: "+54 11 1234-5678",
};

describe("POST /api/customers — alias of /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("201 returns Spanish 5-field DTO on valid payload", async () => {
    createCustomerMock.mockResolvedValue(dto5);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const json = (await res.json()) as typeof dto5;
    expect(json).toEqual(dto5);
    expect(Object.keys(json).sort()).toEqual(
      ["apellido", "email", "id", "nombre", "telefono"].sort(),
    );
    expect(createCustomerMock).toHaveBeenCalledTimes(1);
    // delegate to service with validated input (email normalized already)
    const calledArg = createCustomerMock.mock.calls[0]?.[1] as typeof validBody;
    expect(calledArg.email).toBe("juan@example.com");
  });

  it("400 VALIDATION_ERROR with §12 envelope on invalid JSON", async () => {
    const res = await POST(makeRequest(null, "not-json"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error).toHaveProperty("message");
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR with issues on Zod validation failure", async () => {
    const invalid = { ...validBody, email: "not-an-email", nombre: "J" };
    const res = await POST(makeRequest(invalid));
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; issues: unknown[] };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect((body.error.issues as unknown[]).length).toBeGreaterThan(0);
    // envelope shape is §12: {error:{code,message,issues}}
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("409 EMAIL_ALREADY_EXISTS with §12 envelope on duplicate email (no flat shape leak)", async () => {
    createCustomerMock.mockRejectedValue(new CustomerEmailTakenError("juan@example.com"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(body.error.message).toContain("juan@example.com");
    const raw = body as unknown as Record<string, unknown>;
    expect(raw).toHaveProperty("error");
    expect(raw).not.toHaveProperty("code");
  });

  it("400 flat shape is not leaked: validation error uses nested error field", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
    const raw = (await res.json()) as Record<string, unknown>;
    expect(raw).toHaveProperty("error");
    expect(raw).not.toHaveProperty("code");
  });
});
