"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { keyAction, memberAction, revokeKeyAction } from "@/app/actions";
import type { ReadKey, Space } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { dateLabel } from "@/lib/utils";
export function Settings({
  space,
  keys,
  members,
}: {
  space: Space;
  keys: ReadKey[];
  members: { user_id: string; email: string }[];
}) {
  const router = useRouter(),
    [email, setEmail] = useState(""),
    [keyName, setKeyName] = useState(""),
    [secret, setSecret] = useState(""),
    [copied, setCopied] = useState(false),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA COSA BAJO CONTROL</span>
          <h1>
            Ajustes<span className="accent">.</span>
          </h1>
          <p>
            Gestiona quién entra y cómo se conecta el contenido de este espacio.
          </p>
        </div>
        <span className="admin-pill">
          <ShieldCheck size={15} />
          Administrador
        </span>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="settings-grid">
        <section className="content-panel settings-panel">
          <div className="panel-title">
            <div>
              <h2>Acceso al espacio</h2>
              <p>Los editores pueden crear, traducir y publicar.</p>
            </div>
            <UserPlus size={20} />
          </div>
          <div className="settings-body">
            <p className="muted">
              Crea primero la cuenta en el gestor de cuentas y después añádela
              aquí por email.
            </p>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await memberAction(space.id, email);
                  setMessage(r.error ?? "Editor añadido al espacio.");
                  if (!r.error) {
                    setEmail("");
                    router.refresh();
                  }
                });
              }}
            >
              <Input
                aria-label="Email del editor"
                type="email"
                required
                placeholder="editor@cliente.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button disabled={pending}>
                <Plus size={16} />
                Añadir
              </Button>
            </form>
            <div className="member-list">
              {members.map((m) => (
                <div className="row between" key={m.user_id}>
                  <div className="row">
                    <span className="account-avatar">
                      {m.email.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{m.email}</strong>
                      <small>Editor</small>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Retirar acceso a ${m.email}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await memberAction(space.id, m.email, true);
                        setMessage(r.error ?? "Acceso retirado.");
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              {!members.length && (
                <p className="muted">Todavía no hay editores asignados.</p>
              )}
            </div>
          </div>
        </section>
        <section className="content-panel settings-panel">
          <div className="panel-title">
            <div>
              <h2>Claves de lectura</h2>
              <p>Conecta una web con el contenido publicado.</p>
            </div>
            <KeyRound size={20} />
          </div>
          <div className="settings-body">
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                setSecret("");
                start(async () => {
                  const r = await keyAction(space.id, keyName);
                  if (r.error) setMessage(r.error);
                  else {
                    setSecret(r.data!);
                    setCopied(false);
                    setKeyName("");
                    router.refresh();
                  }
                });
              }}
            >
              <Input
                aria-label="Nombre de la clave"
                placeholder="Por ejemplo: Web del cliente"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
              <Button disabled={pending}>
                <Plus size={16} />
                Crear
              </Button>
            </form>
            {secret && (
              <div className="secret-box">
                <strong>Copia tu clave ahora.</strong>
                <p>
                  Solo se muestra una vez. Utilízala desde el servidor de tu
                  web.
                </p>
                <code data-testid="new-api-key">{secret}</code>
                <div className="row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(secret);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                    {copied ? "Copiada" : "Copiar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSecret("")}
                  >
                    Ya la he guardado
                  </Button>
                </div>
              </div>
            )}
            <div className="key-list">
              {keys.map((k) => (
                <div className="key-row" key={k.id}>
                  <KeyRound size={17} />
                  <div>
                    <strong>{k.name}</strong>
                    <small>
                      <code>{k.prefix}…</code> · {dateLabel(k.created_at)}
                    </small>
                  </div>
                  {k.revoked_at ? (
                    <span className="tag">REVOCADA</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "¿Revocar esta clave? Las webs que la utilicen dejarán de acceder al contenido.",
                          )
                        )
                          return;
                        start(async () => {
                          const r = await revokeKeyAction(space.id, k.id);
                          setMessage(r.error ?? "Clave revocada.");
                          router.refresh();
                        });
                      }}
                    >
                      Revocar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="content-panel settings-panel">
          <div className="panel-title">
            <div>
              <h2>Información del espacio</h2>
              <p>Identificadores para conectar tu aplicación.</p>
            </div>
          </div>
          <div className="settings-body info-list">
            <div>
              <span>Nombre</span>
              <strong>{space.name}</strong>
            </div>
            <div>
              <span>Identificador</span>
              <code>{space.id}</code>
            </div>
            <div>
              <span>Idiomas</span>
              <strong>Español · Galego</strong>
            </div>
            <Link href="/docs">Consultar la documentación de la API →</Link>
          </div>
        </section>
        <section className="content-panel settings-panel">
          <div className="panel-title">
            <div>
              <h2>Tu cuenta</h2>
              <p>Mantén tus datos de acceso al día.</p>
            </div>
          </div>
          <div className="settings-body">
            <Link href="/reset-password" className="button button-outline">
              Cambiar contraseña
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
