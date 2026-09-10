/**
 * Zero-Knowledge Client-Side E2EE Web Crypto Utility
 * Uses AES-256-GCM with a 12-byte random IV and URL-safe base64 key export.
 */

// Helper to convert Uint8Array to URL-safe base64 string
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper to convert URL-safe base64 string to Uint8Array
function base64UrlToBytes(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically random AES-256-GCM key.
 */
export async function generateKey(): Promise<CryptoKey> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API is not supported in this environment');
  }
  return cryptoObj.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey as a URL-safe Base64 string for URL hash fragments (#k=...).
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const cryptoObj = globalThis.crypto;
  const rawKey = await cryptoObj.subtle.exportKey('raw', key);
  return bytesToBase64Url(new Uint8Array(rawKey));
}

/**
 * Imports a CryptoKey from a URL-safe Base64 string.
 */
export async function importKeyFromBase64(b64Key: string): Promise<CryptoKey> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API is not supported in this environment');
  }
  const keyBytes = base64UrlToBytes(b64Key);
  return cryptoObj.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    {
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Prepend 12-byte IV to ciphertext and prefixes with "enc:v1:".
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const cryptoObj = globalThis.crypto;
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plaintext);

  const ciphertext = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return 'enc:v1:' + bytesToBase64Url(combined);
}

/**
 * Decrypts a ciphertext string (prefixed with "enc:v1:" or "enc:") using AES-256-GCM.
 */
export async function decrypt(key: CryptoKey, payload: string): Promise<string> {
  const cryptoObj = globalThis.crypto;
  let cleanPayload = payload.trim();
  if (cleanPayload.startsWith('enc:v1:')) {
    cleanPayload = cleanPayload.slice('enc:v1:'.length);
  } else if (cleanPayload.startsWith('enc:')) {
    cleanPayload = cleanPayload.slice('enc:'.length);
  } else {
    throw new Error('Invalid encrypted payload format');
  }

  const combined = base64UrlToBytes(cleanPayload);
  if (combined.byteLength <= 12) {
    throw new Error('Encrypted payload too short');
  }

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  return new TextDecoder().decode(decryptedBuffer);
}
