const ENCRYPTION_PREFIX = "enc:";
const SALT = new TextEncoder().encode("PayByCard-Gateway-Encryption-v1");
const IV_LENGTH = 12;

async function deriveKey(encryptionKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  if (!plaintext || !encryptionKey || isEncrypted(plaintext)) return plaintext;
  const key = await deriveKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return ENCRYPTION_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decrypt(value: string, encryptionKey: string): Promise<string> {
  if (!value || !isEncrypted(value)) return value;
  const key = await deriveKey(encryptionKey);
  const combined = Uint8Array.from(atob(value.slice(ENCRYPTION_PREFIX.length)), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
