import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_SKEY,
  POST_COLLECTION,
  SPACE_TYPE,
} from "../config";
import { bulletinCapabilitiesFromScope } from "./bulletin-capabilities";

const viewerDid = "did:plc:viewer";
const ownerDid = "did:plc:owner";

test("a legacy credential cannot create boards or notes", () => {
  assert.deepEqual(
    bulletinCapabilitiesFromScope(
      "atproto transition:generic blob?accept=image/png",
      viewerDid,
      viewerDid,
    ),
    { canCreateBoard: false, canCreateNote: false },
  );
});

test("the bulletin space grant allows board and note creation", () => {
  const scope = bulletinScope("*");
  assert.deepEqual(
    bulletinCapabilitiesFromScope(scope, viewerDid, viewerDid),
    { canCreateBoard: true, canCreateNote: true },
  );
  assert.deepEqual(
    bulletinCapabilitiesFromScope(scope, viewerDid, ownerDid),
    { canCreateBoard: false, canCreateNote: true },
  );
});

test("read-only space access does not enable write flows", () => {
  const scope = [
    "atproto",
    `space:${SPACE_TYPE}?authority=*&skey=${BOARD_SKEY}&action=read`,
  ].join(" ");
  assert.deepEqual(
    bulletinCapabilitiesFromScope(scope, viewerDid, ownerDid),
    { canCreateBoard: false, canCreateNote: false },
  );
});

function bulletinScope(authority: string): string {
  const params = new URLSearchParams();
  params.set("authority", authority);
  params.set("skey", BOARD_SKEY);
  params.append("collection", POST_COLLECTION);
  params.append("action", "create");
  params.append("manage", "create");
  return `atproto space:${SPACE_TYPE}?${params}`;
}
