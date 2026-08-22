create or replace function public.create_client_dossier(
  p_reference text,
  p_libelle text,
  p_inv1_prenom text,
  p_inv1_nom text,
  p_inv1_email text,
  p_inv1_mobile text,
  p_inv2_prenom text default null,
  p_inv2_nom text default null,
  p_inv2_email text default null,
  p_inv2_mobile text default null
)
returns jsonb
language plpgsql
set search_path to ''
as $$
begin
  if nullif(trim(coalesce(p_inv2_email,'')), '') is not null
     and lower(trim(p_inv1_email)) = lower(trim(p_inv2_email)) then
    raise exception 'Chaque membre du couple doit disposer de sa propre adresse email afin de conserver des questionnaires individuels et traçables';
  end if;

  return private.create_client_dossier_core(
    p_reference,p_libelle,p_inv1_prenom,p_inv1_nom,p_inv1_email,p_inv1_mobile,
    p_inv2_prenom,p_inv2_nom,p_inv2_email,p_inv2_mobile
  );
end;
$$;
