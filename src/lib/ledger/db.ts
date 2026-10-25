import { DEFAULT_META, type Bill, type Debt, type Entry, type Meta, type Snapshot } from "./types";

const DB_NAME = "daybook";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser cannot store a daybook offline."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["entries", "photos", "debts", "bills", "meta"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("Could not open the daybook."));
      };
    });
  }
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Save failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Save aborted"));
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, "readonly");
  const request = tx.objectStore(store).getAll();
  const rows = await new Promise<T[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  return rows;
}

async function putRow(store: string, value: { id: string; blob?: Blob }): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

async function deleteRow(store: string, id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

export async function readSnapshot(): Promise<Snapshot> {
  const [entries, debts, bills, metas] = await Promise.all([
    getAll<Entry>("entries"),
    getAll<Debt>("debts"),
    getAll<Bill>("bills"),
    getAll<Meta>("meta"),
  ]);
  return {
    entries,
    debts,
    bills,
    meta: { ...DEFAULT_META, ...(metas.find((meta) => meta.id === "settings") ?? {}) },
  };
}

export async function saveMeta(meta: Meta): Promise<void> {
  await putRow("meta", meta);
}

export async function saveEntry(entry: Entry): Promise<void> {
  await putRow("entries", entry);
}

export async function removeEntry(id: string): Promise<void> {
  await deleteRow("entries", id);
}

export async function saveDebt(debt: Debt): Promise<void> {
  await putRow("debts", debt);
}

export async function removeDebt(id: string): Promise<void> {
  await deleteRow("debts", id);
}

export async function saveBill(bill: Bill): Promise<void> {
  await putRow("bills", bill);
}

export async function removeBill(id: string): Promise<void> {
  await deleteRow("bills", id);
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await putRow("photos", { id, blob });
}

export async function readPhoto(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction("photos", "readonly");
  const request = tx.objectStore("photos").get(id);
  const row = await new Promise<{ id: string; blob: Blob } | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as { id: string; blob: Blob } | undefined);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  return row?.blob ?? null;
}

export async function removePhoto(id: string): Promise<void> {
  await deleteRow("photos", id);
}
