import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface CheckInRecord {
  id: string;
  employeeName: string;
  checkInTime: string;
  checkOutTime?: string;
  workedTime?: number;
  synced: boolean;
}

export interface Employee {
  id: string;
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
  checkins: {
    key: string;
    value: CheckInRecord;
  };
  employees: {
    key: string;
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
    if (!db.objectStoreNames.contains("checkins")) {
      db.createObjectStore("checkins", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("employees")) {
      db.createObjectStore("employees", { keyPath: "id" });
    }

    if (!db.objectStoreNames.contains("locations")) {
      db.createObjectStore("locations", { keyPath: "id" });
    }
  }
});

export async function getAllRecords(): Promise<CheckInRecord[]> {
  return (await dbPromise).getAll("checkins");
}

export async function saveRecord(record: CheckInRecord): Promise<void> {
  await (await dbPromise).put("checkins", record);
}

export async function getAllEmployees(): Promise<Employee[]> {
  return (await dbPromise).getAll("employees");
}

export async function saveEmployee(employee: Employee): Promise<void> {
  await (await dbPromise).put("employees", employee);
}

export async function deleteEmployee(id: string): Promise<void> {
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