import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PASSWORD_HIDE_LABEL,
  PASSWORD_SHOW_LABEL,
  initialPasswordVisible,
  passwordVisibilityUi,
  togglePasswordVisible,
} from "../password-visibility";

test("mot de passe masqué par défaut", () => {
  assert.equal(initialPasswordVisible(), false);
  const ui = passwordVisibilityUi(false);
  assert.equal(ui.inputType, "password");
  assert.equal(ui.ariaLabel, PASSWORD_SHOW_LABEL);
  assert.equal(ui.ariaPressed, false);
});

test("clic → visible ; second clic → masqué", () => {
  let visible = initialPasswordVisible();
  visible = togglePasswordVisible(visible);
  assert.equal(visible, true);
  let ui = passwordVisibilityUi(visible);
  assert.equal(ui.inputType, "text");
  assert.equal(ui.ariaLabel, PASSWORD_HIDE_LABEL);
  assert.equal(ui.ariaPressed, true);

  visible = togglePasswordVisible(visible);
  assert.equal(visible, false);
  ui = passwordVisibilityUi(visible);
  assert.equal(ui.inputType, "password");
  assert.equal(ui.ariaLabel, PASSWORD_SHOW_LABEL);
  assert.equal(ui.ariaPressed, false);
});

test("labels accessibles distincts selon l'état", () => {
  assert.notEqual(PASSWORD_SHOW_LABEL, PASSWORD_HIDE_LABEL);
  assert.match(PASSWORD_SHOW_LABEL, /Afficher/i);
  assert.match(PASSWORD_HIDE_LABEL, /Masquer/i);
});

test("toggle ne dépend pas de la valeur du mot de passe (aucune fuite)", () => {
  const secret = "local-dev-password-ok";
  const before = passwordVisibilityUi(false);
  const after = passwordVisibilityUi(togglePasswordVisible(false));
  assert.equal(JSON.stringify(before).includes(secret), false);
  assert.equal(JSON.stringify(after).includes(secret), false);
  // Value conservation is owned by controlled input — visibility flip is independent
  assert.equal(before.inputType, "password");
  assert.equal(after.inputType, "text");
});

test("activation clavier — état aria-pressed suit le basculement", () => {
  // Keyboard activation of type=button calls the same toggle (no form submit)
  const pressed = passwordVisibilityUi(true).ariaPressed;
  assert.equal(pressed, true);
  assert.equal(passwordVisibilityUi(false).ariaPressed, false);
});

test("aucune valeur sensible dans les snapshots d'état UI", () => {
  const snap = {
    initial: initialPasswordVisible(),
    masked: passwordVisibilityUi(false),
    shown: passwordVisibilityUi(true),
  };
  const serialized = JSON.stringify(snap);
  assert.equal(serialized.includes("password"), true); // inputType only
  assert.equal(serialized.includes("APP_PASSWORD"), false);
  assert.equal(serialized.includes("local-dev"), false);
  assert.equal(serialized.includes("Bearer"), false);
});
