import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth/session";
import { cacheIdentity } from "@/lib/atproto/identity";
import { getAccount } from "@/lib/db/queries";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) {
    await cacheIdentity(session.did).catch(() => undefined);
    const handle = (await getAccount(session.did))?.handle;
    if (handle) redirect(`/${encodeURIComponent(handle)}`);
  }

  return (
    <main className="shell">
      <section className="home-stage">
        <div className="home-login">
          <h1 className="home-title">
            create your <span>bulletin</span>
          </h1>
          <LoginForm />
          <nav className="home-login-links" aria-label="More about Bulletin">
            <span className="home-alpha-prompt">
              get your{" "}
              <a href="https://bsky.network/account">spaces alpha</a> account
            </span>
            <Link className="topbar-link" href="/about">
              about
            </Link>
          </nav>
        </div>

        <ul className="home-feature-notes" aria-label="What Bulletin does">
          <li className="home-feature-note home-feature-note-intro">
            everyone gets their own board
          </li>
          <li className="home-feature-note home-feature-note-read">
            only your followers can read
          </li>
          <li className="home-feature-note home-feature-note-write">
            mutuals can leave a note
          </li>
          <li className="home-feature-note home-feature-note-control">
            rearrange or remove any note on your board
          </li>
        </ul>
      </section>
    </main>
  );
}
