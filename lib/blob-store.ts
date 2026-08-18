import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseCid } from "@atproto/lex-data";
import { getRuntimeConfig } from "./config";

export function storeBlobFile(cid: string, bytes: Uint8Array): void {
  mkdirSync(getBlobDirectory(), { recursive: true });
  const target = blobPath(cid);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, bytes, { flag: "wx" });
    renameSync(temporary, target);
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}

export function readBlobFile(cid: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(blobPath(cid)));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export function deleteBlobFile(cid: string): void {
  try {
    unlinkSync(blobPath(cid));
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

function blobPath(cid: string): string {
  const canonical = parseCid(cid).toString();
  return path.join(getBlobDirectory(), canonical);
}

function getBlobDirectory(): string {
  const { blobDirectory, databasePath } = getRuntimeConfig();
  return path.resolve(
    blobDirectory ??
      path.join(path.dirname(path.resolve(databasePath)), "bulletin-blobs"),
  );
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
