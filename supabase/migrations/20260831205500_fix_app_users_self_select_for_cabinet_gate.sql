drop policy if exists app_users_self_select on public.app_users;

create policy app_users_self_select
on public.app_users
for select
to authenticated
using ((select auth.uid()) = auth_user_id);
