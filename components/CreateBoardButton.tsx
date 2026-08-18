"use client";

import { useState } from "react";

export function CreateBoardButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="stack">
      <button
        className="button"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          const response = await fetch("/api/boards", { method: "POST" });
          const body = (await response.json()) as { error?: string };
          if (!response.ok) {
            setError(body.error ?? "Could not create board");
            setBusy(false);
            return;
          }
          window.location.reload();
        }}
      >
        {busy ? "putting it up…" : "create my bulletin"}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
