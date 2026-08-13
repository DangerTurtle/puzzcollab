import { Agent } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-node";
import {
  LABEL_COLLECTION,
  MANAGING_APP_SERVICE,
  POSITION_COLLECTION,
  POST_COLLECTION,
  SPACE_TYPE,
  boardUri,
} from "../config";
import {
  deleteStoredPost,
  applySyncedChanges,
  getPost,
  hasBoard,
  saveBoard,
  upsertLabel,
  upsertPost,
  upsertPosition,
} from "../db/queries";
import { getRelationship, userFollows } from "./follows";
import type { NoteColor } from "../note-style";
import { noteImageBlobRef, parseNoteImage, type NoteImage } from "../note-image";
import {
  isNoteImageMime,
  MAX_NOTE_IMAGE_BYTES,
} from "../note-constraints";
import { storeBlobFile } from "../blob-store";

export async function createBoard(session: OAuthSession): Promise<string> {
  const agent = new Agent(session);
  const result = await agent.com.atproto.simplespace.createSpace({
    type: SPACE_TYPE,
    skey: "self",
    policy: {
      $type: "com.atproto.simplespace.defs#managingAppPolicy",
      managingApp: MANAGING_APP_SERVICE,
    },
    appAccess: {
      $type: "com.atproto.simplespace.defs#open",
    },
  });
  await saveBoard(result.data.uri, session.did);
  return result.data.uri;
}

export async function followOwner(
  session: OAuthSession,
  ownerDid: string,
): Promise<void> {
  if (await userFollows(session.did, ownerDid)) return;
  const agent = new Agent(session);
  await agent.app.bsky.graph.follow.create(
    { repo: session.did },
    { subject: ownerDid, createdAt: new Date().toISOString() },
  );
}

export async function createPost(
  session: OAuthSession,
  ownerDid: string,
  text: string,
  style: { color: NoteColor; rotation: number; x: number; y: number },
  imageInput?: {
    bytes: Uint8Array;
    mimeType: string;
    alt: string | null;
  },
): Promise<string> {
  if (!(await hasBoard(ownerDid))) throw new Error("Board does not exist");
  await assertCanWrite(session.did, ownerDid);
  const space = boardUri(ownerDid);
  const createdAt = new Date().toISOString();
  const position = { x: style.x, y: style.y };
  const agent = new Agent(session);
  let image: NoteImage | undefined;
  if (imageInput) {
    if (
      !isNoteImageMime(imageInput.mimeType) ||
      imageInput.bytes.length <= 0 ||
      imageInput.bytes.length > MAX_NOTE_IMAGE_BYTES
    ) {
      throw new Error("Invalid note image");
    }
    const uploaded = await agent.com.atproto.repo.uploadBlob(imageInput.bytes, {
      encoding: imageInput.mimeType,
    });
    image =
      parseNoteImage(uploaded.data.blob.ipld(), imageInput.alt) ?? undefined;
    if (
      !image ||
      image.mimeType !== imageInput.mimeType ||
      image.size !== imageInput.bytes.length
    ) {
      throw new Error("PDS returned an invalid image reference");
    }
  }
  const result = await agent.com.atproto.space.createRecord({
    space,
    repo: session.did,
    collection: POST_COLLECTION,
    validate: false,
    record: {
      $type: POST_COLLECTION,
      text,
      ...(image ? { image: noteImageBlobRef(image) } : {}),
      ...(image?.alt ? { imageAlt: image.alt } : {}),
      position,
      color: style.color,
      rotation: style.rotation,
      createdAt,
    },
  });
  const blob = image
    ? {
        spaceUri: space,
        repoDid: session.did,
        cid: image.cid,
        mimeType: image.mimeType,
        size: image.size,
      }
    : undefined;
  await applySyncedChanges(
    [
      {
        kind: "post",
        value: {
          uri: result.data.uri,
          cid: result.data.cid,
          spaceUri: space,
          authorDid: session.did,
          text,
          image,
          color: style.color,
          rotation: style.rotation,
          ...position,
          createdAt,
        },
      },
    ],
    blob ? [blob] : [],
  );
  if (image) {
    try {
      storeBlobFile(image.cid, imageInput!.bytes);
    } catch (error) {
      console.error("Could not cache the new note image", error);
    }
  }
  return result.data.uri;
}

