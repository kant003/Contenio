"use client";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3, Check, LoaderCircle } from "lucide-react";
import { loginAction, recoveryAction, passwordAction } from "@/app/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function AuthForm({
  mode = "login",
  resetToken,
}: {
  mode?: "login" | "recovery" | "password";
  resetToken?: string;
}) {
  const [message, action, pending] = useActionState(
    mode === "login"
      ? loginAction
      : mode === "recovery"
        ? recoveryAction
        : passwordAction,
    "",
  );
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          contenio
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">UN LUGAR PARA TUS IDEAS</span>
          <h1>
            Tu contenido.
            <br />
            Muchas
            <br />
            <em>posibilidades.</em>
          </h1>
          <p>
            Crea una vez. Conecta con todas tus webs.
            <br />
            Con el control que necesitas y sin complicaciones.
          </p>
          <div className="auth-pills">
            <span>
              <Check size={14} /> Varios espacios
            </span>
            <span>
              <Check size={14} /> Multidioma
            </span>
          </div>
        </div>
        <div className="auth-orbit">
          <Layers3 size={120} strokeWidth={0.7} />
        </div>
        <small>CONTENIO · CONTENT MANAGEMENT, SIMPLIFIED</small>
      </aside>
      <section className="auth-main">
        <div className="auth-box">
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h2>
            {mode === "login"
              ? "Qué bien verte de nuevo."
              : mode === "recovery"
                ? "Recupera tu acceso."
                : "Una nueva contraseña."}
          </h2>
          <p>
            {mode === "login"
              ? "Entra para dar forma a tu próximo contenido."
              : mode === "recovery"
                ? "Te enviaremos un enlace para volver a entrar."
                : "Elige una contraseña de al menos 12 caracteres."}
          </p>
          <form action={action}>
            {resetToken && (
              <input type="hidden" name="resetToken" value={resetToken} />
            )}
            {mode === "password" && !resetToken && (
              <label>
                Contraseña actual
                <Input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
            {mode !== "password" && (
              <label>
                Email
                <Input
                  name="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {mode !== "recovery" && (
              <label>
                Contraseña
                <Input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "password" ? 12 : undefined}
                  required
                />
              </label>
            )}
            {mode === "password" && (
              <label>
                Repite la contraseña
                <Input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
            )}
            {mode === "login" && (
              <Link href="/forgot-password" className="auth-recovery">
                ¿Has olvidado tu contraseña?
              </Link>
            )}
            {message && (
              <p
                className={
                  message.startsWith("Si la") ||
                  message.startsWith("Contraseña actualizada")
                    ? "notice success"
                    : "notice error"
                }
                role="status"
              >
                {message}
              </p>
            )}
            <Button disabled={pending} className="full">
              {pending ? <LoaderCircle size={17} className="spin" /> : null}
              {mode === "login"
                ? "Entrar a mi espacio"
                : mode === "recovery"
                  ? "Enviar enlace"
                  : "Actualizar contraseña"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {mode !== "login" ? (
            <Link href="/login" className="auth-back">
              Volver al inicio de sesión
            </Link>
          ) : (
            <div className="auth-note">
              <span className="status-dot" />
              Acceso privado. Tu administrador gestiona las cuentas.
            </div>
          )}
        </div>
        <footer>Un poco más de orden. Mucho más contenido.</footer>
      </section>
    </main>
  );
}
