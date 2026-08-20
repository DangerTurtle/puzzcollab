"use client";

import type { BoardPost } from "@/lib/db/queries";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BOARD_COORDINATE_MAX } from "@/lib/note-constraints";
import { Composer } from "./Composer";
import { ModerationButton } from "./ModerationButton";

type SpatialPost = BoardPost & {
  displayDate: string;
  authorAvatar: string | null;
};

type DragState = {
  uri: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originalX: number;
  originalY: number;
  x: number;
  y: number;
};

type ComposerState = {
  x: number;
  y: number;
  left: number;
  top: number;
};

export function SpatialBoard({
  initialPosts,
  ownerDid,
  viewerDid,
  canWrite,
}: {
  initialPosts: SpatialPost[];
  ownerDid: string;
  viewerDid: string;
  canWrite: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [lastInitialPosts, setLastInitialPosts] = useState(initialPosts);
  const [activeUri, setActiveUri] = useState<string>();
  const [error, setError] = useState<string>();
  const [composer, setComposer] = useState<ComposerState>();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | undefined>(undefined);
  const router = useRouter();

  if (initialPosts !== lastInitialPosts) {
    setLastInitialPosts(initialPosts);
    setPosts(initialPosts);
  }

  useEffect(() => {
    const events = new EventSource(
      `/api/events?ownerDid=${encodeURIComponent(ownerDid)}`,
    );
    events.onmessage = () => router.refresh();
    return () => events.close();
  }, [ownerDid, router]);

  function canMove(post: SpatialPost): boolean {
    return viewerDid === ownerDid || viewerDid === post.authorDid;
  }

  function openComposer(event: PointerEvent<HTMLDivElement>) {
    if (!canWrite || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".spatial-note, .board-composer")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    setComposer({
      x: clampPosition(
        Math.round((localX / bounds.width) * BOARD_COORDINATE_MAX),
      ),
      y: clampPosition(
        Math.round((localY / bounds.height) * BOARD_COORDINATE_MAX),
      ),
      left: Math.min(Math.max(12, localX - 18), Math.max(12, bounds.width - 322)),
      top: Math.min(Math.max(12, localY - 18), Math.max(12, bounds.height - 374)),
    });
  }

  function startDrag(event: PointerEvent<HTMLElement>, post: SpatialPost) {
    if (
      !canMove(post) ||
      (event.target as HTMLElement).closest("button, a")
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      uri: post.uri,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalX: post.x,
      originalY: post.y,
      x: post.x,
      y: post.y,
    };
    setError(undefined);
    setActiveUri(post.uri);
  }

  function drag(event: PointerEvent<HTMLElement>) {
    const state = dragRef.current;
    const board = boardRef.current;
    if (!state || state.pointerId !== event.pointerId || !board) return;
    const bounds = board.getBoundingClientRect();
    state.x = clampPosition(
      Math.round(
        state.originalX +
          ((event.clientX - state.startClientX) / bounds.width) *
            BOARD_COORDINATE_MAX,
      ),
    );
    state.y = clampPosition(
      Math.round(
        state.originalY +
          ((event.clientY - state.startClientY) / bounds.height) *
            BOARD_COORDINATE_MAX,
      ),
    );
    setPosts((current) =>
      current.map((post) =>
        post.uri === state.uri ? { ...post, x: state.x, y: state.y } : post,
      ),
    );
  }

  async function finishDrag(event: PointerEvent<HTMLElement>) {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setActiveUri(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (state.x === state.originalX && state.y === state.originalY) return;

    const post = posts.find((candidate) => candidate.uri === state.uri);
    if (!post) return;
    const response = await fetch("/api/posts/position", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerDid,
        postUri: post.uri,
        postCid: post.cid,
        x: state.x,
        y: state.y,
      }),
    });
    const body = (await response.json()) as { postCid?: string; error?: string };
    if (!response.ok || !body.postCid) {
      setPosts((current) =>
        current.map((candidate) =>
          candidate.uri === state.uri
            ? { ...candidate, x: state.originalX, y: state.originalY }
            : candidate,
        ),
      );
      setError(body.error ?? "That note snapped back. Try moving it again.");
      return;
    }
    setPosts((current) =>
      current.map((candidate) =>
        candidate.uri === state.uri
          ? { ...candidate, cid: body.postCid ?? candidate.cid }
          : candidate,
      ),
    );
  }

  return (
    <div className="spatial-board-wrap">
      {error && <div className="error">{error}</div>}
      <div
        className={`spatial-board ${canWrite ? "can-compose" : ""}`}
        ref={boardRef}
        onPointerDown={openComposer}
      >
        {posts.length === 0 ? (
          <div className="empty board-empty">
            {canWrite ? "nothing here yet — pin the first note" : "nothing pinned here yet"}
          </div>
        ) : (
          posts.map((post) => {
            const movable = canMove(post);
            const imageOnly = Boolean(post.imageCid && !post.text);
            const author = post.authorHandle ? `@${post.authorHandle}` : "Someone";
            return (
              <article
                className={`note spatial-note color-${post.color} ${imageOnly ? "image-only" : ""} ${movable ? "movable" : ""} ${activeUri === post.uri ? "dragging" : ""}`}
                key={post.uri}
                style={{
                  left: `${(post.x / BOARD_COORDINATE_MAX) * 100}%`,
                  top: `${(post.y / BOARD_COORDINATE_MAX) * 100}%`,
                  transform: `rotate(${post.rotation / 10}deg)`,
                }}
                onPointerDown={(event) => startDrag(event, post)}
                onPointerMove={drag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                title={movable ? "Drag to move this note" : undefined}
              >
                {post.imageCid && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="note-image"
                    src={noteImageUrl(post)}
                    alt={post.imageAlt ?? ""}
                    draggable={false}
                  />
                )}
                {post.text && <div className="note-text">{post.text}</div>}
                {post.hidden && (
                  <div className="note-visibility">Removed from board</div>
                )}
                <Link
                  className="note-avatar"
                  href={authorBoardHref(post)}
                  aria-label={`Visit ${author}'s board. Written on ${post.displayDate}`}
                >
                  {post.authorAvatar ? (
                    // Profile blobs come from arbitrary member PDS hosts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.authorAvatar} alt="" draggable={false} />
                  ) : (
                    avatarLetter(post.authorHandle)
                  )}
                  <span className="note-avatar-tooltip" role="tooltip">
                    <strong>{author}</strong>
                    <span>{post.displayDate}</span>
                  </span>
                </Link>
                {(viewerDid === ownerDid || viewerDid === post.authorDid) && (
                  <ModerationButton
                    ownerDid={ownerDid}
                    postUri={post.uri}
                    postCid={post.cid}
                    ownNote={viewerDid === post.authorDid}
                  />
                )}
              </article>
            );
          })
        )}
        {composer && (
          <div
            className="board-composer"
            style={{ left: composer.left, top: composer.top }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Composer
              ownerDid={ownerDid}
              position={{ x: composer.x, y: composer.y }}
              onClose={() => setComposer(undefined)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function clampPosition(value: number): number {
  return Math.max(0, Math.min(BOARD_COORDINATE_MAX, value));
}

function avatarLetter(handle: string | null): string {
  return (handle?.replace(/^@/, "")[0] ?? "?").toUpperCase();
}

function authorBoardHref(post: SpatialPost): string {
  const handle = post.authorHandle?.replace(/^@/, "");
  return handle
    ? `/${encodeURIComponent(handle)}`
    : `/board/${encodeURIComponent(post.authorDid)}`;
}

function noteImageUrl(post: SpatialPost): string {
  return `/api/images?${new URLSearchParams({
    space: post.spaceUri,
    repo: post.authorDid,
    cid: post.imageCid ?? "",
  })}`;
}
