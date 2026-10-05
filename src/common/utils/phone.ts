const KENYAN_MOBILE_PATTERN = /^254(?:7|1)\d{8}$/;

/**
 * Converts a typed Kenyan mobile number into the 254 form Daraja expects.
 *
 * @param input - A number such as 0712345678, +254712345678, or 254712345678.
 * @returns The 12-digit 254 number, or null when the value is not a Safaricom-style mobile line.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;

  if (digits.startsWith("0") && digits.length === 10) {
    digits = `254${digits.slice(1)}`;
  }

  if (!KENYAN_MOBILE_PATTERN.test(digits)) {
    return null;
  }

  return digits;
}

/**
 * Formats a 254 number the way it appears on a handset.
 *
 * @param normalizedPhone - A number already returned by normalizeKenyanPhone.
 * @returns A local display string such as 0712 345 678.
 */
export function formatKenyanPhoneForDisplay(normalizedPhone: string): string {
  const localNumber = `0${normalizedPhone.slice(3)}`;
  return `${localNumber.slice(0, 4)} ${localNumber.slice(4, 7)} ${localNumber.slice(7)}`;
}
