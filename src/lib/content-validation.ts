import type { FieldType, Json } from "./types";
export function hasContent(value: Json | undefined, type: FieldType): boolean {
  if (value == null) return false;
  if (type === "rich_text") {
    if (typeof value !== "object" || Array.isArray(value)) return false;
    const walk = (node: Json): boolean => {
      if (!node || typeof node !== "object" || Array.isArray(node))
        return false;
      return (
        (typeof node.text === "string" && node.text.trim().length > 0) ||
        (node.type === "image" &&
          typeof node.attrs === "object" &&
          node.attrs !== null &&
          !Array.isArray(node.attrs) &&
          typeof node.attrs.assetId === "string") ||
        (Array.isArray(node.content) && node.content.some(walk))
      );
    };
    return walk(value);
  }
  return typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : true;
}
