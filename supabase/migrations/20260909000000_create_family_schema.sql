-- Family data is reachable only through the server. Auth and Storage remain
-- Supabase-managed; bucket provisioning uses scripts/setup-supabase.mjs.
create table public.trees (
  id uuid primary key default gen_random_uuid(),
  organizer_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (name !~ '^[[:space:]]*$'),
  created_at timestamptz not null default now()
);
create index trees_organizer_idx on public.trees (organizer_user_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  first_name text not null check (first_name !~ '^[[:space:]]*$'),
  last_name text not null check (last_name !~ '^[[:space:]]*$'),
  life_status text not null check (life_status in ('living', 'deceased', 'unknown')),
  birth_year integer,
  death_year integer,
  adopted boolean not null default false,
  main_photo_id uuid,
  fun_facts text[] not null default '{}',
  parents_complete boolean not null default false,
  partners_complete boolean not null default false,
  children_complete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tree_id, id),
  constraint people_death_before_birth check (death_year >= birth_year),
  constraint people_living_death check (life_status <> 'living' or death_year is null),
  constraint people_fun_facts check (
    cardinality(fun_facts) = 0 or (
      array_ndims(fun_facts) = 1 and array_lower(fun_facts, 1) = 1
      and cardinality(fun_facts) <= 3
      and array_position(fun_facts, null) is null
      and fun_facts[1] !~ '^[[:space:]]*$'
      and (cardinality(fun_facts) < 2 or fun_facts[2] !~ '^[[:space:]]*$')
      and (cardinality(fun_facts) < 3 or fun_facts[3] !~ '^[[:space:]]*$')
    )
  )
);

-- A clock-dependent check belongs in a write trigger, not an immutable CHECK.
create function public.check_person_death_year() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.death_year > extract(year from current_timestamp at time zone 'UTC') then
    raise exception 'Death year cannot be in the future'
      using errcode = '23514', constraint = 'people_future_death';
  end if;
  return new;
end;
$$;
revoke all on function public.check_person_death_year() from public, anon, authenticated;
create trigger people_check_death_year before insert or update on public.people
for each row execute function public.check_person_death_year();

create table public.parent_child (
  tree_id uuid not null references public.trees(id) on delete cascade,
  parent_id uuid not null,
  child_id uuid not null,
  primary key (tree_id, parent_id, child_id),
  constraint parent_child_no_self check (parent_id <> child_id),
  foreign key (tree_id, parent_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, child_id) references public.people(tree_id, id) on delete cascade
);
create index parent_child_child_idx on public.parent_child (tree_id, child_id);

create table public.partnerships (
  tree_id uuid not null references public.trees(id) on delete cascade,
  person1_id uuid not null,
  person2_id uuid not null,
  primary key (tree_id, person1_id, person2_id),
  -- Writers sort UUIDs before inserting; reversed pairs and self-pairs fail.
  constraint partnerships_canonical_pair check (person1_id < person2_id),
  foreign key (tree_id, person1_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, person2_id) references public.people(tree_id, id) on delete cascade
);
create index partnerships_person2_idx on public.partnerships (tree_id, person2_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  person_id uuid not null,
  storage_path text not null unique,
  age_bucket text not null check (age_bucket in (
    'baby_toddler', 'kid', 'adolescent', '20s', '30s', '40s',
    '50s', '60s', '70s', '80s', '90s_plus'
  )),
  created_at timestamptz not null default now(),
  unique (tree_id, person_id, id),
  foreign key (tree_id, person_id) references public.people(tree_id, id) on delete cascade,
  constraint photos_storage_path check (
    storage_path = 'trees/' || tree_id::text || '/people/' || person_id::text || '/' || id::text || '.jpg'
  )
);

-- Deleting a portrait clears only its reference, retaining the person/tree IDs.
alter table public.people add constraint people_main_photo_owner
  foreign key (tree_id, id, main_photo_id)
  references public.photos(tree_id, person_id, id)
  on delete set null (main_photo_id);
create index people_main_photo_idx on public.people (tree_id, id, main_photo_id)
  where main_photo_id is not null;

alter table public.trees enable row level security;
alter table public.people enable row level security;
alter table public.parent_child enable row level security;
alter table public.partnerships enable row level security;
alter table public.photos enable row level security;

-- Supabase's default grants must not expose these tables through PostgREST.
-- No RLS policies: even accidental browser grants remain default-deny.
revoke all on public.trees, public.people, public.parent_child,
  public.partnerships, public.photos from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.trees, public.people,
  public.parent_child, public.partnerships, public.photos to service_role;

-- Future migrations by this owner must opt in to privileges explicitly.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- No sharing token or hash is stored on trees. Commit 10 will own a separate
-- private hash store. No derived siblings or layout data is persisted here.
