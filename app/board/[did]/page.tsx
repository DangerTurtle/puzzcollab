import { cacheIdentity } from "@/lib/atproto/identity";
import { getAccount } from "@/lib/db/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyBoardPage({
  params,
}: {
  params: Promise<{ did: string }>;
}) {
  const identifier = decodeURIComponent((await params).did);
  if (identifier.startsWith("did:")) {
    await cacheIdentity(identifier).catch(() => undefined);
    const handle = (await getAccount(identifier))?.handle;
    if (handle) redirect(`/${encodeURIComponent(handle)}`);
  } else {
    redirect(`/${encodeURIComponent(identifier.replace(/^@/, ""))}`);
  }
  redirect("/");
}
