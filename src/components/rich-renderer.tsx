import NextImage from "next/image";
import type { ReactNode } from "react";
import type { Asset, Json, Locale } from "@/lib/types";
import { safeHref } from "@/lib/utils";
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};
function render(
  node: Node,
  key: number,
  assets: Asset[],
  locale: Locale,
): ReactNode {
  const children = node.content?.map((n, i) => render(n, i, assets, locale));
  switch (node.type) {
    case "doc":
      return (
        <div key={key} className="prose">
          {children}
        </div>
      );
    case "text": {
      let text: ReactNode = node.text ?? "";
      for (const m of node.marks ?? []) {
        if (m.type === "bold") text = <strong>{text}</strong>;
        if (m.type === "italic") text = <em>{text}</em>;
        if (m.type === "underline") text = <u>{text}</u>;
        if (m.type === "strike") text = <s>{text}</s>;
        if (m.type === "code") text = <code>{text}</code>;
        if (m.type === "link") {
          const href = safeHref(m.attrs?.href);
          if (href)
            text = (
              <a href={href} rel="noopener noreferrer">
                {text}
              </a>
            );
        }
      }
      return <span key={key}>{text}</span>;
    }
    case "heading":
      return node.attrs?.level === 1 ? (
        <h1 key={key}>{children}</h1>
      ) : node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "paragraph":
      return <p key={key}>{children?.length ? children : <br />}</p>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image": {
      const asset = assets.find((a) => a.id === node.attrs?.assetId);
      return asset?.url ? (
        <figure key={key}>
          <NextImage
            unoptimized
            width={1000}
            height={600}
            src={asset.url}
            alt={asset.alt[locale] ?? ""}
          />
        </figure>
      ) : (
        <span key={key} className="muted">
          [Imagen no disponible]
        </span>
      );
    }
    default:
      return <span key={key}>{children}</span>;
  }
}
export function RichRenderer({
  value,
  assets = [],
  locale = "es",
}: {
  value: Json | undefined;
  assets?: Asset[];
  locale?: Locale;
}) {
  return value && typeof value === "object"
    ? render(value as Node, 0, assets, locale)
    : null;
}
