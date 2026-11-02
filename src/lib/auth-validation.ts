import { z } from "zod";
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Introduce un email válido."));
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "Utiliza al menos 12 caracteres.")
  .max(PASSWORD_MAX_LENGTH, "Utiliza como máximo 128 caracteres.");
export const passwordsSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });
export const changePasswordSchema = passwordsSchema.safeExtend({
  currentPassword: z
    .string()
    .min(1, "Introduce tu contraseña actual.")
    .max(PASSWORD_MAX_LENGTH, "Revisa tu contraseña actual."),
});
export type AuthField =
  "email" | "currentPassword" | "password" | "confirmation";
export interface AuthState {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Partial<Record<AuthField, string>>;
  invalidLink?: boolean;
}
export const initialAuthState: AuthState = { status: "idle", message: "" };
export function authValidationError(error: z.ZodError): AuthState {
  const errors: Partial<Record<AuthField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as AuthField;
    if (!errors[field]) errors[field] = issue.message;
  }
  return { status: "error", message: "Revisa los campos indicados.", errors };
}
