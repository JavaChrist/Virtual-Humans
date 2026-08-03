/**
 * Password field visibility helpers (Phase 7 correctif).
 * Pure — no storage, no logging of values.
 */

export const PASSWORD_SHOW_LABEL = "Afficher le mot de passe";
export const PASSWORD_HIDE_LABEL = "Masquer le mot de passe";

export type PasswordVisibilityUi = {
  inputType: "password" | "text";
  ariaLabel: string;
  ariaPressed: boolean;
};

/** Initial state is always masked. */
export function initialPasswordVisible(): boolean {
  return false;
}

export function togglePasswordVisible(visible: boolean): boolean {
  return !visible;
}

export function passwordVisibilityUi(visible: boolean): PasswordVisibilityUi {
  return {
    inputType: visible ? "text" : "password",
    ariaLabel: visible ? PASSWORD_HIDE_LABEL : PASSWORD_SHOW_LABEL,
    ariaPressed: visible,
  };
}
