"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  ImagePlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ResourcePicker } from "./resource-picker";
import { assetItem } from "@/lib/picker-types";
import type { Asset, Json, Locale } from "@/lib/types";
import { safeHref } from "@/lib/utils";
const AssetImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), assetId: { default: null } };
  },
});
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};
function imageUrls(node: Node, assets: Asset[]): Node {
  return {
    ...node,
    ...(node.type === "image"
      ? {
          attrs: {
            ...node.attrs,
            src: assets.find((a) => a.id === node.attrs?.assetId)?.url ?? "",
          },
        }
      : {}),
    ...(node.content
      ? { content: node.content.map((n) => imageUrls(n, assets)) }
      : {}),
  };
}
function persistImages(node: Node): Node {
  const attrs = node.attrs ? { ...node.attrs } : undefined;
  if (node.type === "image" && attrs) {
    delete attrs.src;
    delete attrs.alt;
    delete attrs.title;
  }
  return {
    ...node,
    ...(attrs ? { attrs } : {}),
    ...(node.content ? { content: node.content.map(persistImages) } : {}),
  };
}
export function RichText({
  value,
  onChange,
  assets,
  label,
  space,
  locale,
  onAssets,
}: {
  value: Json | undefined;
  onChange: (v: Json) => void;
  assets: Asset[];
  label: string;
  space: string;
  locale: Locale;
  onAssets: (assets: Asset[]) => void;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false),
    [href, setHref] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      AssetImage,
      Placeholder.configure({
        placeholder: "Empieza a escribir tu contenido…",
      }),
    ],
    content: imageUrls(
      (value ?? { type: "doc", content: [{ type: "paragraph" }] }) as Node,
      assets,
    ),
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(persistImages(editor.getJSON()) as Json),
    editorProps: { attributes: { "aria-label": label, class: "tiptap prose" } },
  });
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const current = JSON.stringify(persistImages(editor.getJSON()));
      const next = JSON.stringify(
        value ?? { type: "doc", content: [{ type: "paragraph" }] },
      );
      if (current !== next)
        editor.commands.setContent(
          imageUrls(
            (value ?? {
              type: "doc",
              content: [{ type: "paragraph" }],
            }) as Node,
            assets,
          ),
          { emitUpdate: false },
        );
    }
  }, [value, assets, editor]);
  if (!editor) return <div className="editor-loading">Cargando el editor…</div>;
  const tools = [
    {
      label: "Encabezado",
      icon: Heading2,
      active: editor.isActive("heading"),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Negrita",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Cursiva",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Lista",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Lista numerada",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Cita",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];
  return (
    <div className="rich-editor">
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label={`Formato de ${label}`}
      >
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={t.active}
            onClick={t.run}
          >
            <t.icon size={16} />
          </button>
        ))}
        <span className="toolbar-separator" />
        <button
          type="button"
          title="Enlace"
          aria-label="Enlace"
          onClick={() => setLinkOpen(!linkOpen)}
        >
          <Link2 size={16} />
        </button>
        <button
          type="button"
          aria-label="Insertar imagen de la biblioteca"
          title="Insertar imagen"
          aria-haspopup="dialog"
          onClick={() => setImageOpen(true)}
        >
          <ImagePlus size={16} />
        </button>
        <span className="toolbar-spacer" />
        <button
          type="button"
          aria-label="Deshacer"
          title="Deshacer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          aria-label="Rehacer"
          title="Rehacer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
      </div>
      {linkOpen && (
        <div className="link-entry">
          <input
            aria-label="URL del enlace"
            placeholder="https://…"
            value={href}
            onChange={(e) => setHref(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={!safeHref(href)}
            onClick={() => {
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: href.trim() })
                .run();
              setLinkOpen(false);
            }}
          >
            Aplicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setLinkOpen(false);
            }}
          >
            Quitar
          </Button>
        </div>
      )}
      {imageOpen && (
        <ResourcePicker
          space={space}
          kind="image"
          locale={locale}
          values={[]}
          items={assets.map(assetItem)}
          onClose={() => setImageOpen(false)}
          onConfirm={(_ids, items) => {
            const asset = items[0]?.asset;
            if (!asset) return;
            onAssets([asset]);
            setImageOpen(false);
            editor
              .chain()
              .setImage({
                src: asset.url ?? "",
                alt: "",
                ...{ assetId: asset.id },
              })
              .run();
            requestAnimationFrame(() => editor.commands.focus());
          }}
        />
      )}
      <EditorContent editor={editor} />
      <div className="editor-wordcount">
        {editor.getText().length} caracteres
      </div>
    </div>
  );
}
