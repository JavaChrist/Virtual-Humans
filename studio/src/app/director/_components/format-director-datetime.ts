/**
 * Deterministic date/time for Director SSR + hydration (Porte 7G-A / React #418).
 * Always UTC + fixed fr-FR options so Node and browser produce the same text.
 * Suffix " UTC" makes the timezone explicit in the UI.
 */

const UTC_FR: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

export function formatDirectorDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return typeof isoOrDate === "string" ? isoOrDate : "";
  }
  return `${d.toLocaleString("fr-FR", UTC_FR)} UTC`;
}
