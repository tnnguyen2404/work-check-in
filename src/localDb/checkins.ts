import { openDB } from "idb";

export interface CheckInRecord {
  id: string;
  employeeName: string;
  checkInTime: string;
  checkOutTime?: string;
  workedTime?: number;
  synced: boolean;
}

const DB_NAME = "employee-checkin-db";
const STORE_NAME = "checkins";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  }
});

export async function getAllRecords() {
  return (await dbPromise).getAll(STORE_NAME);
}

export async function saveRecord(record: CheckInRecord) {
  return (await dbPromise).put(STORE_NAME, record);
}