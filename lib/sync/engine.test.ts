import assert from "node:assert/strict";
import test from "node:test";
import { POST_COLLECTION } from "../config";
import { parseChange } from "./engine";

test("removes a stale post when a replacement value is malformed", () => {
  const space = "at://did:plc:owner/space/my.bulletin.board/self";
  const repoDid = "did:plc:writer";
  assert.deepEqual(
    parseChange({
      space,
      repoDid,
      collection: POST_COLLECTION,
      rkey: "post",
      cid: "bafyreireplacement",
      value: null,
    }),
    {
      kind: "delete",
      table: "post",
      uri: `${space}/${repoDid}/${POST_COLLECTION}/post`,
      spaceUri: space,
      authorDid: repoDid,
    },
  );
});
