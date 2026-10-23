import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup } from '../../lib/backup-crypto';

describe('encrypted backup envelope', () => {
  it('encrypts archive text and decrypts it only with the correct passphrase', async () => {
    const archive = JSON.stringify({ format:'memoryscape-backup', memories:[{content:'private note'}] });
    const encrypted = await encryptBackup(archive,'correct horse battery staple',webcrypto as unknown as Crypto);
    expect(encrypted).not.toContain('private note');
    const second=JSON.parse(await encryptBackup(archive,'correct horse battery staple',webcrypto as unknown as Crypto));
    const first=JSON.parse(encrypted);
    expect(second.salt).not.toBe(first.salt);
    expect(second.iv).not.toBe(first.iv);
    expect(encrypted).toContain('memoryscape-encrypted-backup');
    await expect(decryptBackup(encrypted,'correct horse battery staple',webcrypto as unknown as Crypto)).resolves.toBe(archive);
    await expect(decryptBackup(encrypted,'incorrect passphrase',webcrypto as unknown as Crypto)).rejects.toThrow();
  });

  it('rejects a short passphrase and tampered ciphertext', async () => {
    await expect(encryptBackup('archive','short',webcrypto as unknown as Crypto)).rejects.toThrow('12 characters');
    const encrypted = await encryptBackup('archive data','a sufficiently long test passphrase',webcrypto as unknown as Crypto);
    await expect(decryptBackup('{"format":"wrong"}','a sufficiently long test passphrase',webcrypto as unknown as Crypto)).rejects.toThrow('not a supported');
    const envelope = JSON.parse(encrypted) as { ciphertext:string };
    envelope.ciphertext = `${envelope.ciphertext.slice(0,-4)}AAAA`;
    await expect(decryptBackup(JSON.stringify(envelope),'a sufficiently long test passphrase',webcrypto as unknown as Crypto)).rejects.toThrow();
  });
});
