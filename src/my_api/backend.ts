import { get } from "http";

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "";

type ApiErrorShape = { message?: string };

function joinUrl(base: string, path: string) {
  if (!base) throw new Error("Missing VITE_API_BASE_URL");
  if (base.endsWith("/") && path.startsWith("/")) return base.slice(0, -1) + path;
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}


async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  let body = init?.body;

  if (init && "json" in init) {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json ?? {});
  }

  const res = await fetch(url, { ...init, headers, body });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg =
      (data as any)?.message ||
      text ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}


function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------- Types ----------
export type Location = {
  id: string;
  name: string;
};

export type Employee = {
  id: number;
  name: string;
  locationId: string;
  identifier?: string;
  username?: string;
  currentWorkRecordId?: string | null;
  lastScanAt?: number;
};

export type WorkRecord = {
  id: string;
  employeeId: number;
  employeeName?: string;
  locationId?: string;
  checkInAt: number;
  checkOutAt?: number | null;
  workedTime?: number | null; 
};

export type ScanResult =
  | {
      action: "checkin";
      employee: { id: number; name: string; identifier?: string; locationId: string };
      workRecord: WorkRecord;
    }
  | {
      action: "checkout";
      employee: { id: number; name: string; identifier?: string; locationId: string };
      workRecordId: string;
      checkOutAt: number;
      workedTime: number;
    };

export const api = {
  listLocations: () => apiFetch<Location[]>("/locations", { method: "GET" }),

  createLocation: (name: string) =>
    apiFetch<Location>("/locations", { method: "POST", json: { name } }),

  deleteLocation: (locationId: string) =>
    apiFetch<{ ok?: boolean }>(`/locations/${encodeURIComponent(locationId)}`, { method: "DELETE" }),

  listEmployeesByLocation: (locationId: string) =>
    apiFetch<Employee[]>(
      `/employees?locationId=${encodeURIComponent(locationId)}`
    ),

  listEmployeesByIdentifier: (identifier: string) =>
    apiFetch<Employee[]>(
      `/employees?identifier=${identifier}`
    ),

  getEmployeeById: (employeeId: number) =>
    apiFetch<Employee>(`/employees/${employeeId}`, { method: "GET" }),



  createEmployee: (employee: {
    id: number;
    name: string;
    identifier: string;
    locationId: string;
  }) => apiFetch<Employee>("/employees", { method: "POST", json: employee }),

  deleteEmployee: (employeeId: number) =>
    apiFetch<{ ok?: boolean }>(`/employees/${employeeId}`, { method: "DELETE" }),

  scanToggle: (input) =>
    apiFetch<ScanResult>("/scan", { method: "POST", json: { input } }),

  listWorkRecordsByLocationRange: (locationId: string, from: number, to: number) => {
  const q = new URLSearchParams({
    locationId,
    from: String(from),
    to: String(to),
  }).toString();

  return apiFetch<WorkRecord[]>(`/workRecord?${q}`, { method: "GET" });
},

listWorkRecordsByEmployeeRange: (employeeId: number, from: number, to: number) => {
  const q = new URLSearchParams({
    employeeId: String(employeeId),
    from: String(from),
    to: String(to),
  }).toString();

  return apiFetch<WorkRecord[]>(`/workRecord?${q}`, { method: "GET" });
},

};
