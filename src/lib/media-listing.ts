import { userQuery } from "./database";
import {
  MEDIA_PAGE_SIZE,
  type MediaFilters,
  type MediaPage,
} from "./media-filters";

/** RLS applies to every branch, including counts; URLs are signed only for the returned page. */
export async function getMediaPage(
  userId: string,
  spaceId: string,
  filters: MediaFilters,
): Promise<MediaPage> {
  const rows = await userQuery<MediaPage>(
    userId,
    `
    with scoped as materialized (
      select id,space_id,path,name,mime,size,alt,description,created_at
      from assets where space_id=$1
    ), filtered as materialized (
      select * from scoped
      where ($3='' or strpos(lower(name),lower($3))>0
        or strpos(lower(coalesce(alt->>$2,'')),lower($3))>0
        or strpos(lower(coalesce(description->>$2,'')),lower($3))>0)
        and ($4='' or ($4='image' and mime like 'image/%') or ($4='pdf' and mime='application/pdf'))
    ), counts as (
      select count(*)::int as total from filtered
    ), bounds as (
      select greatest(1,least($6::int,ceil(total::numeric/$7::int)::int)) as page from counts
    )
    select counts.total,bounds.page,
      (select jsonb_build_object('total',count(*),'images',count(*) filter(where mime like 'image/%'),
        'pdfs',count(*) filter(where mime='application/pdf'),'bytes',coalesce(sum(size),0)) from scoped) as stats,
      (select coalesce(jsonb_agg(to_jsonb(r)-'created_at' order by
        case when $5='name' then lower(r.name) end,
        case when $5='size' then r.size end desc,
        case when $5='recent' then r.created_at end desc,r.id),'[]'::jsonb)
       from (select * from filtered
         order by case when $5='name' then lower(name) end,
           case when $5='size' then size end desc,
           case when $5='recent' then created_at end desc,id
         limit $7::int offset (select (page-1)*$7::int from bounds)) r) as items
    from counts cross join bounds
  `,
    [
      spaceId,
      filters.locale,
      filters.q,
      filters.kind,
      filters.sort,
      filters.page,
      MEDIA_PAGE_SIZE,
    ],
  );
  return rows[0];
}
