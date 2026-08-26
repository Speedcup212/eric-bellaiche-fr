drop trigger if exists trg_validate_completed_recueil_section on public.recueil_sections;

create trigger trg_validate_completed_recueil_section
before insert or update of payload, completed_at on public.recueil_sections
for each row
when (new.section_code <> 'credits')
execute function private.validate_completed_recueil_section();
