import { describe, it, expect } from 'vitest';
import {
  generateKey,
  exportKeyToBase64,
  importKeyFromBase64,
  encrypt,
  decrypt,
} from './crypto';

describe('crypto utility (AES-256-GCM E2EE)', () => {
  it('generates a key and performs export/import roundtrip', async () => {
    const key = await generateKey();
    expect(key).toBeDefined();

    const exported = await exportKeyToBase64(key);
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(20);

    const importedKey = await importKeyFromBase64(exported);
    expect(importedKey).toBeDefined();
    expect(importedKey.algorithm.name).toBe('AES-GCM');
  });

  it('encrypts and decrypts normal text successfully', async () => {
    const key = await generateKey();
    const secret = 'https://confidential-bank-portal.internal/admin?token=xyz123';

    const ciphertext = await encrypt(key, secret);
    expect(ciphertext.startsWith('enc:v1:')).toBe(true);

    const decrypted = await decrypt(key, ciphertext);
    expect(decrypted).toBe(secret);
  });

  it('encrypts and decrypts multiline code snippet with unicode', async () => {
    const key = await generateKey();
    const note = `// Confidential Config
const API_KEY = "sk-live-9823489234"; 🔑
function connect() {
  return "connected to 🚀 internal mesh";
}`;

    const ciphertext = await encrypt(key, note);
    const decrypted = await decrypt(key, ciphertext);
    expect(decrypted).toBe(note);
  });

  it('fails decryption with wrong key', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const text = 'secret message';

    const ciphertext = await encrypt(key1, text);
    await expect(decrypt(key2, ciphertext)).rejects.toThrow();
  });

  it('fails decryption when ciphertext is tampered with', async () => {
    const key = await generateKey();
    const ciphertext = await encrypt(key, 'integrity test');

    // Tamper with a character in the ciphertext
    const tampered = ciphertext.slice(0, -3) + 'abc';
    await expect(decrypt(key, tampered)).rejects.toThrow();
  });
});
