"use client";

import { useState } from "react";

/** A password input with a show/hide control, so a typo is easy to catch. */
export function PasswordField({
  name,
  label,
  autoComplete = "current-password",
}: {
  name: string;
  label: string;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label>
      <span>{label}</span>
      <span className="password-field" style={{ display: "block" }}>
        <input
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="reveal quiet"
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
