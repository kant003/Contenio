-- CMS roles never receive login credentials; only server sessions can set tenant context.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='contenio_app') then create role contenio_app nologin; end if;
  execute format('grant contenio_app to %I',current_user);
end $$;
grant usage on schema public to contenio_app;
create function public.current_user_id() returns text language sql stable as $$
  select nullif(current_setting('app.user_id',true),'')
$$;
-- All writes go through guarded RPCs. RLS also protects direct reads.
revoke create on schema public from public;
create table public.platform_admins (user_id text primary key references public."user" on delete cascade);
create table public.spaces (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'), created_at timestamptz not null default now()
);
create table public.memberships (
  space_id uuid references public.spaces on delete cascade, user_id text references public."user" on delete cascade,
  primary key(space_id,user_id)
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_admins where user_id=public.current_user_id())
$$;
create function public.can_access_space(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(select 1 from public.memberships where space_id=s and user_id=public.current_user_id())
$$;
create table public.content_types (
  id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces on delete cascade,
  key text not null check(key ~ '^[a-z][a-z0-9_]{0,63}$'), name text not null check(length(name) between 1 and 100),
  description text not null default '', fields jsonb not null default '[]', created_at timestamptz not null default now(),
  unique(space_id,key), unique(space_id,id)
);
create table public.entries (
  id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces,
  content_type_id uuid not null, shared jsonb not null default '{}',
  translations jsonb not null default '{"es":{},"gl":{}}', version integer not null default 1,
  updated_at timestamptz not null default now(), updated_by text references public."user",
  foreign key(space_id,content_type_id) references public.content_types(space_id,id), unique(space_id,id)
);
create index on public.entries(space_id,updated_at desc);
create table public.assets (
  id uuid primary key, space_id uuid not null references public.spaces, path text not null unique,
  storage_url text, name text not null, mime text not null, size bigint not null check(size between 1 and 10485760),
  description jsonb not null default '{"es":"","gl":""}', alt jsonb not null default '{"es":"","gl":""}',
  created_at timestamptz not null default now(), unique(space_id,id)
);
create table public.entry_links (
  space_id uuid not null, source_id uuid not null, target_id uuid not null,
  primary key(source_id,target_id), foreign key(space_id,source_id) references public.entries(space_id,id) on delete cascade,
  foreign key(space_id,target_id) references public.entries(space_id,id)
);
create table public.asset_links (
  space_id uuid not null, entry_id uuid not null, asset_id uuid not null,
  primary key(entry_id,asset_id), foreign key(space_id,entry_id) references public.entries(space_id,id) on delete cascade,
  foreign key(space_id,asset_id) references public.assets(space_id,id)
);
create table public.publications (
  id uuid primary key default gen_random_uuid(), space_id uuid not null, entry_id uuid not null,
  locale text not null check(locale in ('es','gl')), type_key text not null, slug text,
  fields jsonb not null, published_at timestamptz not null default now(),
  foreign key(space_id,entry_id) references public.entries(space_id,id), unique(space_id,id), unique(entry_id,locale,id)
);
create table public.publication_heads (
  space_id uuid not null, entry_id uuid not null, locale text not null, publication_id uuid not null,
  type_key text not null, slug text, primary key(entry_id,locale), unique(space_id,type_key,locale,slug),
  foreign key(entry_id,locale,publication_id) references public.publications(entry_id,locale,id),
  foreign key(space_id,publication_id) references public.publications(space_id,id)
);
create table public.publication_asset_links (
  space_id uuid not null, publication_id uuid not null, asset_id uuid not null,
  primary key(publication_id,asset_id), foreign key(space_id,publication_id) references public.publications(space_id,id),
  foreign key(space_id,asset_id) references public.assets(space_id,id)
);
create table public.publication_entry_links (
  space_id uuid not null, publication_id uuid not null, target_id uuid not null,
  primary key(publication_id,target_id), foreign key(space_id,publication_id) references public.publications(space_id,id),
  foreign key(space_id,target_id) references public.entries(space_id,id)
);
create table public.api_keys (
  id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces,
  name text not null, prefix text not null, key_hash text not null unique,
  created_at timestamptz not null default now(), revoked_at timestamptz
);
create view public.current_publications with(security_invoker=true) as
  select p.* from public.publication_heads h join public.publications p on p.id=h.publication_id;

alter table public.platform_admins enable row level security;
create policy own_admin on public.platform_admins for select to contenio_app using(user_id=public.current_user_id());
alter table public.spaces enable row level security;
create policy space_read on public.spaces for select to contenio_app using(public.can_access_space(id));
alter table public.memberships enable row level security;
create policy member_read on public.memberships for select to contenio_app using(user_id=public.current_user_id() or public.is_admin());
do $$ declare t text; begin
  foreach t in array array['content_types','entries','assets','entry_links','asset_links','publications','publication_heads','publication_asset_links','publication_entry_links'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy scoped_read on public.%I for select to contenio_app using(public.can_access_space(space_id))',t);
  end loop;
end $$;
alter table public.api_keys enable row level security;
create policy admin_read on public.api_keys for select to contenio_app using(public.is_admin());
revoke all on all tables in schema public from contenio_app;
grant select on public.platform_admins,public.spaces,public.memberships,public.content_types,public.entries,public.assets,
  public.entry_links,public.asset_links,public.publications,public.publication_heads,public.publication_asset_links,
  public.publication_entry_links,public.current_publications to contenio_app;
grant select(id,space_id,name,prefix,created_at,revoked_at) on public.api_keys to contenio_app;


create function public.create_space(p_name text,p_slug text) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  insert into public.spaces(name,slug) values(trim(p_name),p_slug) returning id into sid;
  insert into public.content_types(space_id,key,name,description,fields) values(sid,'page','Página','Páginas de tu sitio web',
    '[{"key":"title","name":"Título","type":"short_text","localized":true,"required":true,"active":true,"help":"Un título claro para identificar la página"},{"key":"slug","name":"Slug","type":"short_text","localized":true,"required":true,"active":true,"help":"Identificador para la URL, por ejemplo: sobre-nosotros"},{"key":"body","name":"Contenido","type":"rich_text","localized":true,"required":true,"active":true,"help":"Escribe el contenido de la página"}]');
  return sid;
end $$;
create function public.set_member(p_space uuid,p_email text,p_remove boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare uid text;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select id into uid from public."user" where lower(email)=lower(trim(p_email));
  if uid is null then raise exception 'Crea primero esta cuenta con db:create-user'; end if;
  if p_remove then delete from public.memberships where space_id=p_space and user_id=uid;
  else insert into public.memberships values(p_space,uid) on conflict do nothing; end if;
end $$;
create function public.list_members(p_space uuid) returns table(user_id text,email text) language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query select u.id,u.email::text from public."user" u join public.memberships m on m.user_id=u.id where m.space_id=p_space;
end $$;

create function public.save_content_type(p_space uuid,p_id uuid,p_key text,p_name text,p_description text,p_fields jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare f jsonb; oldf jsonb; oldtype public.content_types; tid uuid; seen text[] := '{}';
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) not between 1 and 64 then raise exception 'Añade entre 1 y 64 campos'; end if;
  for f in select value from jsonb_array_elements(p_fields) loop
    if coalesce(f->>'key','') !~ '^[a-z][a-z0-9_]{0,63}$' or (f->>'key')=any(seen) or coalesce(length(f->>'name'),0) not between 1 and 100 then raise exception 'Identificador o nombre de campo inválido'; end if;
    if coalesce(f->>'type','') not in ('short_text','long_text','rich_text','number','boolean','date','asset','reference','references') then raise exception 'Tipo de campo inválido'; end if;
    if jsonb_typeof(f->'localized') is distinct from 'boolean' or jsonb_typeof(f->'required') is distinct from 'boolean' or jsonb_typeof(f->'active') is distinct from 'boolean' then raise exception 'Configuración de campo inválida'; end if;
    seen:=array_append(seen,f->>'key');
  end loop;
  if p_id is not null then
    select * into oldtype from public.content_types where id=p_id and space_id=p_space for update;
    if not found then raise exception 'Modelo no encontrado'; end if;
    if exists(select 1 from public.entries where content_type_id=p_id) then
      if p_key<>oldtype.key then raise exception 'El identificador de un modelo utilizado es inmutable'; end if;
      for oldf in select value from jsonb_array_elements(oldtype.fields) loop
        select value into f from jsonb_array_elements(p_fields) where value->>'key'=oldf->>'key';
        if not found or f->>'type'<>oldf->>'type' or f->>'localized'<>oldf->>'localized' then
          raise exception 'No puedes eliminar ni cambiar el tipo o idioma de un campo utilizado; desactívalo';
        end if;
      end loop;
    end if;
    update public.content_types set key=p_key,name=p_name,description=p_description,fields=p_fields where id=p_id returning id into tid;
  else
    insert into public.content_types(space_id,key,name,description,fields) values(p_space,p_key,p_name,p_description,p_fields) returning id into tid;
  end if;
  return tid;
end $$;

-- Validates shape and scalar types even when invoked directly through PostgREST.
create function public.check_values(p_schema jsonb,p_values jsonb,p_localized boolean,p_required boolean default false) returns void language plpgsql set search_path=public as $$
declare f jsonb; v jsonb; k text; typ text; present boolean;
begin
  if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Campos inválidos'; end if;
  for k in select jsonb_object_keys(p_values) loop
    if not exists(select 1 from jsonb_array_elements(p_schema) s where s->>'key'=k and (s->>'localized')::boolean=p_localized) then raise exception 'Campo desconocido: %',k; end if;
  end loop;
  for f in select value from jsonb_array_elements(p_schema) where (value->>'localized')::boolean=p_localized loop
    v:=p_values->(f->>'key'); typ:=f->>'type';
    present:=v is not null and v<>'null'::jsonb and v<>'""'::jsonb and v<>'[]'::jsonb and (jsonb_typeof(v)<>'string' or length(trim(v#>>'{}'))>0);
    if typ='rich_text' then present:=present and (exists(select 1 from jsonb_path_query(v,'$.**.text') x where length(trim(x#>>'{}'))>0) or jsonb_path_exists(v,'$.**.attrs.assetId')); end if;
    if p_required and (f->>'active')::boolean and (f->>'required')::boolean and not present then raise exception 'Completa el campo %', f->>'name'; end if;
    if v is null or v='null'::jsonb or v='""'::jsonb then continue; end if;
    if typ in ('short_text','long_text','date','asset','reference') and jsonb_typeof(v)<>'string' then raise exception 'Valor inválido: %',f->>'name'; end if;
    if typ='short_text' and length(v#>>'{}')>256 then raise exception 'Texto demasiado largo: %',f->>'name'; end if;
    if typ='number' and jsonb_typeof(v)<>'number' then raise exception 'Número inválido'; end if;
    if typ='boolean' and jsonb_typeof(v)<>'boolean' then raise exception 'Booleano inválido'; end if;
    if typ='date' then perform (v#>>'{}')::date; end if;
    if typ='references' and jsonb_typeof(v)<>'array' then raise exception 'Referencias inválidas'; end if;
    if typ='rich_text' and (jsonb_typeof(v)<>'object' or v->>'type' is distinct from 'doc') then raise exception 'Documento inválido'; end if;
    if f->>'key'='slug' and (v#>>'{}') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'El slug solo admite minúsculas, números y guiones'; end if;
  end loop;
end $$;
create function public.collect_references(p_schema jsonb,p_values jsonb) returns table(kind text,target uuid) language plpgsql set search_path=public as $$
declare f jsonb; v jsonb; r jsonb;
begin
  for f in select value from jsonb_array_elements(p_schema) loop
    v:=p_values->(f->>'key');
    if v is null or v='null'::jsonb or v='""'::jsonb then continue; end if;
    if f->>'type' in ('asset','reference') then kind:=case when f->>'type'='asset' then 'asset' else 'entry' end; target:=(v#>>'{}')::uuid; return next;
    elsif f->>'type'='references' then
      for r in select value from jsonb_array_elements(v) loop kind:='entry'; target:=(r#>>'{}')::uuid; return next; end loop;
    elsif f->>'type'='rich_text' then
      for r in select distinct value from jsonb_path_query(v,'$.**.attrs.assetId') value loop
        kind:='asset'; target:=(r#>>'{}')::uuid; return next;
      end loop;
    end if;
  end loop;
end $$;
create function public.save_entry(p_space uuid,p_type uuid,p_id uuid,p_shared jsonb,p_translations jsonb,p_version integer) returns public.entries language plpgsql security definer set search_path=public as $$
declare t public.content_types; e public.entries; vals jsonb; r record; loc text;
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  select * into t from public.content_types where id=p_type and space_id=p_space for share;
  if not found then raise exception 'Modelo no encontrado'; end if;
  if pg_column_size(p_translations)+pg_column_size(p_shared)>2097152 then raise exception 'Contenido demasiado grande'; end if;
  if jsonb_typeof(p_translations) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_translations) k where k not in ('es','gl')) then raise exception 'Idiomas inválidos'; end if;
  perform public.check_values(t.fields,p_shared,false);
  foreach loc in array array['es','gl'] loop perform public.check_values(t.fields,coalesce(p_translations->loc,'{}'),true); end loop;
  if p_id is null then
    insert into public.entries(space_id,content_type_id,shared,translations,updated_by) values(p_space,p_type,p_shared,p_translations,public.current_user_id()) returning * into e;
  else
    update public.entries set shared=p_shared,translations=p_translations,version=version+1,updated_at=now(),updated_by=public.current_user_id()
      where id=p_id and space_id=p_space and content_type_id=p_type and version=p_version returning * into e;
    if not found then raise exception 'CONFLICT: la entrada ha cambiado. Recarga para no sobrescribir otra sesión.'; end if;
  end if;
  delete from public.entry_links where source_id=e.id;
  delete from public.asset_links where entry_id=e.id;
  foreach loc in array array['es','gl'] loop
    vals:=p_shared||coalesce(p_translations->loc,'{}');
    for r in select * from public.collect_references(t.fields,vals) loop
      if r.kind='asset' then
        perform 1 from public.assets where id=r.target and space_id=p_space for share;
        if not found then raise exception 'Archivo no encontrado en este espacio'; end if;
        insert into public.asset_links values(p_space,e.id,r.target) on conflict do nothing;
      else
        perform 1 from public.entries where id=r.target and space_id=p_space for share;
        if not found then raise exception 'Entrada relacionada no encontrada en este espacio'; end if;
        insert into public.entry_links values(p_space,e.id,r.target) on conflict do nothing;
      end if;
    end loop;
  end loop;
  return e;
end $$;
create function public.publish_entry(p_space uuid,p_id uuid,p_locale text,p_version integer) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.entries; t public.content_types; vals jsonb; pid uuid; r record;
begin
  if not public.can_access_space(p_space) or p_locale not in ('es','gl') then raise exception 'No autorizado o idioma inválido'; end if;
  select * into e from public.entries where id=p_id and space_id=p_space for update;
  if not found or p_version is null or e.version<>p_version then raise exception 'CONFLICT: guarda y recarga antes de publicar'; end if;
  select * into t from public.content_types where id=e.content_type_id for share;
  perform public.check_values(t.fields,e.shared,false,true);
  perform public.check_values(t.fields,coalesce(e.translations->p_locale,'{}'),true,true);
  vals:=e.shared||coalesce(e.translations->p_locale,'{}');
  -- Inactive fields remain in drafts but are never delivered in new publications.
  select coalesce(jsonb_object_agg(s->>'key',vals->(s->>'key')),'{}') into vals
    from jsonb_array_elements(t.fields) s where (s->>'active')::boolean and vals ? (s->>'key');
  insert into public.publications(space_id,entry_id,locale,type_key,slug,fields) values(p_space,p_id,p_locale,t.key,nullif(vals->>'slug',''),vals) returning id into pid;
  for r in select * from public.collect_references(t.fields,vals) loop
    if r.kind='asset' then insert into public.publication_asset_links values(p_space,pid,r.target) on conflict do nothing;
    else insert into public.publication_entry_links values(p_space,pid,r.target) on conflict do nothing; end if;
  end loop;
  insert into public.publication_heads(space_id,entry_id,locale,publication_id,type_key,slug) values(p_space,p_id,p_locale,pid,t.key,nullif(vals->>'slug',''))
    on conflict(entry_id,locale) do update set publication_id=excluded.publication_id,slug=excluded.slug;
  return pid;
end $$;
create function public.unpublish_entry(p_space uuid,p_id uuid,p_locale text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  delete from public.publication_heads where space_id=p_space and entry_id=p_id and locale=p_locale;
end $$;
create function public.delete_entry(p_space uuid,p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  perform 1 from public.entries where id=p_id and space_id=p_space for update;
  if not found then raise exception 'Entrada no encontrada'; end if;
  if exists(select 1 from public.publications where entry_id=p_id) then raise exception 'Conservamos esta entrada porque tiene historial publicado'; end if;
  if exists(select 1 from public.entry_links where target_id=p_id and source_id<>p_id) or exists(select 1 from public.publication_entry_links where target_id=p_id) then raise exception 'Esta entrada se utiliza en otro contenido'; end if;
  delete from public.entry_links where source_id=p_id;
  delete from public.entries where id=p_id and space_id=p_space;
end $$;

create function public.register_asset(p_space uuid,p_id uuid,p_name text,p_mime text,p_size bigint,p_storage_url text default null) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  if p_mime not in ('image/jpeg','image/png','image/webp','image/avif','application/pdf') then raise exception 'Formato no permitido'; end if;
  insert into public.assets(id,space_id,path,name,mime,size,storage_url) values(p_id,p_space,p_space::text||'/'||p_id::text,p_name,p_mime,p_size,p_storage_url);
end $$;
create function public.update_asset(p_space uuid,p_id uuid,p_name text,p_alt jsonb,p_description jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_alt) is distinct from 'object' or jsonb_typeof(p_description) is distinct from 'object' then raise exception 'Metadatos inválidos'; end if;
  update public.assets set name=p_name,alt=p_alt,description=p_description where id=p_id and space_id=p_space;
end $$;
create function public.delete_asset(p_space uuid,p_id uuid) returns text language plpgsql security definer set search_path=public as $$
declare result text;
begin
  if not public.can_access_space(p_space) then raise exception 'No autorizado'; end if;
  perform 1 from public.assets where id=p_id and space_id=p_space for update;
  if not found then raise exception 'Archivo no encontrado'; end if;
  if exists(select 1 from public.asset_links where asset_id=p_id) or exists(select 1 from public.publication_asset_links where asset_id=p_id) then raise exception 'El archivo se utiliza en un borrador o una publicación histórica'; end if;
  delete from public.assets where id=p_id and space_id=p_space returning path into result;
  return result;
end $$;
create function public.create_read_key(p_space uuid,p_name text,p_prefix text,p_hash text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Hash inválido'; end if;
  insert into public.api_keys(space_id,name,prefix,key_hash) values(p_space,p_name,p_prefix,p_hash);
end $$;
create function public.revoke_read_key(p_space uuid,p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.api_keys set revoked_at=now() where id=p_id and space_id=p_space;
end $$;
-- SECURITY DEFINER is never exposed anonymously. Internal validators have no public execution grant.
revoke execute on all functions in schema public from public,contenio_app;
grant execute on function public.current_user_id(),public.is_admin(),public.can_access_space(uuid),public.create_space(text,text),public.set_member(uuid,text,boolean),public.list_members(uuid),
  public.save_content_type(uuid,uuid,text,text,text,jsonb),public.save_entry(uuid,uuid,uuid,jsonb,jsonb,integer),
  public.publish_entry(uuid,uuid,text,integer),public.unpublish_entry(uuid,uuid,text),public.delete_entry(uuid,uuid),
  public.register_asset(uuid,uuid,text,text,bigint,text),public.update_asset(uuid,uuid,text,jsonb,jsonb),public.delete_asset(uuid,uuid),
  public.create_read_key(uuid,text,text,text),public.revoke_read_key(uuid,uuid) to contenio_app;
-- Server-only delivery lookup checks current heads, never historical publication access.
create function public.delivery_asset(p_space uuid,p_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select to_jsonb(a) from public.assets a where a.id=p_id and a.space_id=p_space and exists(
    select 1 from public.publication_asset_links l join public.publication_heads h on h.publication_id=l.publication_id
      where l.asset_id=a.id and l.space_id=p_space and h.space_id=p_space
  )
$$;
revoke all on function public.delivery_asset(uuid,uuid) from public,contenio_app;

