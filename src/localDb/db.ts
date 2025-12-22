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
}

const DB_NAME = "employee-checkin-db";

const dbPromise = openDB<AppDB>(DB_NAME, 2, {
  upgrade(db, oldVersion) {
    if (!db.objectStoreNames.contains("checkins")) {
      db.createObjectStore("checkins", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("employees")) {
      db.createObjectStore("employees", { keyPath: "id" });
    }
  }
});

// Check-in functions
export async function getAllRecords(): Promise<CheckInRecord[]> {
  return (await dbPromise).getAll("checkins");
}

export async function saveRecord(record: CheckInRecord): Promise<void> {
  await (await dbPromise).put("checkins", record);
}

// Employee functions
export async function getAllEmployees(): Promise<Employee[]> {
  return (await dbPromise).getAll("employees");
}

export async function saveEmployee(employee: Employee): Promise<void> {
  await (await dbPromise).put("employees", employee);
}

export async function deleteEmployee(id: string): Promise<void> {
  await (await dbPromise).delete("employees", id);
}
