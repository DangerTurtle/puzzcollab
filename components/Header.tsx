import { getAccount } from "@/lib/db/queries";
import Link from "next/link";
import { BoardFinder } from "./BoardFinder";
import { LogoutButton } from "./LogoutButton";

export async function Header({
  did,
  showAbout = true,
  showSearch = true,
}: {
  did?: string | null;
  showAbout?: boolean;
  showSearch?: boolean;
}) {
  const handle = did ? (await getAccount(did))?.handle : null;
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        bulletin
      </Link>
      {did && (
        <div className="topbar-actions">
          {showSearch && <BoardFinder />}
          <div className="session">
            <Link
              className="session-user"
              href={handle ? `/${encodeURIComponent(handle)}` : "/"}
            >
              {handle ? `@${handle}` : "My board"}
            </Link>
            {showAbout && (
              <Link className="topbar-link" href="/about">
                about
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      )}
      {!did && showAbout && (
        <Link className="topbar-link" href="/about">
          about
        </Link>
      )}
    </header>
  );
}
