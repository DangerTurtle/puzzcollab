"use client";

import { useState } from "react";

export function FollowGate({
  ownerDid,
  ownerHandle,
}: {
  ownerDid: string;
  ownerHandle?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="card gate">
      <div className="lock">◉</div>
      <h2>Followers only</h2>
      <p>
        Follow {ownerHandle ? `@${ownerHandle}` : "this person"} to read their
        board. If they follow you back, you can leave notes too.
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const response = await fetch("/api/follow", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ownerDid }),
          });
          const body = (await response.json()) as { error?: string };
          if (!response.ok) {
            setError(body.error ?? "Could not follow");
            setBusy(false);
            return;
          }
          window.location.reload();
        }}
      >
        {busy ? "Following…" : "Follow & open board"}
      </button>
      {error && <div className="error">{error}</div>}
      <p className="fineprint">Your follow is visible to others in Atmosphere.</p>
    </div>
  );
}
