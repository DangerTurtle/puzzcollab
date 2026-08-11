"use client";

import { useState } from "react";

export function LoginForm() {
  const [handle, setHandle] = useState("alice.test");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const response = await fetch("/oauth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const body = (await response.json()) as { redirectUrl?: string; error?: string };
    if (!response.ok || !body.redirectUrl) {
      setError(body.error ?? "Could not sign in");
      setBusy(false);
      return;
    }
    window.location.href = body.redirectUrl;
  }

  return (
    <form className="stack" onSubmit={submit}>
      <input
        className="field"
        value={handle}
        onChange={(event) => setHandle(event.target.value)}
        placeholder="alice.test"
        aria-label="Atmosphere handle"
      />
      {error && <div className="error">{error}</div>}
      <button className="button" disabled={busy || !handle.trim()}>
        {busy ? "Signing you in…" : "Login with Atmosphere"}
      </button>
    </form>
  );
}
