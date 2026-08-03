"use client";

import { useId, useState } from "react";
import {
  initialPasswordVisible,
  passwordVisibilityUi,
  togglePasswordVisible,
} from "@/lib/password-visibility";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
};

/** Shared-password input with accessible show/hide control. */
export function PasswordField({
  value,
  onChange,
  disabled,
  autoFocus,
  id,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(initialPasswordVisible);
  const ui = passwordVisibilityUi(visible);

  function onToggle() {
    setVisible((v) => togglePasswordVisible(v));
  }

  return (
    <div>
      <label className="label" htmlFor={inputId}>
        Mot de passe
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={ui.inputType}
          className="input w-full pr-12"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="current-password"
          placeholder="••••••••"
          maxLength={256}
          name="password"
          disabled={disabled}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center justify-center min-w-11 min-h-11 px-3 text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] rounded-md"
          onClick={onToggle}
          aria-label={ui.ariaLabel}
          aria-pressed={ui.ariaPressed}
          tabIndex={0}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2" />
      <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8" />
    </svg>
  );
}
