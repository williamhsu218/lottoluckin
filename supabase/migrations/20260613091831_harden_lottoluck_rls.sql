-- Harden lottoluck tables for browser clients.
-- Apply together with the app version that uses Supabase Auth.

alter table public.draw_history
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists draw_history_user_created_idx
  on public.draw_history (user_id, created_at desc);

alter table public.draw_history enable row level security;

drop policy if exists "draw_history_select_own" on public.draw_history;
drop policy if exists "draw_history_insert_own" on public.draw_history;
drop policy if exists "draw_history_update_own" on public.draw_history;
drop policy if exists "draw_history_delete_own" on public.draw_history;

create policy "draw_history_select_own"
  on public.draw_history
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "draw_history_insert_own"
  on public.draw_history
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "draw_history_update_own"
  on public.draw_history
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "draw_history_delete_own"
  on public.draw_history
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.draw_history from anon;
revoke all on table public.draw_history from authenticated;
grant select, insert, update, delete on table public.draw_history to authenticated;

alter table public.official_draws enable row level security;

drop policy if exists "Enable insert/upsert for all users" on public.official_draws;
drop policy if exists "Enable read access for all users" on public.official_draws;
drop policy if exists "official_draws_public_read" on public.official_draws;

create policy "official_draws_public_read"
  on public.official_draws
  for select
  to anon, authenticated
  using (true);

revoke all on table public.official_draws from anon;
revoke all on table public.official_draws from authenticated;
grant select on table public.official_draws to anon, authenticated;
