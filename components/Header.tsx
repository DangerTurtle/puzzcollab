import { getAccount } from "@/lib/db/queries";
import Link from "next/link";
import { BoardFinder } from "./BoardFinder";
import { LogoutButton } from "./LogoutButton";

export async function Header({
  did,
  showAbout = true,
}: {
  did?: string | null;
  showAbout?: boolean;
}) {
  const handle = did ? (await getAccount(did))?.handle : null;
  return (
    <header className="topbar">
      <div className="topbar-primary">
        <Link className="brand" href="/">
          bulletin
        </Link>
        {showAbout && (
          <Link className="topbar-link" href="/about">
            about
          </Link>
        )}
      </div>
      {did && (
        <div className="topbar-actions">
          <BoardFinder />
          <div className="session">
            <Link
              className="session-user"
              href={handle ? `/${encodeURIComponent(handle)}` : "/"}
            >
              {handle ? `@${handle}` : "My board"}
            </Link>
            <LogoutButton />
          </div>
        </div>
      )}
    </header>
  );
}
