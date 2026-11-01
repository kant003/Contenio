import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContentType, Entry, Locale, Publication, Values } from "./types";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function titleOf(
  entry: Entry,
  type?: ContentType,
  locale: Locale = "es",
) {
  const key =
    type?.fields.find((f) => f.key === "title")?.key ??
    type?.fields.find((f) => f.type === "short_text")?.key ??
    "title";
  const value = entry.translations[locale]?.[key] ?? entry.shared[key];
  return typeof value === "string" && value ? value : "Sin título";
}
export function activeValues(
  entry: Entry,
  type: ContentType,
  locale: Locale,
): Values {
  const values = { ...entry.shared, ...entry.translations[locale] };
  return Object.fromEntries(
    type.fields
      .filter((f) => f.active && f.key in values)
      .map((f) => [f.key, values[f.key]]),
  );
}
export function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => k in y && sameValues(x[k], y[k]))
  );
}
export function statusOf(
  entry: Entry,
  type: ContentType,
  pubs: Publication[],
  locale: Locale,
) {
  const pub = pubs.find((p) => p.entry_id === entry.id && p.locale === locale);
  return !pub
    ? "Borrador"
    : sameValues(activeValues(entry, type, locale), pub.fields)
      ? "Publicado"
      : "Cambios pendientes";
}
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? href
      : undefined;
  } catch {
    return undefined;
  }
}
