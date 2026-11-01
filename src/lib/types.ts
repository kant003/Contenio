export const locales = ["es", "gl"] as const;
export type Locale = (typeof locales)[number];
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Values = Record<string, Json>;
export type FieldType =
  | "short_text"
  | "long_text"
  | "rich_text"
  | "number"
  | "boolean"
  | "date"
  | "asset"
  | "reference"
  | "references";
export interface Field {
  key: string;
  name: string;
  type: FieldType;
  localized: boolean;
  required: boolean;
  active: boolean;
  help: string;
}
export interface ContentType {
  id: string;
  space_id: string;
  key: string;
  name: string;
  description: string;
  fields: Field[];
}
export interface Space {
  id: string;
  name: string;
  slug: string;
}
export interface Entry {
  id: string;
  space_id: string;
  content_type_id: string;
  shared: Values;
  translations: Record<Locale, Values>;
  version: number;
  updated_at: string;
}
export interface Publication {
  id: string;
  entry_id: string;
  locale: Locale;
  fields: Values;
  type_key: string;
  slug: string | null;
  published_at: string;
}
export interface Asset {
  id: string;
  space_id: string;
  path: string;
  name: string;
  mime: string;
  size: number;
  alt: Record<Locale, string>;
  description: Record<Locale, string>;
  url?: string;
}
export interface ReadKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  revoked_at: string | null;
}
export type Result<T = undefined> =
  { data: T; error?: never } | { error: string; data?: never };
