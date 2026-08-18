"use client";

import { useState } from "react";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-style";
import {
  MAX_NOTE_IMAGE_ALT_LENGTH,
  MAX_NOTE_IMAGE_BYTES,
  MAX_NOTE_TEXT_LENGTH,
  NOTE_IMAGE_MIME_TYPES,
} from "@/lib/note-constraints";

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
  const [image, setImage] = useState<File>();
  const [imageAlt, setImageAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    if (image && image.size > MAX_NOTE_IMAGE_BYTES) {
      setError("Choose an image smaller than 500 KB");
      setBusy(false);
      return;
    }
    const form = new FormData();
    form.set("ownerDid", ownerDid);
    form.set("text", text);
    form.set("color", color);
    form.set("rotation", String(randomRotation()));
    form.set("x", String(position.x));
    form.set("y", String(position.y));
    if (image) {
      form.set("image", image);
      form.set("imageAlt", imageAlt);
    }
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not pin note");
      }
      setText("");
      window.location.reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not pin note",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="stack board-composer-card"
      onSubmit={submit}
      role="dialog"
      aria-label="Pin a note here"
    >
      <div className="composer-head">
        <h2>leave a note</h2>
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
        maxLength={MAX_NOTE_TEXT_LENGTH}
        onChange={(event) => setText(event.target.value)}
        placeholder="write something…"
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
        <span>{text.length}/{MAX_NOTE_TEXT_LENGTH}</span>
      </div>
      <div className="composer-image-fields">
        <label className="composer-image-picker">
          <span>{image ? "change image" : "add an image"}</span>
          <input
            type="file"
            accept={NOTE_IMAGE_MIME_TYPES.join(",")}
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next && next.size > MAX_NOTE_IMAGE_BYTES) {
                setImage(undefined);
                setError("Choose an image smaller than 500 KB");
                event.target.value = "";
                return;
              }
              setError(undefined);
              setImage(next);
            }}
          />
        </label>
        {image && (
          <>
            <span className="composer-image-name">{image.name}</span>
            <input
              className="field composer-image-alt"
              value={imageAlt}
              maxLength={MAX_NOTE_IMAGE_ALT_LENGTH}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder="describe the image (optional)"
              aria-label="Image description"
            />
          </>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <button
        className="button"
        disabled={busy || (!text.trim() && !image)}
        aria-busy={busy}
      >
        {busy ? "pinning…" : "pin note"}
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
