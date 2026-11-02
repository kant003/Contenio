import { firstParam, type SearchParams } from "./content-filters";
import type { Asset, Locale } from "./types";

export const MEDIA_PAGE_SIZE = 12;
export interface MediaFilters {
  q: string;
  kind: "" | "image" | "pdf";
  locale: Locale;
  sort: "recent" | "name" | "size";
  page: number;
}
export interface MediaPage {
  items: Asset[];
  total: number;
  page: number;
  stats: { total: number; images: number; pdfs: number; bytes: number };
}
export function parseMediaFilters(search: SearchParams): MediaFilters {
  const kind = firstParam(search.kind);
  const sort = firstParam(search.sort);
  const page = firstParam(search.page) ?? "1";
  return {
    q: (firstParam(search.q) ?? "").trim().slice(0, 256),
    kind: kind === "image" || kind === "pdf" ? kind : "",
    locale: firstParam(search.locale) === "gl" ? "gl" : "es",
    sort: sort === "name" || sort === "size" ? sort : "recent",
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}
export function mediaHref(space: string, filters: MediaFilters) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.kind) search.set("kind", filters.kind);
  if (filters.locale !== "es") search.set("locale", filters.locale);
  if (filters.sort !== "recent") search.set("sort", filters.sort);
  if (filters.page > 1) search.set("page", String(filters.page));
  const query = search.toString();
  return `/spaces/${space}/media${query ? `?${query}` : ""}`;
}
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
