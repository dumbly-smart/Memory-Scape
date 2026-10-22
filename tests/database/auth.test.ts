import { describe, expect, it } from 'vitest';
import { createSessionToken, getAuthConfiguration, verifyPassword, verifySession } from '../../lib/auth';

const secret = 'local-test-session-secret-32-bytes-minimum';

describe('optional local authentication', () => {
  it('issues a signed session token and rejects tampering or expiry', async () => {
    const expiry = 2_000_000_000;
    const token = await createSessionToken(expiry, secret);
    expect(await verifySession(token, secret, expiry - 1)).toBe(true);
    expect(await verifySession(`${expiry}.00`, secret, expiry - 1)).toBe(false);
    expect(await verifySession(token, secret, expiry)).toBe(false);
  });

  it('keeps localhost open by default and fails closed for partial configuration', () => {
    expect(getAuthConfiguration('', '').mode).toBe('disabled');
    expect(getAuthConfiguration('long-local-password', '').mode).toBe('misconfigured');
    expect(getAuthConfiguration('long-local-password', secret).mode).toBe('enabled');
  });

  it('compares the submitted password without accepting a mismatch', async () => {
    expect(await verifyPassword('local-passphrase', 'local-passphrase')).toBe(true);
    expect(await verifyPassword('wrong-passphrase', 'local-passphrase')).toBe(false);
  });
});
