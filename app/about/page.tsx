import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "about · bulletin",
  description: "About Bulletin, an example application built on atproto spaces",
};

export default async function AboutPage() {
  const session = await getSession();

  return (
    <main className="shell about-page">
      <div className="about-header">
        <Header did={session?.did} showAbout={false} />
      </div>
      <article className="about-content">
        <h1>
          bulletin boards on <span>atproto spaces</span>
        </h1>

        <section>
          <h2>How it works</h2>
          <p>
            Every user on a spaces-compatible PDS can create one bulletin board.
            This is represented as a space with their DID as the authority. Only
            their followers can read it, and only mutuals can leave notes. The
            board owner can rearrange notes or remove them.
          </p>
        </section>

        <section>
          <h2>What it’s for</h2>
          <p>
            This is a developer experiment, not a finished social product. Check
            out{" "}
            <a href="https://github.com/bluesky-social/bulletin">the code</a>,
            give it a run, poke at the interaction model, inspect the custom{" "}
            <code>my.bulletin.*</code> Lexicons, and remix it into something of
            your own.
          </p>
        </section>

        <section>
          <h2>How to get in</h2>
          <p>
            Head over to the new{" "}
            <a href="https://bsky.network/account">BPS site</a> to get your
            invite code to the Bluesky-hosted spaces alpha PDS. If you&apos;re
            feeling adventurous, you can self-host your own PDS!
          </p>
        </section>

        <p className="about-more">
          Read the proposal for{" "}
          <a href="https://github.com/bluesky-social/proposals/tree/main/0016-permissioned-data">
            atproto spaces
          </a>
          .
        </p>
      </article>
    </main>
  );
}
