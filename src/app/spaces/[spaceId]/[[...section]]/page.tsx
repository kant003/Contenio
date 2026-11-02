import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { session } from "@/lib/session";
import { userQuery } from "@/lib/database";
import { getLinkedResources } from "@/lib/editor-resources";
import { getMediaPage } from "@/lib/media-listing";
import { parseMediaFilters, mediaHref } from "@/lib/media-filters";
import { getContentPage } from "@/lib/content-listing";
import {
  contentHref,
  firstParam,
  parseContentFilters,
  type SearchParams,
} from "@/lib/content-filters";
import { assetUrl } from "@/lib/storage";
import { Shell } from "@/components/shell";
import { ContentList } from "@/components/content-list";
import { EntryEditor } from "@/components/entry-editor";
import { Models } from "@/components/models";
import { Media } from "@/components/media";
import { Settings } from "@/components/settings";
import type {
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
  searchParams: Promise<SearchParams>;
}) {
  const { spaceId, section = [] } = await params,
    search = await searchParams;
  if (!z.uuid().safeParse(spaceId).success) notFound();
  if (!section.length) redirect(`/spaces/${spaceId}/content`);
  const { user, isAdmin, db } = await session();
  const [spaces, models] = await Promise.all([
    userQuery<Space>(user.id, "select * from spaces order by created_at"),
    userQuery<ContentType>(
      user.id,
      "select * from content_types where space_id=$1 order by created_at",
      [spaceId],
    ),
  ]);
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) notFound();
  let body: React.ReactNode;
  if (section[0] === "content" && section.length === 1) {
    const filters = parseContentFilters(search);
    const result = await getContentPage(user.id, spaceId, filters);
    if (result.page !== filters.page)
      redirect(contentHref(spaceId, { ...filters, page: result.page }));
    body = (
      <ContentList
        key={contentHref(spaceId, filters)}
        space={spaceId}
        result={result}
        types={models}
        filters={filters}
      />
    );
  } else if (section[0] === "content" && section.length === 2) {
    if (section[1] !== "new" && !z.uuid().safeParse(section[1]).success)
      notFound();
    const [entries, pubs] = await Promise.all([
      userQuery<Entry>(
        user.id,
        "select * from entries where space_id=$1 and id=$2",
        [spaceId, section[1] === "new" ? null : section[1]],
      ),
      userQuery<Publication>(
        user.id,
        "select * from current_publications where space_id=$1 and entry_id=$2",
        [spaceId, section[1] === "new" ? null : section[1]],
      ),
    ]);
    const entry =
      section[1] === "new"
        ? undefined
        : entries.find((e) => e.id === section[1]);
    if (section[1] !== "new" && !entry) notFound();
    const type = models.find(
      (t) => t.id === (entry?.content_type_id ?? firstParam(search.type)),
    );
    if (!type) notFound();
    const { assets, entryChoices } = await getLinkedResources(
      user.id,
      spaceId,
      entry?.id,
    );
    body = (
      <EntryEditor
        key={entry?.id ?? `new-${type.id}`}
        space={spaceId}
        initial={entry}
        type={type}
        assets={assets}
        entryChoices={entryChoices}
        publications={pubs}
        initialLocale={firstParam(search.locale) === "gl" ? "gl" : "es"}
      />
    );
  } else if (section[0] === "models" && section.length === 1)
    body = <Models space={spaceId} types={models} isAdmin={isAdmin} />;
  else if (section[0] === "media" && section.length === 1) {
    const filters = parseMediaFilters(search);
    const result = await getMediaPage(user.id, spaceId, filters);
    if (result.page !== filters.page)
      redirect(mediaHref(spaceId, { ...filters, page: result.page }));
    body = (
      <Media
        key={spaceId}
        space={spaceId}
        filters={filters}
        result={{
          ...result,
          items: result.items.map((a) => ({ ...a, url: assetUrl(a) })),
        }}
      />
    );
  } else if (section[0] === "settings" && section.length === 1 && isAdmin) {
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
