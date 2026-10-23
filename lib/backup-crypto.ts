const iterations = 310_000;
const aad = 'memoryscape-encrypted-backup:v1';
type EnvelopeV1 = { format:'memoryscape-encrypted-backup'; version:1; cipher:'AES-256-GCM'; kdf:'PBKDF2-SHA-256'; iterations:number; salt:string; iv:string; ciphertext:string };
type EnvelopeV2 = { format:'memoryscape-encrypted-backup'; version:2; cipher:'AES-256-GCM'; kdf:'PBKDF2-SHA-256'; iterations:number; salt:string; payloadIv:string; ciphertext:string; passphraseIv:string; passphraseWrappedKey:string; recoveryIv:string; recoveryWrappedKey:string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index=0; index<bytes.length; index+=0x8000) binary += String.fromCharCode(...bytes.subarray(index,Math.min(index+0x8000,bytes.length)));
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value),character=>character.charCodeAt(0)); }
function bytesToBase64Url(value:Uint8Array):string { return bytesToBase64(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function base64UrlToBytes(value:string):Uint8Array {
  if(!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Recovery key is malformed');
  return base64ToBytes(value.replace(/-/g,'+').replace(/_/g,'/')+'=');
}
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
  const envelope:EnvelopeV1={format:'memoryscape-encrypted-backup',version:1,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iterations,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted))};
  return JSON.stringify(envelope,null,2);
}

export async function encryptBackupWithRecovery(plaintext:string,passphrase:string,cryptoApi:Crypto=globalThis.crypto):Promise<{envelope:string;recoveryKey:string}> {
  validatePassphrase(passphrase);
  const salt=cryptoApi.getRandomValues(new Uint8Array(16));
  const payloadIv=cryptoApi.getRandomValues(new Uint8Array(12));
  const passphraseIv=cryptoApi.getRandomValues(new Uint8Array(12));
  const recoveryIv=cryptoApi.getRandomValues(new Uint8Array(12));
  const contentKeyBytes=cryptoApi.getRandomValues(new Uint8Array(32));
  const recoveryKeyBytes=cryptoApi.getRandomValues(new Uint8Array(32));
  const contentKey=await cryptoApi.subtle.importKey('raw',bufferSource(contentKeyBytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
  const passphraseKey=await deriveKey(passphrase,salt,cryptoApi,['encrypt']);
  const recoveryKey=await cryptoApi.subtle.importKey('raw',bufferSource(recoveryKeyBytes),{name:'AES-GCM'},false,['encrypt']);
  const encoder=new TextEncoder();
  const payload=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv:bufferSource(payloadIv),additionalData:encoder.encode('memoryscape-backup:v2:payload')},contentKey,encoder.encode(plaintext));
  const passphraseWrappedKey=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv:bufferSource(passphraseIv),additionalData:encoder.encode('memoryscape-backup:v2:passphrase-key')},passphraseKey,bufferSource(contentKeyBytes));
  const recoveryWrappedKey=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv:bufferSource(recoveryIv),additionalData:encoder.encode('memoryscape-backup:v2:recovery-key')},recoveryKey,bufferSource(contentKeyBytes));
  const envelope:EnvelopeV2={format:'memoryscape-encrypted-backup',version:2,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iterations,salt:bytesToBase64(salt),payloadIv:bytesToBase64(payloadIv),ciphertext:bytesToBase64(new Uint8Array(payload)),passphraseIv:bytesToBase64(passphraseIv),passphraseWrappedKey:bytesToBase64(new Uint8Array(passphraseWrappedKey)),recoveryIv:bytesToBase64(recoveryIv),recoveryWrappedKey:bytesToBase64(new Uint8Array(recoveryWrappedKey))};
  return {envelope:JSON.stringify(envelope,null,2),recoveryKey:bytesToBase64Url(recoveryKeyBytes)};
}

export async function decryptBackup(serialized:string,secret:string,cryptoApi:Crypto=globalThis.crypto,mode:'passphrase'|'recovery'='passphrase'):Promise<string> {
  const value=JSON.parse(serialized) as {format?:string;version?:number;cipher?:string;kdf?:string;iterations?:number;salt?:string;iv?:string;ciphertext?:string};
  if(value.format!=='memoryscape-encrypted-backup'||![1,2].includes(value.version??0)||value.cipher!=='AES-256-GCM'||value.kdf!=='PBKDF2-SHA-256'||value.iterations!==iterations) {
    throw new Error('This is not a supported encrypted MemoryScape backup');
  }
  const decode=new TextDecoder('utf-8',{fatal:true});
  const ciphertext=base64ToBytes(value.ciphertext??'');
  if(ciphertext.length<16) throw new Error('Encrypted backup is malformed');
  if(value.version===1) {
    if(mode==='recovery'||typeof value.salt!=='string'||typeof value.iv!=='string') throw new Error('This backup does not contain a recovery key');
    validatePassphrase(secret);
    const salt=base64ToBytes(value.salt),iv=base64ToBytes(value.iv);
    if(salt.length!==16||iv.length!==12) throw new Error('Encrypted backup is malformed');
    const key=await deriveKey(secret,salt,cryptoApi,['decrypt']);
    const plaintext=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:bufferSource(iv),additionalData:new TextEncoder().encode(aad)},key,bufferSource(ciphertext));
    return decode.decode(plaintext);
  }
  const v2=value as Partial<EnvelopeV2>;
  if(typeof v2.salt!=='string'||typeof v2.payloadIv!=='string'||typeof v2.passphraseIv!=='string'||typeof v2.passphraseWrappedKey!=='string'||typeof v2.recoveryIv!=='string'||typeof v2.recoveryWrappedKey!=='string') throw new Error('Encrypted backup is malformed');
  const salt=base64ToBytes(v2.salt),payloadIv=base64ToBytes(v2.payloadIv),wrapIv=base64ToBytes(mode==='recovery'?v2.recoveryIv:v2.passphraseIv),wrapped=base64ToBytes(mode==='recovery'?v2.recoveryWrappedKey:v2.passphraseWrappedKey);
  if(salt.length!==16||payloadIv.length!==12||wrapIv.length!==12||wrapped.length!==48) throw new Error('Encrypted backup is malformed');
  let wrappingKey:CryptoKey;
  if(mode==='recovery') wrappingKey=await cryptoApi.subtle.importKey('raw',bufferSource(base64UrlToBytes(secret)),{name:'AES-GCM'},false,['decrypt']);
  else { validatePassphrase(secret); wrappingKey=await deriveKey(secret,salt,cryptoApi,['decrypt']); }
  const label=mode==='recovery'?'recovery':'passphrase';
  const rawKey=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:bufferSource(wrapIv),additionalData:new TextEncoder().encode(`memoryscape-backup:v2:${label}-key`)},wrappingKey,bufferSource(wrapped));
  const contentKey=await cryptoApi.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
  const plaintext=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:bufferSource(payloadIv),additionalData:new TextEncoder().encode('memoryscape-backup:v2:payload')},contentKey,bufferSource(ciphertext));
  return decode.decode(plaintext);
}
