import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats a UTC/ISO datetime string into local date and time parts.
// Returns normalized strings or empty strings if invalid.
export function formatUtcToLocal(
  isoDatetime: string,
  options: { timeZone?: string; dateStyle?: "short" | "medium" | "long" | "full" } = {}
): { date: string; time: string } {
  if (!isoDatetime) return { date: "", time: "" };
  const dateObj = new Date(isoDatetime);
  if (isNaN(dateObj.getTime())) return { date: "", time: "" };
  const timeZone = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return { date: dateFormatter.format(dateObj), time: timeFormatter.format(dateObj) };
}

// Joins first and last name safely (trims, handles missing parts).
export function joinFullName(first?: string | null, last?: string | null): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

// Standard email regex used across forms (practical RFC5322 subset).
const EMAIL_REGEX =
  /^(?:[a-zA-Z0-9_'^&-]+(?:\.[a-zA-Z0-9_'^&-]+)*|"(?:[^"]|\\")+")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:IPv6:)?[a-fA-F0-9:.]+\])$/;

export function isValidEmail(email: string): boolean {
  const trimmed = (email ?? "").trim();
  if (!trimmed || trimmed.length > 255) return false;
  return EMAIL_REGEX.test(trimmed);
}
