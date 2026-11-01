"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Boxes,
  Check,
  Plus,
  X,
} from "lucide-react";
import { saveModelAction } from "@/app/actions";
import type { ContentType, Field, FieldType } from "@/lib/types";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
const labels: Record<FieldType, string> = {
  short_text: "Texto corto",
  long_text: "Texto largo",
  rich_text: "Texto enriquecido",
  number: "Número",
  boolean: "Sí / No",
  date: "Fecha",
  asset: "Archivo",
  reference: "Referencia",
  references: "Varias referencias",
};
const freshField = (): Field => ({
  key: "",
  name: "",
  type: "short_text",
  localized: true,
  required: false,
  active: true,
  help: "",
});
export function Models({
  space,
  types,
  isAdmin,
}: {
  space: string;
  types: ContentType[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<ContentType | "new" | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LA ESTRUCTURA DE TUS IDEAS</span>
          <h1>
            Modelos<span className="accent">.</span>
          </h1>
          <p>Define una vez cómo se organiza cada tipo de contenido.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={17} />
            Crear modelo
          </Button>
        )}
      </div>
      {editing ? (
        <ModelForm
          key={typeof editing === "string" ? "new" : editing.id}
          space={space}
          model={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : (
        <div className="models-grid">
          {types.map((t) => (
            <button
              className="model-card content-panel"
              key={t.id}
              disabled={!isAdmin}
              onClick={() => setEditing(t)}
            >
              <div className="row between">
                <span className="stat-icon violet">
                  <Boxes size={21} />
                </span>
                {isAdmin && <ArrowUpRight size={18} />}
              </div>
              <h2>{t.name}</h2>
              <code>{t.key}</code>
              <p>{t.description || "Un modelo para organizar tu contenido."}</p>
              <div className="model-card-footer">
                <span>
                  {t.fields.filter((f) => f.active).length} campos activos
                </span>
                <span>
                  <Check size={13} />
                  ES / GL
                </span>
              </div>
            </button>
          ))}
          {!types.length && (
            <div className="empty">
              <Boxes size={30} />
              <h3>Todo contenido necesita una estructura</h3>
              <p>Crea tu primer modelo para empezar.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
function ModelForm({
  space,
  model,
  onClose,
}: {
  space: string;
  model?: ContentType;
  onClose: () => void;
}) {
  const router = useRouter(),
    [name, setName] = useState(model?.name ?? ""),
    [key, setKey] = useState(model?.key ?? ""),
    [description, setDescription] = useState(model?.description ?? ""),
    [fields, setFields] = useState<Field[]>(model?.fields ?? [freshField()]),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const change = (index: number, patch: Partial<Field>) =>
    setFields((old) =>
      old.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  const move = (index: number, delta: number) =>
    setFields((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  return (
    <section className="content-panel model-form">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveModelAction(space, {
              id: model?.id,
              key,
              name,
              description,
              fields,
            });
            if (r.error) setError(r.error);
            else {
              router.refresh();
              onClose();
            }
          });
        }}
      >
        <div className="panel-title">
          <h2>{model ? "Editar modelo" : "Nuevo modelo"}</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Cerrar modelo"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="model-basics">
          <label>
            Nombre
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="Por ejemplo: Noticia"
            />
          </label>
          <label>
            Identificador técnico
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              pattern="[a-z][a-z0-9_]{0,63}"
              placeholder="noticia"
            />
          </label>
          <label className="span-2">
            Descripción
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Para qué se usará este contenido?"
            />
          </label>
        </div>
        <div className="fields-heading">
          <h3>Campos del modelo</h3>
          <p>
            Los identificadores y tipos de campos utilizados se conservan.
            Puedes desactivar campos sin perder datos.
          </p>
        </div>
        <div className="schema-fields">
          {fields.map((f, i) => (
            <div
              className={`schema-field ${f.active ? "" : "inactive"}`}
              key={i}
            >
              <div className="schema-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="schema-inputs">
                <label>
                  Nombre
                  <Input
                    value={f.name}
                    onChange={(e) => change(i, { name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Identificador
                  <Input
                    value={f.key}
                    onChange={(e) => change(i, { key: e.target.value })}
                    required
                    pattern="[a-z][a-z0-9_]{0,63}"
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={f.type}
                    onChange={(e) =>
                      change(i, { type: e.target.value as FieldType })
                    }
                  >
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Texto de ayuda
                  <Input
                    value={f.help}
                    onChange={(e) => change(i, { help: e.target.value })}
                  />
                </label>
                <div className="row schema-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={f.localized}
                      onChange={(e) =>
                        change(i, { localized: e.target.checked })
                      }
                    />
                    Traducible
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) =>
                        change(i, { required: e.target.checked })
                      }
                    />
                    Obligatorio
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={f.active}
                      onChange={(e) => change(i, { active: e.target.checked })}
                    />
                    Activo
                  </label>
                </div>
              </div>
              <div className="schema-order">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!i}
                  onClick={() => move(i, -1)}
                  aria-label={`Subir campo ${i + 1}`}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Bajar campo ${i + 1}`}
                >
                  <ArrowDown size={15} />
                </Button>
                {!model && fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar campo ${i + 1}`}
                    onClick={() =>
                      setFields((old) => old.filter((_, j) => i !== j))
                    }
                  >
                    <X size={15} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="model-form-footer">
          <Button
            type="button"
            variant="outline"
            disabled={fields.length >= 64}
            onClick={() => setFields((old) => [...old, freshField()])}
          >
            <Plus size={16} />
            Añadir campo
          </Button>
          <Button disabled={pending}>
            {pending ? "Guardando…" : "Guardar modelo"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
