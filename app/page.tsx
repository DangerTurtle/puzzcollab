import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth/session";
import { cacheIdentity } from "@/lib/atproto/identity";
import { getAccount } from "@/lib/db/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) {
    await cacheIdentity(session.did).catch(() => undefined);
    const handle = getAccount(session.did)?.handle;
    if (handle) redirect(`/${encodeURIComponent(handle)}`);
  }

  return (
    <main className="shell">
      <Header />
      <section className="hero">
        <div className="eyebrow">A little corner for your people</div>
        <h1>Your corner of the noticeboard.</h1>
        <p className="lede">
          Your followers can read the board. People you follow back can leave a
          note. You decide what stays.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Come on in</h2>
          <p>Sign in to open your board and see what your people have posted.</p>
          <LoginForm />
        </div>

        <div className="card">
          <h2>One board per person</h2>
          <p>
            Your board opens as soon as you sign in. From there, use the header
            search to visit someone else’s board.
          </p>
          <p className="protocol">Followers read · Mutuals post</p>
        </div>
      </section>
    </main>
  );
}
