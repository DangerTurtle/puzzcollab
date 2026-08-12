import { createPost, deleteOwnPost } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { isNoteColor, isNoteRotation } from "@/lib/note-style";
import {
  isBoardCoordinate,
  isNoteImageMime,
  MAX_NOTE_IMAGE_ALT_LENGTH,
  MAX_NOTE_IMAGE_BYTES,
  MAX_NOTE_TEXT_LENGTH,
} from "@/lib/note-constraints";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();
    const ownerDid = stringValue(body.get("ownerDid"));
    const text = stringValue(body.get("text"))?.trim();
    const color = stringValue(body.get("color"));
    const rotation = numberValue(body.get("rotation"));
    const x = numberValue(body.get("x"));
    const y = numberValue(body.get("y"));
    const imageValue = body.get("image");
    const image =
      imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    const imageAlt = stringValue(body.get("imageAlt"))?.trim() ?? "";
    if (
      !ownerDid?.startsWith("did:") ||
      !text ||
      Array.from(text).length > MAX_NOTE_TEXT_LENGTH ||
      !isNoteColor(color) ||
      !isNoteRotation(rotation) ||
      !isBoardCoordinate(x) ||
      !isBoardCoordinate(y) ||
      (image !== null &&
        (!isNoteImageMime(image.type) ||
          image.size > MAX_NOTE_IMAGE_BYTES ||
          Array.from(imageAlt).length > MAX_NOTE_IMAGE_ALT_LENGTH))
    ) {
      return NextResponse.json(
        { error: "Enter a valid note and an optional image up to 500 KB" },
        { status: 400 },
      );
    }
    const uri = await createPost(
      await requireSession(),
      ownerDid,
      text,
      { color, rotation, x, y },
      image
        ? {
            bytes: new Uint8Array(await image.arrayBuffer()),
            mimeType: image.type,
            alt: imageAlt || null,
          }
        : undefined,
    );
    return NextResponse.json({ uri });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not pin your note right now" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      postUri?: string;
      postCid?: string;
    };
    if (!body.ownerDid?.startsWith("did:") || !body.postUri || !body.postCid) {
      throw new Error("Invalid note target");
    }
    await deleteOwnPost(await requireSession(), {
      ownerDid: body.ownerDid,
      postUri: body.postUri,
      postCid: body.postCid,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not delete your note right now" },
      { status: 400 },
    );
  }
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: FormDataEntryValue | null): number | undefined {
  const string = stringValue(value);
  if (string === undefined || string.trim() === "") return undefined;
  const number = Number(string);
  return Number.isFinite(number) ? number : undefined;
}
