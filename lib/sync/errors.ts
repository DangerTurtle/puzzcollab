import { XRPCError } from "@atproto/api";

export function isSpaceDeletedError(error: unknown): boolean {
  return error instanceof XRPCError && error.error === "SpaceDeleted";
}
