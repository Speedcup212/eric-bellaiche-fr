revoke execute on function public.get_client_invite_statuses() from public, anon;
grant execute on function public.get_client_invite_statuses() to authenticated;

revoke execute on function public.mark_client_invite_sent(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.mark_client_invite_sent(uuid, uuid, timestamptz, text) to authenticated;

alter function private.esg_score_label(numeric) set search_path = '';
