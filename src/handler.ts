import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
    UpdateCommand,
    QueryCommand,
    ScanCommand,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const EMPLOYEES_TABLE = process.env.EMPLOYEES_TABLE || "Employees";
const WORK_RECORD_TABLE = process.env.WORK_RECORD_TABLE || "WorkRecord";
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || "Locations";

const EMPLOYEE_LOCATION_INDEX = process.env.EMPLOYEE_LOCATION_INDEX || "EmployeesByLocation";
const WORK_RECORD_LOCATION_TIME_INDEX = process.env.WORK_RECORD_LOCATION_TIME_INDEX || "WorkRecordByLocationTime";
const WORK_RECORD_BY_EMPLOYEE_INDEX = process.env.WORK_RECORD_BY_EMPLOYEE_INDEX || "WorkRecordByEmployeeId";
const EMPLOYEE_IDENTIFIER_INDEX = process.env.EMPLOYEE_IDENTIFIER_INDEX || "EmployeesByIdentifier";
const WORK_RECORD_BY_LOCATION_INDEX = process.env.WORK_RECORD_BY_LOCATION_INDEX || "WorkRecordByLocationId";

const COOLDOWN_MS = 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,PATCH,DELETE",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function noContent() {
  return { statusCode: 204, headers: CORS, body: "" };
}

function getMethod(event) {
  return event.httpMethod || event.requestContext?.http?.method || "GET";
}
function getPath(event) {
  return event.rawPath || event.path || "/";
}

