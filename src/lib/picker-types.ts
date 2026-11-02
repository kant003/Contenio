import { z } from "zod";
import type { Asset, Locale } from "./types";

export const pickerQuerySchema = z.object({
  kind: z.enum(["entry", "asset", "image"]),
  locale: z.enum(["es", "gl"]).default("es"),
  q: z.string().trim().max(256).default(""),
  page: z.coerce.number().int().min(1).max(999999).default(1),
  exclude: z.uuid().optional(),
});
export type PickerQuery = z.infer<typeof pickerQuerySchema>;
export type ResourceKind = PickerQuery["kind"];
export interface PickerItem {
  id: string;
  label: string;
  detail: string;
  titles?: Record<Locale, string>;
  asset?: Asset;
}
export interface PickerPage {
  items: PickerItem[];
  total: number;
  page: number;
  pageSize: number;
}
export function itemLabel(item: PickerItem, locale: Locale) {
  return item.titles?.[locale] ?? item.label;
}
export function assetItem(asset: Asset): PickerItem {
  return { id: asset.id, label: asset.name, detail: asset.mime, asset };
}
export function mergeItems<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item]),
    ).values(),
  ];
}
