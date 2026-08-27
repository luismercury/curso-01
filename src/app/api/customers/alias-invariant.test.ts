import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
const createCustomerMock = vi.fn();
const createUserMock = vi.fn();
vi.mock("@/services/customerService", async () => {
  const actual = await vi.importActual<typeof import("@/services/customerService")>("@/services/customerService");
  return { ...actual, createCustomer: (...a: unknown[]) => createCustomerMock(...(a as never[])) };
});
vi.mock("@/db/repositories/users", async () => {
  const actual = await vi.importActual<typeof import("@/db/repositories/users")>("@/db/repositories/users");
  return { ...actual, createUser: (...a: unknown[]) => createUserMock(...(a as never[])) };
});
import { CustomerEmailTakenError } from "@/services/errors";
import { UserEmailTakenError } from "@/db/repositories/users";
import { POST as POSTCustomers } from "@/app/api/customers/route";
import { POST as POSTRegister } from "@/app/api/auth/register/route";
const req = (url: string, body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const payload = { nombre: "Juan", apellido: "Perez", email: "alias@example.com", telefono: "+54 11 1234-5678", password: "Secret123" };
const custDTO = { id: "00000000-0000-4000-a000-000000000001", nombre: "Juan", apellido: "Perez", email: "alias@example.com", telefono: "+54 11 1234-5678" };
const userDTO = { id: "00000000-0000-4000-a000-000000000001", email: "alias@example.com", role: "CLIENTE" as const, createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-01T00:00:00.000Z") };
describe("Alias invariant POST /api/customers vs POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());
  it("same payload → identical 201 with same email", async () => {
    createCustomerMock.mockResolvedValue(custDTO);
    createUserMock.mockResolvedValue(userDTO);
    const a = await POSTCustomers(req("http://localhost/api/customers", payload));
    const b = await POSTRegister(req("http://localhost/api/auth/register", payload));
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect((await a.json() as typeof custDTO).email).toBe(payload.email);
    expect((await b.json() as typeof userDTO).email).toBe(payload.email);
  });
  it("same payload → identical 409 EMAIL_ALREADY_EXISTS", async () => {
    createCustomerMock.mockRejectedValue(new CustomerEmailTakenError(payload.email));
    createUserMock.mockRejectedValue(new UserEmailTakenError(payload.email));
    const a = await POSTCustomers(req("http://localhost/api/customers", payload));
    const b = await POSTRegister(req("http://localhost/api/auth/register", payload));
    expect(a.status).toBe(409); expect(b.status).toBe(409);
    expect((await a.json() as {error:{code:string}}).error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect((await b.json() as {error:{code:string}}).error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});
