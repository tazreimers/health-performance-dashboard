import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const algorithm = "aes-256-gcm";
const version = "v1";

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured.");
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.");
  }

  return key;
}

export function encryptToken(token: string): string {
  if (!token) {
    throw new Error("Cannot encrypt an empty token.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    version,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptToken(encryptedToken: string): string {
  const [storedVersion, encodedIv, encodedTag, encodedCiphertext, ...extra] =
    encryptedToken.split(":");

  if (
    storedVersion !== version ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error("Encrypted token has an unsupported or invalid format.");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Encrypted token has invalid encryption data.");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
