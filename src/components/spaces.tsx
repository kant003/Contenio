"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Layers3, LogOut, Plus, X } from "lucide-react";
import { createSpaceAction, logoutAction } from "@/app/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog } from "./ui/dialog";
import { slugify } from "@/lib/utils";
import type { Space } from "@/lib/types";
export function Spaces({
  spaces,
  isAdmin,
  email,
}: {
  spaces: Space[];
  isAdmin: boolean;
  email: string;
}) {
  const router = useRouter(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  return (
    <main className="spaces-page">
      <header>
        <Link href="/spaces" className="brand">
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          contenio.
        </Link>
        <div className="row">
          <span className="muted">{email}</span>
          <Link href="/account" className="account-link">
            Mi cuenta
          </Link>
          <form action={logoutAction}>
            <Button variant="ghost" size="icon" title="Cerrar sesión">
              <LogOut size={17} />
            </Button>
          </form>
        </div>
      </header>
      <section>
        <span className="eyebrow">TODO EN SU LUGAR</span>
        <div className="page-heading">
          <div>
            <h1>Tus espacios.</h1>
            <p>Un lugar para el contenido de cada proyecto.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={17} />
              Nuevo espacio
            </Button>
          )}
        </div>
        <div className="spaces-grid">
          {spaces.map((s, i) => (
            <Link
              className="space-card"
              href={`/spaces/${s.id}/content`}
              key={s.id}
            >
              <div className={`space-tile tile-${i % 3}`}>
                {s.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="tag">ESPACIO DE TRABAJO</span>
              <h2>{s.name}</h2>
              <p>Contenido, modelos y archivos conectados.</p>
              <div>
                Abrir espacio <ArrowRight size={17} />
              </div>
            </Link>
          ))}
          {spaces.length === 0 && (
            <div className="empty">
              <Layers3 size={36} />
              <h2>Aún no tienes espacios</h2>
              <p>
                {isAdmin
                  ? "Crea el primero para empezar."
                  : "Tu administrador te asignará un espacio de trabajo."}
              </p>
            </div>
          )}
        </div>
      </section>
      {open && (
        <Dialog titleId="space-title" onClose={() => setOpen(false)}>
          <div className="row between">
            <h2 id="space-title">Un nuevo espacio</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </Button>
          </div>
          <p className="muted">
            Se creará con el modelo Página y los idiomas español y gallego.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createSpaceAction(name, slug);
                if (r.error) setError(r.error);
                else {
                  setOpen(false);
                  router.push(`/spaces/${r.data}/content`);
                }
              });
            }}
          >
            <label>
              Nombre
              <Input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
                required
                maxLength={100}
              />
            </label>
            <label>
              Identificador
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-z0-9][a-z0-9-]{1,79}"
                required
              />
            </label>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={pending}>
              {pending ? "Creando…" : "Crear espacio"}
            </Button>
          </form>
        </Dialog>
      )}
    </main>
  );
}
