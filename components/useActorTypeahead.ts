"use client";

import { useEffect, useState } from "react";

export type ActorSuggestion = {
  did: string;
  handle: string;
  displayName: string | null;
};

export function useActorTypeahead(query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    const normalized = query.trim().replace(/^@+/, "");
    if (!enabled || normalized.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/actors/search?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Handle search failed (${response.status})`);
        const body = (await response.json()) as { actors?: ActorSuggestion[] };
        setSuggestions(body.actors ?? []);
        setActiveSuggestion(-1);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setSuggestions([]);
        setActiveSuggestion(-1);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query]);

  function clearSuggestions() {
    setSuggestions([]);
    setActiveSuggestion(-1);
  }

  return {
    suggestions,
    activeSuggestion,
    setActiveSuggestion,
    clearSuggestions,
  };
}
