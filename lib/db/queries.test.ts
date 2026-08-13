import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const { migrate } = await import("./migrations");
const {
  getAccount,
  getSyncedRepo,
  hasBoard,
  listBoardPosts,
  listBoards,
  saveAccount,
  saveBoard,
  saveSyncedRepo,
  upsertLabel,
  upsertPosition,
  upsertPost,
} = await import("./queries");

await migrate();

test("account and board queries return typed application rows", async () => {
  await saveAccount({
    did: "did:plc:owner",
    handle: "owner.test",
    pdsUrl: "https://pds.test",
  });
  await saveAccount({ did: "did:plc:owner" });
  await saveBoard("at://did:plc:owner/space/example.board/self", "did:plc:owner");

  assert.deepEqual(await getAccount("did:plc:owner"), {
    did: "did:plc:owner",
    handle: "owner.test",
    pdsUrl: "https://pds.test",
  });
  assert.equal(await hasBoard("did:plc:owner"), true);
  assert.deepEqual(await listBoards(), [
    { ownerDid: "did:plc:owner", handle: "owner.test" },
  ]);
});

test("board materialization applies owner moderation and positioning", async () => {
  const spaceUri = "at://did:plc:owner/space/example.board/self";
  const postUri = `${spaceUri}/did:plc:author/example.post/one`;
  const createdAt = new Date().toISOString();
  await saveAccount({ did: "did:plc:author", handle: "author.test" });
  await upsertPost({
    uri: postUri,
    cid: "post-cid",
    spaceUri,
    authorDid: "did:plc:author",
    text: "hello",
    color: "pink",
    rotation: 4,
    x: 10,
    y: 20,
    createdAt,
  });
  await upsertPosition({
    uri: `${spaceUri}/did:plc:owner/example.position/one`,
    cid: "position-cid",
    spaceUri,
    authorDid: "did:plc:owner",
    subjectUri: postUri,
    subjectCid: "post-cid",
    x: 30,
    y: 40,
    createdAt,
  });
  await upsertLabel({
    uri: `${spaceUri}/did:plc:owner/example.label/one`,
    cid: "label-cid",
    spaceUri,
    authorDid: "did:plc:owner",
    subjectUri: postUri,
    subjectCid: "post-cid",
    val: "hide",
    neg: false,
    createdAt,
  });

  assert.deepEqual(await listBoardPosts(spaceUri, "did:plc:owner"), [
    {
      uri: postUri,
      cid: "post-cid",
      spaceUri,
      authorDid: "did:plc:author",
      authorHandle: "author.test",
      text: "hello",
      imageCid: null,
      imageMime: null,
      imageSize: null,
      imageAlt: null,
      color: "pink",
      rotation: 4,
      x: 30,
      y: 40,
      createdAt,
      hidden: true,
    },
  ]);
});

test("sync repository hashes round-trip as byte arrays", async () => {
  await saveSyncedRepo({
    spaceUri: "at://did:plc:owner/space/example.board/self",
    repoDid: "did:plc:author",
    pdsUrl: "https://pds.test",
    rev: "1",
    ltHash: new Uint8Array([1, 2]),
    commitHash: new Uint8Array([3, 4]),
  });

  assert.deepEqual(
    await getSyncedRepo(
      "at://did:plc:owner/space/example.board/self",
      "did:plc:author",
    ),
    {
      spaceUri: "at://did:plc:owner/space/example.board/self",
      repoDid: "did:plc:author",
      pdsUrl: "https://pds.test",
      rev: "1",
      ltHash: new Uint8Array([1, 2]),
      commitHash: new Uint8Array([3, 4]),
    },
  );
});
