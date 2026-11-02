import { userQuery } from "./database";
import {
  CONTENT_PAGE_SIZE,
  type ContentFilters,
  type ContentPage,
} from "./content-filters";

/** One statement keeps the page, counts and tenant-scoped statistics consistent. */
export async function getContentPage(
  userId: string,
  spaceId: string,
  filters: ContentFilters,
  excludeId?: string,
): Promise<ContentPage> {
  const rows = await userQuery<ContentPage>(
    userId,
    `
    with summaries as materialized (
      select e.id, e.content_type_id, e.updated_at,
        coalesce(nullif(case when jsonb_typeof(title.value)='string' then title.value #>> '{}' end,''),'Sin título') as title,
        coalesce(e.translations->$2->>'slug',e.shared->>'slug','Sin slug') as slug,
        case when p.id is null then 'draft'
          when active.fields=p.fields then 'published' else 'changed' end as status,
        exists(select 1 from publication_heads h where h.space_id=e.space_id and h.entry_id=e.id) as has_publication
      from entries e
      join content_types t on t.id=e.content_type_id and t.space_id=e.space_id
      left join current_publications p on p.entry_id=e.id and p.space_id=e.space_id and p.locale=$2
      cross join lateral (
        select coalesce((select f->>'key' from jsonb_array_elements(t.fields) with ordinality as f(f,n)
          where f->>'key'='title' or f->>'type'='short_text'
          order by (f->>'key'='title') desc,n limit 1),'title') as key
      ) title_key
      cross join lateral (
        select coalesce(nullif(e.translations->$2->title_key.key,'null'::jsonb),e.shared->title_key.key) as value
      ) title
      cross join lateral (
        select coalesce(jsonb_object_agg(f->>'key',v.fields->(f->>'key')),'{}'::jsonb) as fields
        from jsonb_array_elements(t.fields) f
        cross join lateral (select e.shared || coalesce(e.translations->$2,'{}'::jsonb) as fields) v
        where (f->>'active')::boolean and v.fields ? (f->>'key')
      ) active
      where e.space_id=$1 and ($9::uuid is null or e.id<>$9::uuid)
    ), filtered as materialized (
      select * from summaries
      where ($3='' or strpos(lower(title),lower($3))>0 or strpos(lower(slug),lower($3))>0)
        and ($4='' or content_type_id=nullif($4,'')::uuid)
        and ($5='' or status=$5)
    ), counts as (
      select count(*)::int as total from filtered
    ), bounds as (
      select greatest(1,least($7::int,ceil(total::numeric/$8::int)::int)) as page from counts
    )
    select counts.total, bounds.page,
      (select jsonb_build_object('total',count(*),'published',count(*) filter(where has_publication),
        'drafts',count(*) filter(where not has_publication)) from summaries) as stats,
      (select coalesce(jsonb_agg(to_jsonb(r) order by
        case when $6='name' then lower(r.title) end,
        case when $6='updated' then r.updated_at end desc,r.id),'[]'::jsonb)
       from (select id,content_type_id,title,slug,status,updated_at from filtered
         order by case when $6='name' then lower(title) end,
           case when $6='updated' then updated_at end desc,id
         limit $8::int offset (select (page-1)*$8::int from bounds)) r) as items
    from counts cross join bounds
  `,
    [
      spaceId,
      filters.locale,
      filters.q,
      filters.type,
      filters.status,
      filters.sort,
      filters.page,
      CONTENT_PAGE_SIZE,
      excludeId ?? null,
    ],
  );
  return rows[0];
}
