const iterations = 310_000;
const aad = 'memoryscape-encrypted-backup:v1';
type Envelope = { format:'memoryscape-encrypted-backup'; version:1; cipher:'AES-256-GCM'; kdf:'PBKDF2-SHA-256'; iterations:number; salt:string; iv:string; ciphertext:string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index=0; index<bytes.length; index+=0x8000) binary += String.fromCharCode(...bytes.subarray(index,Math.min(index+0x8000,bytes.length)));
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value),character=>character.charCodeAt(0)); }
function bufferSource(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer; }
function validatePassphrase(passphrase: string) {
  if (passphrase.length < 12) throw new Error('Use a passphrase with at least 12 characters');
}
async function deriveKey(passphrase:string,salt:Uint8Array,cryptoApi:Crypto,usages:KeyUsage[]):Promise<CryptoKey> {
  const material=await cryptoApi.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return cryptoApi.subtle.deriveKey({name:'PBKDF2',salt:bufferSource(salt),iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usages);
}

export async function encryptBackup(plaintext:string,passphrase:string,cryptoApi:Crypto=globalThis.crypto):Promise<string> {
  validatePassphrase(passphrase);
  const salt=cryptoApi.getRandomValues(new Uint8Array(16));
  const iv=cryptoApi.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(passphrase,salt,cryptoApi,['encrypt']);
  const encrypted=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv:bufferSource(iv),additionalData:new TextEncoder().encode(aad)},key,new TextEncoder().encode(plaintext));
  const envelope:Envelope={format:'memoryscape-encrypted-backup',version:1,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iterations,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted))};
  return JSON.stringify(envelope,null,2);
}

export async function decryptBackup(serialized:string,passphrase:string,cryptoApi:Crypto=globalThis.crypto):Promise<string> {
  validatePassphrase(passphrase);
  const value=JSON.parse(serialized) as Partial<Envelope>;
  if(value.format!=='memoryscape-encrypted-backup'||value.version!==1||value.cipher!=='AES-256-GCM'||value.kdf!=='PBKDF2-SHA-256'||value.iterations!==iterations||typeof value.salt!=='string'||typeof value.iv!=='string'||typeof value.ciphertext!=='string') {
    throw new Error('This is not a supported encrypted MemoryScape backup');
  }
  const salt=base64ToBytes(value.salt),iv=base64ToBytes(value.iv),ciphertext=base64ToBytes(value.ciphertext);
  if(salt.length!==16||iv.length!==12||ciphertext.length<16) throw new Error('Encrypted backup is malformed');
  const key=await deriveKey(passphrase,salt,cryptoApi,['decrypt']);
  const plaintext=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:bufferSource(iv),additionalData:new TextEncoder().encode(aad)},key,bufferSource(ciphertext));
  return new TextDecoder('utf-8',{fatal:true}).decode(plaintext);
}
