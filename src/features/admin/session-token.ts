export const SESSION_COOKIE_NAME = "whimsey_admin_session";
export const SESSION_TTL_IN_MS = 12 * 60 * 60 * 1000;
export const SESSION_TTL_IN_SECONDS = SESSION_TTL_IN_MS / 1000;

type SessionPayload = {
  userId: string;
  email: string;
  expiresAtMs: number;
};

/**
 * Signs an admin session token.
 *
 * @param user - Admin id and email stored in the cookie payload.
 * @param now - Instant the session starts.
 * @param secret - AUTH_SECRET used as the HMAC key.
 * @returns A `payload.signature` token.
 */
export async function createSessionToken(
  user: { id: string; email: string },
  now: Date,
  secret: string,
): Promise<string> {
  const body = encodeJson({
    userId: user.id,
    email: user.email,
    expiresAtMs: now.getTime() + SESSION_TTL_IN_MS,
  });
  const signature = await signValue(body, secret);
  return `${body}.${signature}`;
}

/**
 * Verifies a session token and returns the admin identity when it is still valid.
 *
 * @param token - Cookie value.
 * @param secret - AUTH_SECRET used as the HMAC key.
 * @returns The admin id and email, or null when the token is missing, altered, or expired.
 */
export async function readSessionToken(
  token: string,
  secret: string,
): Promise<{ userId: string; email: string } | null> {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const body = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!body || !signature) {
    return null;
  }

  const expected = await signValue(body, secret);
  if (!fixedTimeEqual(signature, expected)) {
    return null;
  }

  const payload = decodeJson(body);
  if (!payload || payload.expiresAtMs <= Date.now()) {
    return null;
  }

  if (!payload.userId || !payload.email) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function encodeJson(payload: SessionPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodeJson(value: string): SessionPayload | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(value));
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const userId = "userId" in parsed && typeof parsed.userId === "string" ? parsed.userId : "";
    const email = "email" in parsed && typeof parsed.email === "string" ? parsed.email : "";
    const expiresAtMs = "expiresAtMs" in parsed && typeof parsed.expiresAtMs === "number" ? parsed.expiresAtMs : 0;

    if (!userId || !email || !Number.isFinite(expiresAtMs)) {
      return null;
    }

    return { userId, email, expiresAtMs };
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function fixedTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length === rightBytes.length ? 0 : 1;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
