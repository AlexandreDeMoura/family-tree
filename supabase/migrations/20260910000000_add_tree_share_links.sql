-- Store only a one-way digest of each tree's active viewer bearer token.
create table public.tree_share_links (
  tree_id uuid primary key references public.trees(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.tree_share_links enable row level security;
revoke all on public.tree_share_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.tree_share_links to service_role;

