import { XRPCError } from "@atproto/api";

export class WatchInvalidatedError extends Error {
  constructor() {
    super("Board subscription was invalidated");
    this.name = "WatchInvalidatedError";
  }
}

export function isSpaceDeletedError(error: unknown): boolean {
  return error instanceof XRPCError && error.error === "SpaceDeleted";
}

export function isSpaceNotFoundError(error: unknown): boolean {
  return error instanceof XRPCError && error.error === "SpaceNotFound";
}

export function isBoardAbsentError(error: unknown): boolean {
  return (
    error instanceof WatchInvalidatedError ||
    isSpaceDeletedError(error) ||
    isSpaceNotFoundError(error)
  );
}