function requireString(v, name) {
  if (typeof v !== "string" || !v.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

function requireNumber(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}`);
  return n;
}

function isDigits(s) {
  return /^\d+$/.test(s);
}

function getLocalOpenDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function resolveEmployee(inputRaw) {
  const input =
    typeof inputRaw === "number"
      ? String(inputRaw)
      : typeof inputRaw === "string"
      ? inputRaw.trim()
      : "";

  if (!input) throw new Error("Missing input");

  const lower = input.toLowerCase();

  const byIdentifier = await getEmployeeByIdentifier(lower);
  if (byIdentifier) return byIdentifier;

  if (isDigits(input)) {
    const byId = await getEmployeeById(Number(input));
    if (byId) return byId;
  }

  return null;
}


function parseJson(event) {
  if (!event.body) return {};
  try {
    return event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body, "base64").toString("utf8"))
      : JSON.parse(event.body);
  } catch {
    return {};
  }
}

function minutesBetween(startEpochMs, endEpochMs) {
  if (!Number.isFinite(startEpochMs) || !Number.isFinite(endEpochMs)) return 0;
  if (endEpochMs < startEpochMs) return 0;
  return Math.floor((endEpochMs - startEpochMs) / 60000);
}

function hasRecentAutoCheckout(records) {
  const now = Date.now();
  return records?.some(
    (r) => r?.autoClosed === true && r?.checkOutAt && now - r.checkOutAt <= TWO_WEEKS_MS
  );
}

// -------------------- LOCATIONS --------------------

async function createLocation(body) {
    const name = requireString(body.name, "name");
    const id = crypto.randomUUID();

    const item = { id, name };

    await ddb.send(
        new PutCommand({
            TableName: LOCATIONS_TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(id)",
        })
    );
    return item;
}

async function deleteLocation(id) {
    const emp = await getEmployeeByLocation(id);
    const wrs = await getWorkRecordsByLocationId(id);

    for (const e of emp) {
      const employeeId = e.id;
      await deleteEmployee(employeeId);
    }

    for (const w of wrs) {
      const workRecordId = w.id;
      await deleteWorkRecord(workRecordId);
    }

    await ddb.send(
        new DeleteCommand({
            TableName: LOCATIONS_TABLE,
            Key: { id },
        })
    );
}

async function getLocationById(id) {
  const r = await ddb.send(
    new GetCommand({
        TableName: LOCATIONS_TABLE,
        Key: { id },
    })
  );
  return r.Item || null;
}

async function listLocations(limit = 500) {
  let items = [];
  let ExclusiveStartKey = undefined;

  do {
    const r = await ddb.send(
      new ScanCommand({
        TableName: LOCATIONS_TABLE,
        ExclusiveStartKey,
        Limit: Math.min(500, limit - items.length),
      })
    );

    items = items.concat(r.Items || []);
    ExclusiveStartKey = r.LastEvaluatedKey;

    if (items.length >= limit) break;
  } while (ExclusiveStartKey);

  return items;
}



// -------------------- EMPLOYEES --------------------

async function createEmployee(body) {
  const id = requireNumber(body.id, "id");
  const name = requireString(body.name, "name");
  const identifier = requireString(body.identifier, "identifier");
  const locationId = requireString(body.locationId, "locationId");

  const item = {
    id,
    name,
    identifier,
    locationId,
  };

  await ddb.send(
    new PutCommand({
      TableName: EMPLOYEES_TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return item;
}

async function deleteEmployee(id) {
    const emp = await getEmployeeById(id);
    const wrs = await getWorkRecordByEmployeeId(id);

    for (const w of wrs) {
      const workRecordId = w.id;
      await deleteWorkRecord(workRecordId);
    }
    
    if (!emp) return { ok: true };

    await ddb.send(
        new DeleteCommand({
            TableName: EMPLOYEES_TABLE,
            Key: { id },
        })
    );

    return { ok: true };
}

async function getEmployeeById(id) {
  const r = await ddb.send(
    new GetCommand({
      TableName: EMPLOYEES_TABLE,
      Key: { id },
    })
  );
  return r.Item || null;
}

async function getEmployeeByIdentifier(identifier) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: EMPLOYEES_TABLE,
      IndexName: EMPLOYEE_IDENTIFIER_INDEX,
      KeyConditionExpression: "identifier = :x",
      ExpressionAttributeValues: { ":x": identifier },
      Limit: 1,
    })
  );
  return (q.Items && q.Items[0]) || null;
}

async function getEmployeeByLocation(locationId) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: EMPLOYEES_TABLE,
      IndexName: EMPLOYEE_LOCATION_INDEX,
      KeyConditionExpression: "locationId = :loc",
      ExpressionAttributeValues: { ":loc": locationId },
    })
  );
  return q.Items || null;
}

// -------------------- WORK RECORDS --------------------

async function listAutoClosedByLocationAndDate(locationId, openDate) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: WORK_RECORD_TABLE,
      IndexName: WORK_RECORD_BY_LOCATION_INDEX,
      KeyConditionExpression: "locationId = :loc",
      FilterExpression:
        "openDate = :d AND autoClosed = :t AND (attribute_not_exists(autoClosedFixed) OR autoClosedFixed = :f)",
      ExpressionAttributeValues: {
        ":loc": locationId,
        ":d": openDate,
        ":t": true,
        ":f": false,
      },
    })
  );
  return q.Items ?? [];
}


async function getWorkRecordById(id) {
  const r = await ddb.send(
    new GetCommand({
      TableName: WORK_RECORD_TABLE,
      Key: { id },
    })
  );
  return r.Item || null;
}

async function createWorkRecord(body) {

  let employee = null;

  if (body.employeeId != null) {
    employee = await getEmployeeById(requireNumber(body.employeeId, "employeeId"));
  } else if (body.input != null) {
    employee = await resolveEmployee(body.input);
  } else {
    throw new Error("Missing employeeId or username");
  }

  if (!employee) throw new Error("Employee not found");

  const checkInAt = body.checkInAt != null ? requireNumber(body.checkInAt, "checkInAt") : Date.now();
  const checkOutAt = body.checkOutAt != null ? requireNumber(body.checkOutAt, "checkOutAt") : null;

  if (checkOutAt != null && checkOutAt < checkInAt) {
    throw new Error("checkOutAt must be >= checkInAt");
  }

  const workedTime = checkOutAt != null ? minutesBetween(checkInAt, checkOutAt) : null;

  const id = crypto.randomUUID();
  const item = {
    id,
    employeeId: employee.id,
    employeeName: employee.name,
    locationId: employee.locationId,

    checkInAt,
    checkOutAt,
    workedTime,

    isOpen: checkOutAt == null,              
    openDate: getLocalOpenDate(new Date(checkInAt)), 
    autoClosed: false,                       
    autoClosedFixed: false,                  
  };

  await ddb.send(
    new PutCommand({
      TableName: WORK_RECORD_TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return item;
}

async function getWorkRecordByEmployeeId(employeeId) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: WORK_RECORD_TABLE,
      IndexName: WORK_RECORD_BY_EMPLOYEE_INDEX,
      KeyConditionExpression: "employeeId = :eid ",
      ExpressionAttributeValues: {
        ":eid": employeeId,
      },
      ScanIndexForward: true,
    })
  );
  return q.Items || [];
}

async function getWorkRecordByEmployeeRange(employeeId, fromEpoch, toEpoch) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: WORK_RECORD_TABLE,
      IndexName: WORK_RECORD_BY_EMPLOYEE_INDEX,
      KeyConditionExpression: "employeeId = :eid AND checkInAt BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":eid": employeeId,
        ":from": fromEpoch,
        ":to": toEpoch,
      },
      ScanIndexForward: true,
    })
  );
  return q.Items || [];
}

async function getWorkRecordsByLocationRange(locationId, fromEpoch, toEpoch) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: WORK_RECORD_TABLE,
      IndexName: WORK_RECORD_LOCATION_TIME_INDEX,
      KeyConditionExpression: "locationId = :loc AND checkInAt BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":loc": locationId,
        ":from": fromEpoch,
        ":to": toEpoch,
      },
      ScanIndexForward: true,
    })
  );
  return q.Items || [];
}

async function getWorkRecordsByLocationId(locationId) {
  const q = await ddb.send(
    new QueryCommand({
      TableName: WORK_RECORD_TABLE,
      IndexName: WORK_RECORD_BY_LOCATION_INDEX,
      KeyConditionExpression: "locationId = :loc",
      ExpressionAttributeValues: { ":loc": locationId },
    })
  );
  return q.Items || [];
}

async function deleteWorkRecord(id) {
  const wr = await getWorkRecordById(id);
  if (!wr) return { ok: true };

  await ddb.send(
    new DeleteCommand({
      TableName: WORK_RECORD_TABLE,
      Key: { id },
    })
  );

  return { ok: true };
}

async function fixWorkRecordTimes(body) {
  const id = requireString(body.id, "id");
  const checkInAt = requireNumber(body.checkInAt, "checkInAt");
  const checkOutAt = requireNumber(body.checkOutAt, "checkOutAt");

  if (checkOutAt <= checkInAt) throw new Error("checkOutAt must be after checkInAt");

  const workedTime = minutesBetween(checkInAt, checkOutAt);
  const openDate = getLocalOpenDate(new Date(checkInAt));

  await ddb.send(
    new UpdateCommand({
      TableName: WORK_RECORD_TABLE,
      Key: { id },
      UpdateExpression:
        "SET checkInAt = :ci, checkOutAt = :co, workedTime = :wt, isOpen = :f, openDate = :od, fixedAt = :now, autoClosedFixed = :t",
      ExpressionAttributeValues: {
        ":ci": checkInAt,
        ":co": checkOutAt,
        ":wt": workedTime,
        ":f": false,
        ":od": openDate,
        ":t": true,
        ":now": Date.now(),
      },
    })
  );

  return { ok: true };
}



// -------------------- SCAN (CHECK-IN/OUT) --------------------

async function toggleScan(body) {
  const input = body.input ?? body.identifier ?? body.username ?? body.employeeInput ?? body.value;
  const employee = await resolveEmployee(input);

  if (!employee) throw new Error("Employee not found");

  const nowMs = Date.now();
  const lastScanAt = typeof employee.lastScanAt === "number" ? employee.lastScanAt : 0;

  if (lastScanAt && nowMs - lastScanAt < COOLDOWN_MS) {
    throw new Error("Please wait 1 minutes before checking in/out again.");
  }

  if (typeof employee.currentWorkRecordId === "string") {
    const workRecordId = employee.currentWorkRecordId;

    const rec = await ddb.send(
      new GetCommand({
        TableName: WORK_RECORD_TABLE,
        Key: { id: workRecordId },
      })
    );
    const record = rec.Item;
    if (!record) throw new Error("Active work record not found");

    const checkInAt = Number(record.checkInAt);
    if (!Number.isFinite(checkInAt)) throw new Error("Invalid record.checkInAt");

    const workedTime = minutesBetween(checkInAt, nowMs);

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: WORK_RECORD_TABLE,
              Key: { id:workRecordId },
              UpdateExpression:
                "SET checkOutAt = :outAt, workedTime = :wt, synced = :syn, isOpen = :f",
              ConditionExpression: "attribute_not_exists(checkOutAt)",
              ExpressionAttributeValues: {
                ":outAt": nowMs,
                ":wt": workedTime,
                ":syn": true,
                ":f": false,
              },
            },
          },
          {
            Update: {
              TableName: EMPLOYEES_TABLE,
              Key: { id: employee.id },
              UpdateExpression: "REMOVE currentWorkRecordId SET lastScanAt = :lsa",
              ConditionExpression: "currentWorkRecordId = :wid",
              ExpressionAttributeValues: {
                ":wid": workRecordId,
                ":lsa": nowMs,
              },
            },
          },
        ],
      })
    );

    return {
      action: "checkout",
      employee: {
        id: employee.id,
        name: employee.name,
        identifier: employee.identifier,
        locationId: employee.locationId,
      },
      isOpen: false,
      workRecordId,
      checkOutAt: nowMs,
      workedTime,
    };
  }

  const workRecordId = crypto.randomUUID();

  const newRecord = {
    id: workRecordId,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeIdentifier: employee.identifier,
    locationId: employee.locationId,

    checkInAt: nowMs,
    workedTime: null,

    isOpen: true,
    openDate: getLocalOpenDate(),

    synced: true,
  };

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: WORK_RECORD_TABLE,
            Item: newRecord,
          },
        },
        {
          Update: {
            TableName: EMPLOYEES_TABLE,
            Key: { id: employee.id },
            UpdateExpression: "SET currentWorkRecordId = :wid, lastScanAt = :lsa",
            ConditionExpression: "attribute_not_exists(currentWorkRecordId)",
            ExpressionAttributeValues: {
              ":wid": workRecordId,
              ":lsa": nowMs,
            },
          },
        },
      ],
    })
  );

  return {
    action: "checkin",
    employee: {
      id: employee.id,
      name: employee.name,
      identifier: employee.identifier,
      locationId: employee.locationId,
    },
    workRecord: newRecord,
  };
}


export const handler = async (event) => {
  try {
    const method = getMethod(event);
    const path = getPath(event);

    if (method === "OPTIONS") return noContent();

    {
      const m = path.match(/^\/locations\/([^/]+)$/);
      if (method === "GET" && m) {
        const locationId = m[1];
        const item = await getLocationById(locationId);

        if (!item) return json(404, { message: "Location not found" });
        return json(200, item);
      }
    }

    if (method === "GET" && path === "/locations") {
      const items = await listLocations();
      return json(200, items);
    }

    if (method === "POST" && path === "/locations") {
      const body = parseJson(event);
      const item = await createLocation(body);
      return json(201, item);
    }

    {
      const m = path.match(/^\/locations\/([^/]+)$/);
      if (method === "DELETE" && m) {
        const locationId = m[1];
        const out = await deleteLocation(locationId);
        return json(200, out);
      }
    }

    {
      const m = path.match(/^\/employees\/(\d+)$/);
      if (method === "GET" && m) {
        const employeeId = Number(m[1]);
        const emp = await getEmployeeById(employeeId);
        if (!emp) return json(404, { message: "Employee not found" });
          return json(200, emp);
      }
    }

    if (method === "GET" && path === "/employees") {
      const qs = event.queryStringParameters || {};

      if (qs.locationId) {
        const locationId = qs.locationId;

        const employees = await getEmployeeByLocation(locationId);

        const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
        const from = Date.now() - TWO_WEEKS_MS;
        const to = Date.now();

        const workRecords = await getWorkRecordsByLocationRange(locationId, from, to);

        const byEmployee = {}; // employeeId(string) -> workRecords[]
        for (const wr of workRecords) {
          const k = String(wr.employeeId);
          if (!byEmployee[k]) byEmployee[k] = [];
          byEmployee[k].push(wr);
        }

        const result = employees.map((emp) => ({
          ...emp,
          hasRecentAutoCheckout: (byEmployee[String(emp.id)] || []).some(
  (r) => r.autoClosed === true && typeof r.checkOutAt === "number"
),
        }));

        return json(200, result);
      }

      if (qs.identifier) {
        const identifier = qs.identifier;
        const item = await getEmployeeByIdentifier(identifier);
        return json(200, item ? [item] : []);
      }

      return json(400, { message: "Provide locationId or employeeId" });
    }


    if (method === "POST" && path === "/employees") {
      const body = parseJson(event);
      const item = await createEmployee(body);
      return json(201, item);
    }

    {
      const m = path.match(/^\/employees\/(\d+)$/);
      if (method === "DELETE" && m) {
        const employeeId = Number(m[1]);
        const out = await deleteEmployee(employeeId);
        return json(200, out);
      }
    }

    if (method === "POST" && path === "/workRecord") {
      const body = parseJson(event);
      const item = await createWorkRecord(body);
      return json(201, item);
    }

    {
      const m = path.match(/^\/workRecord\/([^/]+)$/);
        if (method === "DELETE" && m) {
        const workRecordId = m[1]; // string UUID
        const out = await deleteWorkRecord(workRecordId);
        return json(200, out);
        }
    }

    if (method === "GET" && path === "/workRecord") {
      const qs = event.queryStringParameters || {};

      if (qs.locationId) {
        const locationId = qs.locationId;
        const from = Number(qs.from);
        const to = Number(qs.to);
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
          return json(400, { message: "Missing from/to for location query" });
        }
        const items = await getWorkRecordsByLocationRange(locationId, from, to);
        return json(200, items);
      }

      if (qs.employeeId) {
        const employeeId = Number(qs.employeeId);

        const from = qs.from != null ? Number(qs.from) : null;
        const to = qs.to != null ? Number(qs.to) : null;
        const items = await getWorkRecordByEmployeeRange(employeeId, from, to);

        return json(200, items);
      }

      return json(400, { message: "Provide locationId or employeeId" });
    }

    // GET /workrecords/auto-closed?locationId=...&openDate=YYYY-MM-DD
    if (method === "GET" && path === "/workRecord/auto-closed") {
      const qs = event.queryStringParameters || {};
      const locationId = requireString(qs.locationId, "locationId");
      const openDate = requireString(qs.openDate, "openDate");
      const items = await listAutoClosedByLocationAndDate(locationId, openDate);
      return json(200, { items });
    }

    if (method === "PATCH" && path === "/workRecord/fix-times") {
      const body = JSON.parse(event.body);
      const out = await fixWorkRecordTimes(body);
      return json(200, out);
    }

    if (method === "POST" && path === "/scan") {
      const body = parseJson(event);
      const result = await toggleScan(body);
      return json(200, result);
    }

    return json(404, { message: "Not found", method, path });
  } catch (e) {
    return json(400, { message: e?.message || "Bad Request" });
  }
};