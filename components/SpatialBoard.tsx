"use client";

import type { BoardPost } from "@/lib/db/queries";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
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
  const [activeUri, setActiveUri] = useState<string>();
  const [error, setError] = useState<string>();
  const [composer, setComposer] = useState<ComposerState>();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const events = new EventSource(`/api/events?ownerDid=${encodeURIComponent(ownerDid)}`);
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
      x: clamp(Math.round((localX / bounds.width) * 1000)),
      y: clamp(Math.round((localY / bounds.height) * 1000)),
      left: Math.min(Math.max(12, localX - 18), Math.max(12, bounds.width - 322)),
      top: Math.min(Math.max(12, localY - 18), Math.max(12, bounds.height - 374)),
    });
  }

  function startDrag(event: PointerEvent<HTMLElement>, post: SpatialPost) {
    if (!canMove(post) || (event.target as HTMLElement).closest("button")) return;
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
    state.x = clamp(
      Math.round(state.originalX + ((event.clientX - state.startClientX) / bounds.width) * 1000),
    );
    state.y = clamp(
      Math.round(state.originalY + ((event.clientY - state.startClientY) / bounds.height) * 1000),
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
      <div className="board-instructions">
        {canWrite && "Click an empty spot to pin a note. "}
        Drag {viewerDid === ownerDid ? "any note" : "your notes"} to rearrange the board.
      </div>
      {error && <div className="error">{error}</div>}
      <div
        className={`spatial-board ${canWrite ? "can-compose" : ""}`}
        ref={boardRef}
        onPointerDown={openComposer}
      >
        {posts.length === 0 ? (
          <div className="empty board-empty">The corkboard is bare. Pin the first note.</div>
        ) : (
          posts.map((post) => {
            const movable = canMove(post);
            const author = post.authorHandle ? `@${post.authorHandle}` : "Someone";
            return (
              <article
                className={`note spatial-note color-${post.color} ${movable ? "movable" : ""} ${activeUri === post.uri ? "dragging" : ""}`}
                key={post.uri}
                style={{
                  left: `${post.x / 10}%`,
                  top: `${post.y / 10}%`,
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
                <div className="note-text">{post.text}</div>
                {post.hidden && (
                  <div className="note-visibility">Removed from board</div>
                )}
                <div
                  className="note-avatar"
                  aria-label={`Written by ${author} on ${post.displayDate}`}
                  tabIndex={0}
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
                </div>
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

function clamp(value: number): number {
  return Math.max(0, Math.min(1000, value));
}

function avatarLetter(handle: string | null): string {
  return (handle?.replace(/^@/, "")[0] ?? "?").toUpperCase();
}

function noteImageUrl(post: SpatialPost): string {
  return `/api/images?${new URLSearchParams({
    space: post.spaceUri,
    repo: post.authorDid,
    cid: post.imageCid ?? "",
  })}`;
}
