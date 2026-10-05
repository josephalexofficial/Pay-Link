const NAIROBI_TIME_ZONE = "Africa/Nairobi";

/**
 * Builds the Daraja timestamp in Africa/Nairobi local time.
 *
 * @param now - The instant to format.
 * @returns A 14-digit string YYYYMMDDHHmmss.
 */
export function formatNairobiTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const match = parts.find((part) => part.type === type);
    return match?.value ?? "";
  };

  const hour = read("hour") === "24" ? "00" : read("hour");
  return `${read("year")}${read("month")}${read("day")}${hour}${read("minute")}${read("second")}`;
}

/**
 * Returns midnight at the start of the current Nairobi calendar day.
 *
 * @param now - The instant used to decide which calendar day is current.
 * @returns A Date at 00:00 Africa/Nairobi.
 */
export function getNairobiDayStart(now: Date): Date {
  const { year, month, day } = readNairobiDateParts(now);
  return new Date(`${year}-${month}-${day}T00:00:00+03:00`);
}

/**
 * Returns midnight at the start of the current Nairobi calendar month.
 *
 * @param now - The instant used to decide which calendar month is current.
 * @returns A Date at 00:00 on the first of the month, Africa/Nairobi.
 */
export function getNairobiMonthStart(now: Date): Date {
  const { year, month } = readNairobiDateParts(now);
  return new Date(`${year}-${month}-01T00:00:00+03:00`);
}

/**
 * Formats an instant for the admin list in Nairobi local time.
 *
 * @param instant - The stored timestamp.
 * @returns A short date and time string.
 */
export function formatNairobiDateTime(instant: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: NAIROBI_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

function readNairobiDateParts(now: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const match = parts.find((part) => part.type === type);
    return match?.value ?? "";
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}
