const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "authorization",
  "secret",
  "passkey",
  "apikey",
  "consumerkey",
  "consumersecret",
  "accesstoken",
  "authsecret",
]);

const PHONE_KEYS = new Set(["phone", "phonenumber", "msisdn", "partya"]);

/**
 * Returns a log-safe copy of a value with secrets removed and phone numbers shortened.
 *
 * @param value - Any structured value about to be written to a log line.
 * @returns The same shape with sensitive fields redacted.
 */
export function sanitizeForLog<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLog(entry)) as T;
  }

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    const nested = source[key];
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");

    if (SENSITIVE_KEYS.has(normalizedKey)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (PHONE_KEYS.has(normalizedKey) && typeof nested === "string") {
      sanitized[key] = maskPhone(nested);
      continue;
    }

    if (PHONE_KEYS.has(normalizedKey) && typeof nested === "number") {
      sanitized[key] = maskPhone(String(nested));
      continue;
    }

    sanitized[key] = nested && typeof nested === "object" ? sanitizeForLog(nested) : nested;
  }

  return sanitized as T;
}

function maskPhone(phoneNumber: string): string {
  if (phoneNumber.length <= 4) {
    return "****";
  }

  return `${"*".repeat(phoneNumber.length - 4)}${phoneNumber.slice(-4)}`;
}

function writeLog(level: "info" | "warn" | "error", message: string, metadata?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(metadata ? { metadata: sanitizeForLog(metadata) } : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    writeLog("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>): void {
    writeLog("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>): void {
    writeLog("error", message, metadata);
  },
};