export async function movePost(
  session: OAuthSession,
  input: {
    ownerDid: string;
    postUri: string;
    postCid: string;
    x: number;
    y: number;
  },
): Promise<string> {
  const post = await getPost(input.postUri);
  const space = boardUri(input.ownerDid);
  if (!post || post.spaceUri !== space || post.cid !== input.postCid) {
    throw new Error("That note has changed");
  }
  if (session.did !== input.ownerDid && session.did !== post.authorDid) {
    throw new Error("You cannot move this note");
  }
  await assertCanWrite(session.did, input.ownerDid);

  const agent = new Agent(session);
  if (session.did === post.authorDid) {
    const image = storedPostImage(post);
    const rkey = postRkey(post.uri, space, post.authorDid);
    const result = await agent.com.atproto.space.putRecord({
      space,
      repo: session.did,
      collection: POST_COLLECTION,
      rkey,
      validate: false,
      record: {
        $type: POST_COLLECTION,
        text: post.text,
        ...(image ? { image: noteImageBlobRef(image) } : {}),
        ...(image?.alt ? { imageAlt: image.alt } : {}),
        ...(post.color ? { color: post.color } : {}),
        ...(post.rotation !== null ? { rotation: post.rotation } : {}),
        position: { x: input.x, y: input.y },
        createdAt: post.createdAt,
      },
    });
    await upsertPost({
      ...post,
      cid: result.data.cid,
      color: post.color ?? undefined,
      rotation: post.rotation ?? undefined,
      image,
      x: input.x,
      y: input.y,
    });
    return result.data.cid;
  }

  const createdAt = new Date().toISOString();
  const result = await agent.com.atproto.space.createRecord({
    space,
    repo: session.did,
    collection: POSITION_COLLECTION,
    validate: false,
    record: {
      $type: POSITION_COLLECTION,
      subject: { uri: post.uri, cid: post.cid },
      position: { x: input.x, y: input.y },
      createdAt,
    },
  });
  await upsertPosition({
    uri: result.data.uri,
    cid: result.data.cid,
    spaceUri: space,
    authorDid: session.did,
    subjectUri: post.uri,
    subjectCid: post.cid,
    x: input.x,
    y: input.y,
    createdAt,
  });
  return post.cid;
}

export async function deleteOwnPost(
  session: OAuthSession,
  input: { ownerDid: string; postUri: string; postCid: string },
): Promise<void> {
  const post = await getPost(input.postUri);
  const space = boardUri(input.ownerDid);
  if (!post || post.spaceUri !== space || post.cid !== input.postCid) {
    throw new Error("That note has changed");
  }
  if (session.did !== post.authorDid) {
    throw new Error("You can only delete your own notes");
  }

  const agent = new Agent(session);
  await agent.com.atproto.space.deleteRecord({
    space,
    repo: session.did,
    collection: POST_COLLECTION,
    rkey: postRkey(post.uri, space, post.authorDid),
  });
  await deleteStoredPost(post.uri);
}

export async function labelPost(
  session: OAuthSession,
  input: {
    ownerDid: string;
    postUri: string;
    postCid: string;
    hidden: boolean;
  },
): Promise<string> {
  if (session.did !== input.ownerDid) {
    throw new Error("Only the board owner can moderate this board");
  }
  const space = boardUri(input.ownerDid);
  const createdAt = new Date().toISOString();
  const agent = new Agent(session);
  const result = await agent.com.atproto.space.createRecord({
    space,
    repo: session.did,
    collection: LABEL_COLLECTION,
    validate: false,
    record: {
      $type: LABEL_COLLECTION,
      subject: { uri: input.postUri, cid: input.postCid },
      val: "hide",
      neg: !input.hidden,
      createdAt,
    },
  });
  await upsertLabel({
    uri: result.data.uri,
    cid: result.data.cid,
    spaceUri: space,
    authorDid: session.did,
    subjectUri: input.postUri,
    subjectCid: input.postCid,
    val: "hide",
    neg: !input.hidden,
    createdAt,
  });
  return result.data.uri;
}

async function assertCanWrite(userDid: string, ownerDid: string): Promise<void> {
  if (userDid === ownerDid) return;
  const relationship = await getRelationship(userDid, ownerDid);
  if (!relationship.follows || !relationship.followedBy) {
    throw new Error("Only mutual followers can post");
  }
}

function postRkey(uri: string, space: string, authorDid: string): string {
  const prefix = `${space}/${authorDid}/${POST_COLLECTION}/`;
  if (!uri.startsWith(prefix)) throw new Error("Invalid note reference");
  const rkey = uri.slice(prefix.length);
  if (!rkey || rkey.includes("/")) throw new Error("Invalid note reference");
  return rkey;
}

function storedPostImage(
  post: Awaited<ReturnType<typeof getPost>>,
): NoteImage | undefined {
  if (!post?.imageCid || !isNoteImageMime(post.imageMime) || post.imageSize === null) {
    return undefined;
  }
  return {
    cid: post.imageCid,
    mimeType: post.imageMime,
    size: post.imageSize,
    alt: post.imageAlt,
  };
}
