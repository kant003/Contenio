import { z } from "zod";
import type { Locale } from "./types";

export const CONTENT_PAGE_SIZE = 12;
export const contentStatuses = {
  draft: "Borrador",
  published: "Publicado",
  changed: "Cambios pendientes",
} as const;
export type ContentStatus = keyof typeof contentStatuses;
export type SearchParams = Record<string, string | string[] | undefined>;
export interface ContentFilters {
  q: string;
  type: string;
  status: ContentStatus | "";
  locale: Locale;
  sort: "updated" | "name";
  page: number;
}
export interface EntrySummary {
  id: string;
  content_type_id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updated_at: string;
}
export interface ContentPage {
  items: EntrySummary[];
  total: number;
  page: number;
  stats: { total: number; published: number; drafts: number };
}
export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
export function parseContentFilters(search: SearchParams): ContentFilters {
  const type = firstParam(search.type) ?? "";
  const status = firstParam(search.status) ?? "";
  const page = firstParam(search.page) ?? "1";
  return {
    q: (firstParam(search.q) ?? "").trim().slice(0, 256),
    type: z.uuid().safeParse(type).success ? type : "",
    status: Object.hasOwn(contentStatuses, status)
      ? (status as ContentStatus)
      : "",
    locale: firstParam(search.locale) === "gl" ? "gl" : "es",
    sort: firstParam(search.sort) === "name" ? "name" : "updated",
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}
export function contentHref(space: string, filters: ContentFilters) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.type) search.set("type", filters.type);
  if (filters.status) search.set("status", filters.status);
  if (filters.locale !== "es") search.set("locale", filters.locale);
  if (filters.sort !== "updated") search.set("sort", filters.sort);
  if (filters.page > 1) search.set("page", String(filters.page));
  const query = search.toString();
  return `/spaces/${space}/content${query ? `?${query}` : ""}`;
}
