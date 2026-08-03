/**
 * Static markup checks for PasswordField (no jsdom dependency).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordField } from "../password-field";
import {
  PASSWORD_SHOW_LABEL,
  initialPasswordVisible,
} from "@/lib/password-visibility";

test("PasswordField — masqué initialement, bouton type=button, aria", () => {
  assert.equal(initialPasswordVisible(), false);
  const html = renderToStaticMarkup(
    createElement(PasswordField, {
      id: "pw",
      value: "secret-value-not-in-attrs-as-default-type",
      onChange: () => undefined,
    }),
  );
  assert.match(html, /type="password"/);
  assert.match(html, /type="button"/);
  assert.match(html, new RegExp(`aria-label="${PASSWORD_SHOW_LABEL}"`));
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /autocomplete="current-password"/i);
  // Button must not be type=submit
  assert.equal(html.includes('type="submit"'), false);
  // Value preserved in controlled input
  assert.match(html, /value="secret-value-not-in-attrs-as-default-type"/);
  // No localStorage / sessionStorage references in component output
  assert.equal(html.includes("localStorage"), false);
  assert.equal(html.includes("sessionStorage"), false);
});
