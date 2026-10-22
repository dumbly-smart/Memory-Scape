const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function assertSecret(secret: string) {
  if (secret.length < 32) throw new Error('MEMORYSCAPE_SESSION_SECRET must contain at least 32 characters');
}

async function sessionKey(secret: string) {
  assertSecret(secret);
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(expiresAt: number, secret: string): Promise<string> {
  if (!Number.isSafeInteger(expiresAt)) throw new RangeError('Session expiry must be an integer Unix timestamp');
  const key = await sessionKey(secret);
  const message = String(expiresAt);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return `${message}.${Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function verifySession(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token) return false;
  const split = token.indexOf('.');
  if (split < 1) return false;
  const expiryText = token.slice(0, split);
  const signatureText = token.slice(split + 1);
  if (!/^\d{1,12}$/.test(expiryText) || !/^[a-f0-9]{64}$/.test(signatureText)) return false;
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= nowSeconds) return false;
  try {
    const signature = Uint8Array.from(signatureText.match(/.{2}/g) ?? [], pair => Number.parseInt(pair, 16));
    return await crypto.subtle.verify('HMAC', await sessionKey(secret), signature, encoder.encode(expiryText));
  } catch {
    return false;
  }
}

export async function verifyPassword(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(candidateHash);
  const b = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export function getAuthConfiguration(password = process.env.MEMORYSCAPE_PASSWORD, secret = process.env.MEMORYSCAPE_SESSION_SECRET) {
  if (!password && !secret) return { mode: 'disabled' as const };
  if (!password || !secret || password.length < 12 || secret.length < 32) return { mode: 'misconfigured' as const };
  return { mode: 'enabled' as const, password, secret };
}

export const AUTH_COOKIE_NAME = 'memoryscape_session';
export const SESSION_DURATION_SECONDS_VALUE = SESSION_DURATION_SECONDS;
