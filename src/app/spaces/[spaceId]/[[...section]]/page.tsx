import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { session } from "@/lib/session";
import { userQuery } from "@/lib/database";
import { assetUrl } from "@/lib/storage";
import { Shell } from "@/components/shell";
import { ContentList } from "@/components/content-list";
import { EntryEditor } from "@/components/entry-editor";
import { Models } from "@/components/models";
import { Media } from "@/components/media";
import { Settings } from "@/components/settings";
import type {
  Asset,
  ContentType,
  Entry,
  Publication,
  ReadKey,
  Space,
} from "@/lib/types";
export default async function Workspace({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string; section?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { spaceId, section = [] } = await params,
    search = await searchParams;
  if (!z.uuid().safeParse(spaceId).success) notFound();
  if (!section.length) redirect(`/spaces/${spaceId}/content`);
  const { user, isAdmin, db } = await session();
  const [spaces, models, pubs, entries, assetRows] = await Promise.all([
    userQuery<Space>(user.id, "select * from spaces order by created_at"),
    userQuery<ContentType>(
      user.id,
      "select * from content_types where space_id=$1 order by created_at",
      [spaceId],
    ),
    userQuery<Publication>(
      user.id,
      "select * from current_publications where space_id=$1",
      [spaceId],
    ),
    userQuery<Entry>(
      user.id,
      "select * from entries where space_id=$1 order by updated_at desc",
      [spaceId],
    ),
    userQuery<Asset>(
      user.id,
      "select * from assets where space_id=$1 order by created_at desc",
      [spaceId],
    ),
  ]);
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) notFound();
  const assets = assetRows.map((a) => ({ ...a, url: assetUrl(a) }));
  let body: React.ReactNode;
  if (section[0] === "content" && section.length === 1)
    body = (
      <ContentList
        space={spaceId}
        entries={entries}
        types={models}
        publications={pubs}
      />
    );
  else if (section[0] === "content" && section.length === 2) {
    const entry =
      section[1] === "new"
        ? undefined
        : entries.find((e) => e.id === section[1]);
    if (section[1] !== "new" && !entry) notFound();
    const type = models.find(
      (t) => t.id === (entry?.content_type_id ?? search.type),
    );
    if (!type) notFound();
    body = (
      <EntryEditor
        key={entry?.id ?? `new-${type.id}`}
        space={spaceId}
        initial={entry}
        type={type}
        assets={assets}
        entries={entries}
        types={models}
        publications={pubs}
        initialLocale={search.locale === "gl" ? "gl" : "es"}
      />
    );
  } else if (section[0] === "models" && section.length === 1)
    body = <Models space={spaceId} types={models} isAdmin={isAdmin} />;
  else if (section[0] === "media" && section.length === 1)
    body = <Media space={spaceId} assets={assets} />;
  else if (section[0] === "settings" && section.length === 1 && isAdmin) {
    const [keys, { data: members, error }] = await Promise.all([
      userQuery<ReadKey>(
        user.id,
        "select id,name,prefix,created_at,revoked_at from api_keys where space_id=$1 order by created_at desc",
        [spaceId],
      ),
      db.rpc("list_members", { p_space: spaceId }),
    ]);
    if (error) throw error;
    body = <Settings space={space} keys={keys} members={members ?? []} />;
  } else notFound();
  return (
    <Shell
      space={space}
      spaces={spaces}
      email={user.email ?? ""}
      isAdmin={isAdmin}
      section={section[0]}
    >
      {body}
    </Shell>
  );
}
