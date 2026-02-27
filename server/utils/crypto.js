import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from '../config.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let derivedKey = null;

function getKey() {
  if (derivedKey) return derivedKey;
  if (!config.encryptionKey) return null;
  // Derive a 32-byte key from the user-provided key using scrypt
  derivedKey = scryptSync(config.encryptionKey, 'mailswitch-salt', 32);
  return derivedKey;
}

/**
 * Encrypt a plaintext string. Returns base64-encoded ciphertext.
 * If no encryption key is configured, returns plaintext as-is.
 */
export function encrypt(plaintext) {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: iv + tag + ciphertext, base64-encoded with prefix
  const combined = Buffer.concat([iv, tag, encrypted]);
  return 'enc:' + combined.toString('base64');
}

/**
 * Decrypt a ciphertext string. Returns plaintext.
 * If the input doesn't have the 'enc:' prefix, returns as-is (unencrypted legacy data).
 */
export function decrypt(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;

  const key = getKey();
  if (!key) return ciphertext; // Can't decrypt without key

  const combined = Buffer.from(ciphertext.slice(4), 'base64');
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = combined.subarray(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
