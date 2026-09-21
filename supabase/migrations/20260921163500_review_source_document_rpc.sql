-- Reliable staff-only review action for analysed source documents.
create or replace function public.review_source_document(
  p_document_id uuid,
  p_decision text,
  p_note text default null,
  p_target_kind text default null,
  p_target_key text default null,
  p_target_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_doc public.documents_sources%rowtype;
  v_status text;
  v_review jsonb;
begin
  if not private.is_staff() then
    raise exception 'Accès réservé au cabinet';
  end if;

  if p_decision not in ('validated','rejected') then
    raise exception 'Décision documentaire invalide';
  end if;

  select * into v_doc
  from public.documents_sources
  where id=p_document_id
  for update;

  if not found then
    raise exception 'Document introuvable';
  end if;

  v_status := case when p_decision='validated' then 'validated' else 'rejected' end;

  v_review := jsonb_build_object(
    'decision',
      case
        when p_decision='rejected' then 'rejected'
        when nullif(trim(coalesce(p_target_kind,'')),'') is not null then 'validated_linked'
        when coalesce((v_doc.metadata->>'fields_applied')::int,0) > 0 then 'validated_after_control'
        else 'validated_without_integration'
      end,
    'note', nullif(trim(coalesce(p_note,'')),''),
    'target',
      case
        when nullif(trim(coalesce(p_target_kind,'')),'') is null then null
        else jsonb_build_object('kind',p_target_kind,'key',p_target_key,'label',p_target_label)
      end,
    'fields_applied', coalesce((v_doc.metadata->>'fields_applied')::int,0),
    'reviewed_at', now(),
    'reviewer_id', auth.uid()
  );

  update public.documents_sources
  set statut_analyse=v_status,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('manual_review',v_review),
      updated_at=now()
  where id=p_document_id;

  return jsonb_build_object(
    'ok',true,
    'document_id',p_document_id,
    'status',v_status,
    'manual_review',v_review
  );
end;
$function$;

revoke all on function public.review_source_document(uuid,text,text,text,text,text) from public;
grant execute on function public.review_source_document(uuid,text,text,text,text,text) to authenticated;
