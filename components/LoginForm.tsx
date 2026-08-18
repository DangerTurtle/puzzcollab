"use client";

import { useEffect, useId, useState } from "react";

type ActorSuggestion = {
  did: string;
  handle: string;
  displayName: string | null;
};

export function LoginForm() {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionListId = useId();
  const suggestionsOpen = searchFocused && suggestions.length > 0;

  useEffect(() => {
    const query = handle.trim().replace(/^@+/, "");
    if (!searchFocused || query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/actors/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Handle search failed (${response.status})`);
        const body = (await response.json()) as { actors?: ActorSuggestion[] };
        setSuggestions(body.actors ?? []);
        setActiveSuggestion(-1);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === "AbortError") return;
        setSuggestions([]);
        setActiveSuggestion(-1);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [handle, searchFocused]);

  function selectSuggestion(actor: ActorSuggestion) {
    setHandle(actor.handle);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearchFocused(false);
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
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSearchFocused(false);
    }
  }

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
      <div className="login-handle-control">
        <div className="login-handle-field">
          <span className="login-handle-prefix" aria-hidden="true">
            @
          </span>
          <input
            className="login-handle-input"
            value={handle}
            onChange={(event) => {
              setHandle(event.target.value.replace(/^@+/, ""));
              setSuggestions([]);
              setActiveSuggestion(-1);
              setSearchFocused(true);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
            placeholder="your.handle"
            aria-label="Atmosphere handle"
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
          <div className="login-handle-suggestions" id={suggestionListId} role="listbox">
            {suggestions.map((actor, index) => (
              <button
                key={actor.did}
                id={`${suggestionListId}-${index}`}
                className="login-handle-suggestion"
                type="button"
                role="option"
                aria-selected={index === activeSuggestion}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(actor)}
              >
                <span className="login-handle-suggestion-name">
                  {actor.displayName || `@${actor.handle}`}
                </span>
                {actor.displayName && (
                  <span className="login-handle-suggestion-handle">@{actor.handle}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <button className="button" disabled={busy || !handle.trim()}>
        {busy ? "Signing you in…" : "Login with Atmosphere"}
      </button>
    </form>
  );
}
