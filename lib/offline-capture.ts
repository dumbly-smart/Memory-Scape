export type CaptureDraft = {
  title?: string;
  content: string;
  occurredAt?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  contextId?: string;
  isPinned?: boolean;
  isSensitive?: boolean;
};
export type QueuedCapture = { key: string; payload: CaptureDraft; createdAt: number };
export type CaptureSyncResult = { synced: number; remaining: number; failed?: string };

const DATABASE = 'memoryscape-offline-capture';
const STORE = 'outbox';

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Offline storage is unavailable in this browser'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage'));
  });
}

export async function enqueueCapture(payload: CaptureDraft, key = crypto.randomUUID()): Promise<QueuedCapture> {
  if (payload.isSensitive) throw new Error('Sensitive notes cannot be queued offline because browser storage is not encrypted');
  const db = await openDatabase();
  const item: QueuedCapture = { key, payload, createdAt: Date.now() };
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(item);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not store offline capture'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Offline capture was not stored'));
    });
    return item;
  } finally { db.close(); }
}

export async function listQueuedCaptures(): Promise<QueuedCapture[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as QueuedCapture[]).sort((a, b) => a.createdAt - b.createdAt));
      request.onerror = () => reject(request.error ?? new Error('Could not read offline captures'));
    });
  } finally { db.close(); }
}

export async function removeQueuedCapture(key: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove synced capture'));
    });
  } finally { db.close(); }
}

export async function syncQueuedCaptures(fetcher: typeof fetch = fetch): Promise<CaptureSyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, remaining: (await listQueuedCaptures()).length };
  let synced = 0;
  for (const item of await listQueuedCaptures()) {
    try {
      const response = await fetcher('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...item.payload, captureKey: item.key }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) return { synced, remaining: (await listQueuedCaptures()).length, failed: body.error ?? 'Could not sync an offline capture' };
      await removeQueuedCapture(item.key);
      synced++;
    } catch {
      return { synced, remaining: (await listQueuedCaptures()).length, failed: 'Connection lost. Offline captures are still saved on this device.' };
    }
  }
  return { synced, remaining: (await listQueuedCaptures()).length };
}
