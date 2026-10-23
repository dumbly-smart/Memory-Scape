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
type EncryptedCapture = { key: string; createdAt: number; version: 1; salt: string; iv: string; ciphertext: string };
type LegacyCapture = QueuedCapture;
type StoredCapture = EncryptedCapture | LegacyCapture;

const DATABASE = 'memoryscape-offline-capture';
const STORE = 'outbox';
const ITERATIONS = 210_000;
const AAD_PREFIX = 'memoryscape-offline-capture:v1:';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index=0; index<bytes.length; index+=0x8000) binary += String.fromCharCode(...bytes.subarray(index,Math.min(index+0x8000,bytes.length)));
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value),character=>character.charCodeAt(0)); }
function bufferSource(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer; }
function validatePassphrase(passphrase: string): void {
  if (passphrase.length<12) throw new Error('Enter a local encryption passphrase with at least 12 characters');
  if (!globalThis.crypto?.subtle) throw new Error('Encrypted offline storage requires a secure browser context');
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Offline storage is unavailable in this browser'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('Could not open offline storage'));
  });
}

function readAll(db:IDBDatabase):Promise<StoredCapture[]> {
  return new Promise((resolve,reject)=>{
    const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    request.onsuccess=()=>resolve((request.result as StoredCapture[]).sort((a,b)=>a.createdAt-b.createdAt));
    request.onerror=()=>reject(request.error??new Error('Could not read offline captures'));
  });
}

async function deriveKey(passphrase:string,salt:Uint8Array,usages:KeyUsage[]):Promise<CryptoKey> {
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:bufferSource(salt),iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usages);
}

async function encryptCapture(item:QueuedCapture,passphrase:string):Promise<EncryptedCapture> {
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(passphrase,salt,['encrypt']);
  const aad=new TextEncoder().encode(AAD_PREFIX+item.key);
  const plaintext=new TextEncoder().encode(JSON.stringify(item.payload));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:bufferSource(iv),additionalData:aad},key,plaintext);
  return {key:item.key,createdAt:item.createdAt,version:1,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted))};
}

async function decryptCapture(item:EncryptedCapture,passphrase:string):Promise<QueuedCapture> {
  try {
    if(item.version!==1||!item.salt||!item.iv||!item.ciphertext) throw new Error('malformed');
    const salt=base64ToBytes(item.salt),iv=base64ToBytes(item.iv),ciphertext=base64ToBytes(item.ciphertext);
    if(salt.length!==16||iv.length!==12||ciphertext.length<16) throw new Error('malformed');
    const key=await deriveKey(passphrase,salt,['decrypt']);
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bufferSource(iv),additionalData:new TextEncoder().encode(AAD_PREFIX+item.key)},key,bufferSource(ciphertext));
    return {key:item.key,createdAt:item.createdAt,payload:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext)) as CaptureDraft};
  } catch { throw new Error('Could not unlock offline captures. Check the passphrase; encrypted drafts were left untouched.'); }
}

async function encryptLegacyRows(db:IDBDatabase,rows:StoredCapture[],passphrase:string):Promise<StoredCapture[]> {
  const migrated:StoredCapture[]=[];
  for(const row of rows) migrated.push('version' in row ? row : await encryptCapture(row,passphrase));
  if(migrated.some((row,index)=>row!==rows[index])) await new Promise<void>((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');
    const store=transaction.objectStore(STORE);
    for(const row of migrated) store.put(row);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error??new Error('Could not encrypt existing offline captures'));
    transaction.onabort=()=>reject(transaction.error??new Error('Could not encrypt existing offline captures'));
  });
  return migrated;
}

export async function enqueueCapture(payload:CaptureDraft,key=crypto.randomUUID(),passphrase=''):Promise<QueuedCapture> {
  validatePassphrase(passphrase);
  const db=await openDatabase();
  const item:QueuedCapture={key,payload,createdAt:Date.now()};
  try {
    const rows=await readAll(db);
    await encryptLegacyRows(db,rows,passphrase);
    const encrypted=await encryptCapture(item,passphrase);
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).put(encrypted);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error??new Error('Could not store encrypted offline capture'));
      transaction.onabort=()=>reject(transaction.error??new Error('Offline capture was not stored'));
    });
    return item;
  } finally { db.close(); }
}

export async function countQueuedCaptures():Promise<number> {
  const db=await openDatabase();
  try { return (await readAll(db)).length; } finally { db.close(); }
}

export async function listQueuedCaptures(passphrase:string):Promise<QueuedCapture[]> {
  validatePassphrase(passphrase);
  const db=await openDatabase();
  try {
    const rows=await encryptLegacyRows(db,await readAll(db),passphrase);
    return await Promise.all(rows.map(row=>'version' in row?decryptCapture(row,passphrase):Promise.reject(new Error('Offline capture migration failed'))));
  } finally { db.close(); }
}

export async function removeQueuedCapture(key:string):Promise<void> {
  const db=await openDatabase();
  try {
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).delete(key);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error??new Error('Could not remove synced capture'));
    });
  } finally { db.close(); }
}

export async function clearQueuedCaptures():Promise<number> {
  const db=await openDatabase();
  try {
    return await new Promise<number>((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      const store=transaction.objectStore(STORE);
      const countRequest=store.count();
      let count=0;
      countRequest.onsuccess=()=>{count=countRequest.result;store.clear()};
      countRequest.onerror=()=>transaction.abort();
      transaction.oncomplete=()=>resolve(count);
      transaction.onerror=()=>reject(transaction.error??new Error('Could not discard offline captures'));
      transaction.onabort=()=>reject(transaction.error??new Error('Could not discard offline captures'));
    });
  } finally { db.close(); }
}

export async function syncQueuedCaptures(passphrase:string,fetcher:typeof fetch=fetch):Promise<CaptureSyncResult> {
  if(typeof navigator!=='undefined'&&!navigator.onLine) return {synced:0,remaining:await countQueuedCaptures()};
  let items:QueuedCapture[];
  try { items=await listQueuedCaptures(passphrase); }
  catch(error) { return {synced:0,remaining:await countQueuedCaptures(),failed:error instanceof Error?error.message:'Could not unlock offline captures'}; }
  let synced=0;
  for(const item of items) {
    try {
      const response=await fetcher('/api/capture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...item.payload,captureKey:item.key})});
      const body=await response.json() as {error?:string};
      if(!response.ok) return {synced,remaining:await countQueuedCaptures(),failed:body.error??'Could not sync an offline capture'};
      await removeQueuedCapture(item.key);
      synced++;
    } catch { return {synced,remaining:await countQueuedCaptures(),failed:'Connection lost. Encrypted offline captures are still saved on this device.'}; }
  }
  return {synced,remaining:await countQueuedCaptures()};
}
