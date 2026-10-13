const DB_NAME = "gymflow-local";
const DB_VERSION = 1;
const STORE_NAME = "appState";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support IndexedDB."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local database."));
  });
}

export async function readValue(key) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error || new Error("Could not read local data."));
    });
  } finally {
    db.close();
  }
}

let pendingWrite = Promise.resolve();

async function performWrite(key, value) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save local data."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving local data was cancelled."));
    });
  } finally {
    db.close();
  }
}

// Serialize writes so a slow older save cannot overwrite a newer restore.
export function writeValue(key, value) {
  const next = pendingWrite.catch(() => {}).then(() => performWrite(key, value));
  pendingWrite = next;
  return next;
}
