import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface WorkRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeIdentifier?: string;
  checkInTime: string;
  checkOutTime?: string;
  workedTime?: number;
  synced: boolean;
}

export interface Employee {
  id: number;
  identifier: string;
  name: string;
  createdAt: string;
  locationId: string;
}

export interface Location {
  id: string;
  name: string;
  createdAt: string;
}

interface AppDB extends DBSchema {
  workRecords: {
    key: string;
    value: WorkRecord;
  };
  employees: {
    key: number;
    value: Employee;
  };
  locations: {
    key: string;
    value: Location;
  };
}

const DB_NAME = "employee-checkin-db";

const dbPromise = openDB<AppDB>(DB_NAME, 3, {
  upgrade(db, oldVersion) {
    if (!db.objectStoreNames.contains("workRecords")) {
      db.createObjectStore("workRecords", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("employees")) {
      db.createObjectStore("employees", { keyPath: "id" });
    }

    if (!db.objectStoreNames.contains("locations")) {
      db.createObjectStore("locations", { keyPath: "id" });
    }
  }
});

export async function getAllRecords(): Promise<WorkRecord[]> {
  return (await dbPromise).getAll("workRecords");
}

export async function saveRecord(record: WorkRecord): Promise<void> {
  await (await dbPromise).put("workRecords", record);
}

export async function getAllEmployees(): Promise<Employee[]> {
  return (await dbPromise).getAll("employees");
}

export async function saveEmployee(employee: Employee): Promise<void> {
  await (await dbPromise).put("employees", employee);
}

export async function deleteEmployee(id: number): Promise<void> {
  await (await dbPromise).delete("employees", id);
}

export async function getAllLocations(): Promise<Location[]> {
  return (await dbPromise).getAll("locations");
}

export async function saveLocation(location: Location): Promise<void> {
  await (await dbPromise).put("locations", location);
}

export async function deleteLocation(id: string): Promise<void> {
  await (await dbPromise).delete("locations", id);
}