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
import type { Asset, Json } from "@/lib/types";
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
}: {
  value: Json | undefined;
  onChange: (v: Json) => void;
  assets: Asset[];
  label: string;
}) {
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
        <label className="image-insert" title="Insertar imagen">
          <ImagePlus size={16} />
          <select
            aria-label="Insertar imagen de la biblioteca"
            value=""
            onChange={(e) => {
              const a = assets.find((a) => a.id === e.target.value);
              if (a)
                editor
                  .chain()
                  .focus()
                  .setImage({ src: a.url ?? "", alt: "", ...{ assetId: a.id } })
                  .run();
            }}
          >
            <option value="">Insertar imagen</option>
            {assets
              .filter((a) => a.mime.startsWith("image/"))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
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
      <EditorContent editor={editor} />
      <div className="editor-wordcount">
        {editor.getText().length} caracteres
      </div>
    </div>
  );
}
