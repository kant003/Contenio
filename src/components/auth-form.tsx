"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3, Check, LoaderCircle } from "lucide-react";
import {
  loginAction,
  recoveryAction,
  resetPasswordAction,
  changePasswordAction,
} from "@/app/actions";
import {
  initialAuthState,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  type AuthField,
} from "@/lib/auth-validation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function AuthForm({
  mode = "login",
  resetToken,
  invalidLink = false,
  email,
}: {
  mode?: "login" | "recovery" | "reset" | "change";
  resetToken?: string;
  invalidLink?: boolean;
  email?: string;
}) {
  const [state, action, pending] = useActionState(
    {
      login: loginAction,
      recovery: recoveryAction,
      reset: resetPasswordAction,
      change: changePasswordAction,
    }[mode],
    initialAuthState,
  );
  const [values, setValues] = useState({
    email: "",
    password: "",
    currentPassword: "",
    confirmation: "",
  });
  const passwordMode = mode === "reset" || mode === "change";
  const unusable = invalidLink || Boolean(state.invalidLink);
  const complete = passwordMode && state.status === "success";
  const field = (name: AuthField) => ({
    id: `auth-${name}`,
    name,
    value: values[name],
    disabled: pending,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
    "aria-invalid": Boolean(state.errors?.[name]),
    "aria-describedby": state.errors?.[name] ? `auth-${name}-error` : undefined,
  });
  const error = (name: AuthField) =>
    state.errors?.[name] ? (
      <p id={`auth-${name}-error`} className="field-error">
        {state.errors[name]}
      </p>
    ) : null;
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
            {unusable
              ? "Este enlace ya no es válido."
              : mode === "login"
                ? "Qué bien verte de nuevo."
                : mode === "recovery"
                  ? "Recupera tu acceso."
                  : mode === "change"
                    ? "Tu contraseña."
                    : "Una nueva contraseña."}
          </h2>
          <p>
            {unusable
              ? "Puede haber caducado o haberse utilizado. Solicita un enlace nuevo para recuperar el acceso."
              : mode === "login"
                ? "Entra para dar forma a tu próximo contenido."
                : mode === "recovery"
                  ? "Te enviaremos un enlace de un solo uso, válido durante 30 minutos."
                  : "Elige una contraseña de entre 12 y 128 caracteres."}
          </p>
          {email && (
            <p className="account-email">
              Sesión iniciada como <strong>{email}</strong>
            </p>
          )}
          {unusable ? (
            <Link
              className="button button-primary full"
              href="/forgot-password"
            >
              Solicitar otro enlace
            </Link>
          ) : (
            <>
              {state.message && (
                <p
                  className={`notice ${state.status === "success" ? "success" : "error"}`}
                  role={state.status === "error" ? "alert" : "status"}
                >
                  {state.message}
                </p>
              )}
              {!complete && (
                <form action={action}>
                  {resetToken && (
                    <input type="hidden" name="resetToken" value={resetToken} />
                  )}
                  {mode === "change" && (
                    <>
                      <label htmlFor="auth-currentPassword">
                        Contraseña actual
                      </label>
                      <Input
                        {...field("currentPassword")}
                        type="password"
                        autoComplete="current-password"
                        maxLength={PASSWORD_MAX_LENGTH}
                        required
                      />
                      {error("currentPassword")}
                    </>
                  )}
                  {!passwordMode && (
                    <>
                      <label htmlFor="auth-email">Email</label>
                      <Input
                        {...field("email")}
                        type="email"
                        placeholder="tu@empresa.com"
                        autoComplete="email"
                        required
                      />
                      {error("email")}
                    </>
                  )}
                  {mode !== "recovery" && (
                    <>
                      <label htmlFor="auth-password">
                        {passwordMode ? "Nueva contraseña" : "Contraseña"}
                      </label>
                      <Input
                        {...field("password")}
                        type="password"
                        autoComplete={
                          passwordMode ? "new-password" : "current-password"
                        }
                        minLength={
                          passwordMode ? PASSWORD_MIN_LENGTH : undefined
                        }
                        maxLength={PASSWORD_MAX_LENGTH}
                        required
                      />
                      {error("password")}
                    </>
                  )}
                  {passwordMode && (
                    <>
                      <label htmlFor="auth-confirmation">
                        Repite la contraseña
                      </label>
                      <Input
                        {...field("confirmation")}
                        type="password"
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN_LENGTH}
                        maxLength={PASSWORD_MAX_LENGTH}
                        required
                      />
                      {error("confirmation")}
                    </>
                  )}
                  {mode === "login" && (
                    <Link href="/forgot-password" className="auth-recovery">
                      ¿Has olvidado tu contraseña?
                    </Link>
                  )}
                  <Button disabled={pending} className="full">
                    {pending ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : null}
                    {mode === "login"
                      ? "Entrar a mi espacio"
                      : mode === "recovery"
                        ? "Enviar enlace"
                        : "Actualizar contraseña"}
                    <ArrowRight size={17} />
                  </Button>
                </form>
              )}
            </>
          )}
          {mode !== "login" ? (
            <Link
              href={mode === "change" ? "/spaces" : "/login"}
              className="auth-back"
            >
              {mode === "change"
                ? "Volver a mis espacios"
                : "Volver al inicio de sesión"}
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
