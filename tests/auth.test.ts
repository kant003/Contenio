import { describe, it, expect } from "vitest";
import {
  emailSchema,
  newPasswordSchema,
  passwordsSchema,
  changePasswordSchema,
  authValidationError,
} from "../src/lib/auth-validation";
describe("validación del acceso", () => {
  it("normaliza el correo sin aceptar direcciones inválidas", () => {
    expect(emailSchema.parse("  CUENTA@EXAMPLE.COM ")).toBe(
      "cuenta@example.com",
    );
    expect(emailSchema.safeParse("sin-email").success).toBe(false);
  });
  it("aplica los mismos límites de contraseña sin recortar su contenido", () => {
    expect(newPasswordSchema.safeParse("a".repeat(11)).success).toBe(false);
    expect(newPasswordSchema.safeParse("a".repeat(12)).success).toBe(true);
    expect(newPasswordSchema.safeParse("a".repeat(128)).success).toBe(true);
    expect(newPasswordSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(newPasswordSchema.parse(" contraseña larga ")).toBe(
      " contraseña larga ",
    );
  });
  it("asocia la confirmación incorrecta al campo correspondiente", () => {
    const result = passwordsSchema.safeParse({
      password: "Una contraseña válida",
      confirmation: "Distinta contraseña",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(authValidationError(result.error)).toMatchObject({
        status: "error",
        errors: { confirmation: "Las contraseñas no coinciden." },
      });
  });
  it("exige la contraseña actual y conserva la comprobación de confirmación", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      password: "Una contraseña válida",
      confirmation: "Distinta contraseña",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const state = authValidationError(result.error);
      expect(state.errors).toHaveProperty("currentPassword");
      expect(state.errors).toHaveProperty("confirmation");
      expect(JSON.stringify(state)).not.toContain("Una contraseña válida");
    }
  });
});
