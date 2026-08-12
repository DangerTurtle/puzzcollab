import { XRPCError } from "@atproto/api";
import assert from "node:assert/strict";
import test from "node:test";
import { isSpaceDeletedError } from "./errors";

test("recognizes the durable SpaceDeleted signal", () => {
  assert.equal(
    isSpaceDeletedError(new XRPCError(400, "SpaceDeleted")),
    true,
  );
  assert.equal(isSpaceDeletedError(new XRPCError(404, "SpaceNotFound")), false);
  assert.equal(isSpaceDeletedError(new Error("SpaceDeleted")), false);
});
