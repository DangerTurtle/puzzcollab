"use client";

import { useId, useState } from "react";
import {
  type ActorSuggestion,
  useActorTypeahead,
} from "./useActorTypeahead";

export function BoardFinder() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const {
    suggestions,
    activeSuggestion,
    setActiveSuggestion,
    clearSuggestions,
  } = useActorTypeahead(identifier, searchFocused);
  const suggestionListId = useId();
  const suggestionsOpen = searchFocused && suggestions.length > 0;

  function openSuggestion(actor: ActorSuggestion) {
    window.location.href = `/${encodeURIComponent(actor.handle)}`;
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      openSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSearchFocused(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || busy) return;
    setSearchFocused(false);
    clearSuggestions();
    setBusy(true);
    setError(undefined);
    const url = new URL("/api/resolve", window.location.origin);
    url.searchParams.set("identifier", normalizedIdentifier);
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
          onChange={(event) => {
            setIdentifier(event.target.value.replace(/^@+/, ""));
            clearSuggestions();
            setSearchFocused(true);
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={handleSearchKeyDown}
          placeholder="find someone"
          aria-label="Board owner handle"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen}
          aria-controls={suggestionListId}
          aria-activedescendant={
            activeSuggestion >= 0
              ? `${suggestionListId}-${activeSuggestion}`
              : undefined
          }
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {suggestionsOpen && (
        <div className="board-search-suggestions" id={suggestionListId} role="listbox">
          {suggestions.map((actor, index) => (
            <button
              key={actor.did}
              id={`${suggestionListId}-${index}`}
              className="board-search-suggestion"
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openSuggestion(actor)}
            >
              <span className="board-search-suggestion-name">
                {actor.displayName || `@${actor.handle}`}
              </span>
              {actor.displayName && (
                <span className="board-search-suggestion-handle">@{actor.handle}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {error && <div className="board-search-error">{error}</div>}
      <button
        className="board-search-button"
        disabled={busy || !identifier.trim()}
        aria-busy={busy}
        aria-label="Open board"
      >
        {busy ? "…" : "go"}
      </button>
    </form>
  );
}
