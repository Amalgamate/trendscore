const DB_NAME = 'trendscore-biometric-terminal';
const DB_VERSION = 1;
const CONFIG_STORE = 'configuration';
const EVENT_STORE = 'events';

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('Offline storage is not supported by this browser'));
    return;
  }
  const request = window.indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(CONFIG_STORE)) {
      database.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
    }
    if (!database.objectStoreNames.contains(EVENT_STORE)) {
      const events = database.createObjectStore(EVENT_STORE, { keyPath: 'eventId' });
      events.createIndex('createdAt', 'createdAt');
    }
  };
});

const transact = async (storeName, mode, action) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadTerminalConfiguration = async () => {
  const record = await transact(CONFIG_STORE, 'readonly', (store) => store.get('active'));
  return record?.value || null;
};

export const saveTerminalConfiguration = (value) =>
  transact(CONFIG_STORE, 'readwrite', (store) => store.put({ key: 'active', value }));

export const clearTerminalConfiguration = () =>
  transact(CONFIG_STORE, 'readwrite', (store) => store.delete('active'));

export const enqueueTerminalEvent = (event) =>
  transact(EVENT_STORE, 'readwrite', (store) => store.put({ ...event, createdAt: event.createdAt || Date.now() }));

export const listTerminalEvents = () =>
  transact(EVENT_STORE, 'readonly', (store) => store.getAll());

export const removeTerminalEvent = (eventId) =>
  transact(EVENT_STORE, 'readwrite', (store) => store.delete(eventId));

export const countTerminalEvents = () =>
  transact(EVENT_STORE, 'readonly', (store) => store.count());
