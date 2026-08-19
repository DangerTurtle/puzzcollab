"use client";

import { useState } from "react";

export function ModerationButton(props: {
  ownerDid: string;
  postUri: string;
  postCid: string;
  ownNote: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="note-remove"
      disabled={busy}
      title={props.ownNote ? "Delete your note" : "Remove note from board"}
      aria-label={props.ownNote ? "Delete your note" : "Remove note from board"}
      onClick={async () => {
        setBusy(true);
        const response = await fetch(props.ownNote ? "/api/posts" : "/api/removals", {
          method: props.ownNote ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ownerDid: props.ownerDid,
            postUri: props.postUri,
            postCid: props.postCid,
          }),
        });
        if (response.ok) window.location.reload();
        else setBusy(false);
      }}
    >
      {busy ? "…" : "×"}
    </button>
  );
}
