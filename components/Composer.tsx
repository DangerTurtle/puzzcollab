"use client";

import { useState } from "react";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-style";

export function Composer({
  ownerDid,
  position,
  onClose,
}: {
  ownerDid: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerDid,
        text,
        color,
        rotation: randomRotation(),
        ...position,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Could not pin note");
      setBusy(false);
      return;
    }
    setText("");
    window.location.reload();
  }

  return (
    <form
      className="card stack board-composer-card"
      onSubmit={submit}
      role="dialog"
      aria-label="Pin a note here"
    >
      <div className="composer-head">
        <h2>Pin a note</h2>
        <button
          className="composer-close"
          type="button"
          onClick={onClose}
          aria-label="Close composer"
        >
          ×
        </button>
      </div>
      <textarea
        className={`field composer-note color-${color}`}
        value={text}
        maxLength={300}
        onChange={(event) => setText(event.target.value)}
        placeholder="Leave something for the board…"
        autoFocus
      />
      <div className="composer-tools">
        <fieldset className="color-picker">
          <legend>Note color</legend>
          {NOTE_COLORS.map((option) => (
            <label key={option} title={capitalize(option)}>
              <input
                type="radio"
                name="note-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className={`color-swatch color-${option}`} />
              <span className="sr-only">{capitalize(option)}</span>
            </label>
          ))}
        </fieldset>
        <span>{text.length}/300</span>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="button" disabled={busy || !text.trim()}>
        {busy ? "Pinning…" : "Pin it"}
      </button>
    </form>
  );
}

function randomRotation(): number {
  return Math.floor(Math.random() * 37) - 18;
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
