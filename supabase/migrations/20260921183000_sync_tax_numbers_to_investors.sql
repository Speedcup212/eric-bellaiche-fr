
create or replace function public.sync_tax_numbers_to_investors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num_1 text;
  v_num_2 text;
  v_inv_1 uuid;
  v_inv_2 uuid;
begin
  if new.section_code <> 'tax' then
    return new;
  end if;

  v_num_1 := nullif(btrim(new.payload ->> 'numero_fiscal_identifiant_1'), '');
  v_num_2 := nullif(btrim(new.payload ->> 'numero_fiscal_identifiant_2'), '');

  select investisseur_id into v_inv_1
  from public.dossier_investisseurs
  where dossier_id = new.dossier_id and role_dossier = 'investisseur_1'
  limit 1;

  select investisseur_id into v_inv_2
  from public.dossier_investisseurs
  where dossier_id = new.dossier_id and role_dossier = 'investisseur_2'
  limit 1;

  if v_inv_1 is not null and v_num_1 is not null then
    update public.investisseurs
      set numero_fiscal = v_num_1
      where id = v_inv_1
        and numero_fiscal is distinct from v_num_1;

    update public.recueil_sections
      set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{numero_fiscal}', to_jsonb(v_num_1), true),
          updated_at = now()
      where dossier_id = new.dossier_id
        and investisseur_id = v_inv_1
        and section_code = 'identity'
        and coalesce(payload ->> 'numero_fiscal', '') is distinct from v_num_1;
  end if;

  if v_inv_2 is not null and v_num_2 is not null then
    update public.investisseurs
      set numero_fiscal = v_num_2
      where id = v_inv_2
        and numero_fiscal is distinct from v_num_2;

    update public.recueil_sections
      set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{numero_fiscal}', to_jsonb(v_num_2), true),
          updated_at = now()
      where dossier_id = new.dossier_id
        and investisseur_id = v_inv_2
        and section_code = 'identity'
        and coalesce(payload ->> 'numero_fiscal', '') is distinct from v_num_2;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_tax_numbers_to_investors on public.recueil_sections;
create trigger trg_sync_tax_numbers_to_investors
after insert or update of payload on public.recueil_sections
for each row
when (new.section_code = 'tax')
execute function public.sync_tax_numbers_to_investors();

with tax_sources as (
  select distinct on (rs.dossier_id)
    rs.dossier_id,
    nullif(btrim(rs.payload ->> 'numero_fiscal_identifiant_1'), '') as numero_1,
    nullif(btrim(rs.payload ->> 'numero_fiscal_identifiant_2'), '') as numero_2
  from public.recueil_sections rs
  where rs.section_code = 'tax'
  order by rs.dossier_id, rs.updated_at desc nulls last
),
mapped as (
  select ts.dossier_id, di.investisseur_id, di.role_dossier,
         case di.role_dossier
           when 'investisseur_1' then ts.numero_1
           when 'investisseur_2' then ts.numero_2
         end as numero_fiscal
  from tax_sources ts
  join public.dossier_investisseurs di on di.dossier_id = ts.dossier_id
  where di.role_dossier in ('investisseur_1','investisseur_2')
)
update public.investisseurs i
set numero_fiscal = m.numero_fiscal
from mapped m
where i.id = m.investisseur_id
  and m.numero_fiscal is not null
  and i.numero_fiscal is distinct from m.numero_fiscal;

with tax_sources as (
  select distinct on (rs.dossier_id)
    rs.dossier_id,
    nullif(btrim(rs.payload ->> 'numero_fiscal_identifiant_1'), '') as numero_1,
    nullif(btrim(rs.payload ->> 'numero_fiscal_identifiant_2'), '') as numero_2
  from public.recueil_sections rs
  where rs.section_code = 'tax'
  order by rs.dossier_id, rs.updated_at desc nulls last
),
mapped as (
  select ts.dossier_id, di.investisseur_id,
         case di.role_dossier
           when 'investisseur_1' then ts.numero_1
           when 'investisseur_2' then ts.numero_2
         end as numero_fiscal
  from tax_sources ts
  join public.dossier_investisseurs di on di.dossier_id = ts.dossier_id
  where di.role_dossier in ('investisseur_1','investisseur_2')
)
update public.recueil_sections rs
set payload = jsonb_set(coalesce(rs.payload, '{}'::jsonb), '{numero_fiscal}', to_jsonb(m.numero_fiscal), true),
    updated_at = now()
from mapped m
where rs.dossier_id = m.dossier_id
  and rs.investisseur_id = m.investisseur_id
  and rs.section_code = 'identity'
  and m.numero_fiscal is not null
  and coalesce(rs.payload ->> 'numero_fiscal', '') is distinct from m.numero_fiscal;
