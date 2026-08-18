import { getAccount } from "@/lib/db/queries";
import Link from "next/link";
import { BoardFinder } from "./BoardFinder";
import { LogoutButton } from "./LogoutButton";

export async function Header({ did }: { did?: string | null }) {
  const handle = did ? (await getAccount(did))?.handle : null;
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        bulletin
      </Link>
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
