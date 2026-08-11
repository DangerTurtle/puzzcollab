import { CreateBoardButton } from "@/components/CreateBoardButton";
import { FollowGate } from "@/components/FollowGate";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { SpatialBoard } from "@/components/SpatialBoard";
import { userFollows } from "@/lib/atproto/follows";
import { getProfileAvatarUrl } from "@/lib/atproto/profile";
import { cacheIdentity, resolveHandle } from "@/lib/atproto/identity";
import { getSession } from "@/lib/auth/session";
import { boardUri } from "@/lib/config";
import { getAccount, hasBoard, listBoardPosts } from "@/lib/db/queries";
import { watchBoard } from "@/lib/sync/client";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = decodeURIComponent((await params).handle).replace(/^@/, "");
  const session = await getSession();
  const ownerDid = await resolveHandle(handle);
  if (!ownerDid) {
    return <BoardNotFound viewerDid={session?.did} />;
  }
  await cacheIdentity(ownerDid).catch(() => undefined);
  const ownBoard = session?.did === ownerDid;
  const space = boardUri(ownerDid);
  const owner = getAccount(ownerDid);

  if (!session) {
    return (
      <main className="shell">
        <Header />
        <div className="card gate">
          <h2>Sign in to view this board</h2>
          <p>Boards are shared with the people who follow their owner.</p>
          <LoginForm />
        </div>
      </main>
    );
  }

  if (ownBoard && !hasBoard(ownerDid)) {
    return (
      <main className="shell">
        <Header did={session.did} />
        <div className="card gate stack">
          <h2>Your board isn’t up yet</h2>
          <p>Put up your board and start collecting notes.</p>
          <CreateBoardButton />
        </div>
      </main>
    );
  }

  if (!ownBoard && !hasBoard(ownerDid)) {
    return (
      <main className="shell">
        <Header did={session.did} />
        <div className="card gate stack">
          <h2>No board here yet</h2>
          <p>
            {owner?.handle ? `@${owner.handle}` : "This person"} has not created
            a board yet.
          </p>
        </div>
      </main>
    );
  }

  let accessError: string | undefined;
  try {
    await watchBoard(space, session.did);
  } catch (error) {
    console.error("Could not open board", error);
    accessError = error instanceof Error ? error.message : "Access denied";
  }

  if (accessError && !ownBoard) {
    const follows = await userFollows(session.did, ownerDid).catch(() => false);
    return (
      <main className="shell">
        <Header did={session.did} />
        <section className="board-head">
          <div className="eyebrow">Followers-only board</div>
          <h1>{owner?.handle ? `@${owner.handle}` : "Someone’s board"}</h1>
        </section>
        {follows ? (
          <div className="card gate">
            <h2>The board couldn’t be opened</h2>
            <p>Something went wrong. Give it a moment and try again.</p>
          </div>
        ) : (
          <FollowGate ownerDid={ownerDid} ownerHandle={owner?.handle} />
        )}
      </main>
    );
  }

  const posts = listBoardPosts(space, ownerDid);
  const visiblePosts = posts.filter((post) => !post.hidden);
  const displayedPosts = posts.filter(
    (post) => !post.hidden || post.authorDid === session.did,
  );
  const avatarEntries = await Promise.all(
    [...new Set(displayedPosts.map((post) => post.authorDid))].map(
      async (did) => [did, await getProfileAvatarUrl(did)] as const,
    ),
  );
  const avatars = new Map(avatarEntries);
  const canWrite =
    ownBoard ||
    (await Promise.all([
      userFollows(session.did, ownerDid).catch(() => false),
      userFollows(ownerDid, session.did).catch(() => false),
    ])).every(Boolean);

  return (
    <main className="shell">
      <Header did={session.did} />
      <section className="board-head">
        <div className="eyebrow">Bulletin board</div>
        <h1>{owner?.handle ? `@${owner.handle}` : "Your board"}</h1>
        <div className="board-meta">
          <span>
            {visiblePosts.length} {visiblePosts.length === 1 ? "note" : "notes"}
          </span>
          <span>·</span>
          <span>Followers only</span>
          <span>·</span>
          <span>{canWrite ? "You can post" : "Reading only"}</span>
        </div>
      </section>
      <div className="board-layout">
        <SpatialBoard
          key={displayedPosts
            .map(
              (post) =>
                `${post.cid}:${post.x}:${post.y}:${post.color}:${post.rotation}:${post.hidden}`,
            )
            .join("|")}
          initialPosts={displayedPosts.map((post) => ({
            ...post,
            displayDate: formatDate(post.createdAt),
            authorAvatar: avatars.get(post.authorDid) ?? null,
          }))}
          ownerDid={ownerDid}
          viewerDid={session.did}
          canWrite={canWrite}
        />
      </div>
    </main>
  );
}

function BoardNotFound({ viewerDid }: { viewerDid?: string }) {
  return (
    <main className="shell">
      <Header did={viewerDid} />
      <div className="card gate">
        <h2>Board not found</h2>
        <p>Check the handle and try again.</p>
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
