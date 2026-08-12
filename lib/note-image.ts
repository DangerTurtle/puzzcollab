import {
  getBlobCidString,
  getBlobMime,
  getBlobSize,
  isBlobRef,
  parseCid,
} from "@atproto/lex-data";

export const MAX_NOTE_IMAGE_BYTES = 500_000;
export const MAX_NOTE_IMAGE_ALT_LENGTH = 300;
export const NOTE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type NoteImage = {
  cid: string;
  mimeType: (typeof NOTE_IMAGE_MIME_TYPES)[number];
  size: number;
  alt: string | null;
};

export function isNoteImageMime(
  value: unknown,
): value is NoteImage["mimeType"] {
  return NOTE_IMAGE_MIME_TYPES.includes(value as NoteImage["mimeType"]);
}

export function parseNoteImage(
  image: unknown,
  alt: unknown,
): NoteImage | null {
  if (!isBlobRef(image)) return null;
  const cid = getBlobCidString(image);
  const mimeType = getBlobMime(image);
  const size = getBlobSize(image);
  if (
    !cid ||
    !isNoteImageMime(mimeType) ||
    size === undefined ||
    size <= 0 ||
    size > MAX_NOTE_IMAGE_BYTES
  ) {
    return null;
  }
  if (alt !== undefined && typeof alt !== "string") return null;
  const normalizedAlt = typeof alt === "string" ? alt.trim() : "";
  if (Array.from(normalizedAlt).length > MAX_NOTE_IMAGE_ALT_LENGTH) return null;
  return { cid, mimeType, size, alt: normalizedAlt || null };
}

export function noteImageBlobRef(image: NoteImage) {
  return {
    $type: "blob" as const,
    ref: parseCid(image.cid),
    mimeType: image.mimeType,
    size: image.size,
  };
}
