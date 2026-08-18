"use client";

import { useState } from "react";

type KnownBoard = { ownerDid: string; handle: string | null };

export function BoardFinder({
  knownBoards,
}: {
  knownBoards: KnownBoard[];
}) {
  const [identifier, setIdentifier] = useState("");
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
    <form className="board-search" onSubmit={submit}>
      <div className="board-search-field">
        <span aria-hidden="true">@</span>
        <input
          className="board-search-input"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value.replace(/^@+/, ""))}
          placeholder="find someone"
          aria-label="Board owner handle"
          list="known-boards"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <datalist id="known-boards">
        {knownBoards
          .filter((board) => board.handle)
          .map((board) => (
            <option key={board.ownerDid} value={board.handle ?? ""} />
          ))}
      </datalist>
      {error && <div className="board-search-error">{error}</div>}
      <button
        className="board-search-button"
        disabled={busy || !identifier.trim()}
        aria-label="Open board"
      >
        {busy ? "…" : "go"}
      </button>
    </form>
  );
}
