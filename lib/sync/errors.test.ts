import { XRPCError } from "@atproto/api";
import assert from "node:assert/strict";
import test from "node:test";
import {
  isBoardAbsentError,
  isSpaceDeletedError,
  isSpaceNotFoundError,
  WatchInvalidatedError,
} from "./errors";

test("recognizes the durable SpaceDeleted signal", () => {
  assert.equal(
    isSpaceDeletedError(new XRPCError(400, "SpaceDeleted")),
    true,
  );
  assert.equal(isSpaceDeletedError(new XRPCError(404, "SpaceNotFound")), false);
  assert.equal(isSpaceDeletedError(new Error("SpaceDeleted")), false);
});

test("recognizes a missing space", () => {
  assert.equal(
    isSpaceNotFoundError(new XRPCError(404, "SpaceNotFound")),
    true,
  );
  assert.equal(isSpaceNotFoundError(new XRPCError(400, "SpaceDeleted")), false);
  assert.equal(isSpaceNotFoundError(new Error("SpaceNotFound")), false);
});

test("treats durable deletions and invalidated watches as absent boards", () => {
  assert.equal(isBoardAbsentError(new XRPCError(404, "SpaceNotFound")), true);
  assert.equal(isBoardAbsentError(new XRPCError(400, "SpaceDeleted")), true);
  assert.equal(isBoardAbsentError(new WatchInvalidatedError()), true);
  assert.equal(isBoardAbsentError(new Error("Space has been deleted")), false);
});
