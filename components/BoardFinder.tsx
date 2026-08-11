"use client";

import { useState } from "react";

type KnownBoard = { ownerDid: string; handle: string | null };

export function BoardFinder({
  knownBoards,
  compact = false,
}: {
  knownBoards: KnownBoard[];
  compact?: boolean;
}) {
  const [identifier, setIdentifier] = useState(
    knownBoards.find((board) => board.handle)?.handle ?? "",
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const url = new URL("/api/resolve", window.location.origin);
    url.searchParams.set("identifier", identifier);
    const response = await fetch(url);
    const body = (await response.json()) as { handle?: string; error?: string };
    if (!response.ok || !body.handle) {
      setError(body.error ?? "Board not found");
      setBusy(false);
      return;
    }
    window.location.href = `/${encodeURIComponent(body.handle)}`;
  }

  return (
    <form className={compact ? "board-search" : "stack"} onSubmit={submit}>
      <input
        className={compact ? "board-search-input" : "field"}
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        placeholder="Find a board…"
        aria-label="Board owner handle"
        list="known-boards"
      />
      <datalist id="known-boards">
        {knownBoards
          .filter((board) => board.handle)
          .map((board) => (
            <option key={board.ownerDid} value={board.handle ?? ""} />
          ))}
      </datalist>
      {!compact && knownBoards.some((board) => board.handle) && (
        <p className="fineprint">
          Available now: {knownBoards.filter((board) => board.handle).map((board) => `@${board.handle}`).join(", ")}
        </p>
      )}
      {error && <div className={compact ? "board-search-error" : "error"}>{error}</div>}
      <button
        className={compact ? "board-search-button" : "button secondary"}
        disabled={busy || !identifier.trim()}
        aria-label="Open board"
      >
        {busy ? "…" : compact ? "Open" : "Find their board →"}
      </button>
    </form>
  );
}
