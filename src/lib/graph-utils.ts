/**
 * Converts a JS Date to the Graph API dateTimeTimeZone format.
 * Graph requires { dateTime: string, timeZone: "UTC" }, NOT a plain ISO string.
 * The dateTime string uses the format "2026-04-01T00:00:00.0000000" (7 decimal places, no Z suffix).
 */
export function toGraphDateTime(d: Date): { dateTime: string; timeZone: string } {
  return {
    dateTime: d.toISOString().replace("Z", "0000000"),
    timeZone: "UTC",
  };
}
