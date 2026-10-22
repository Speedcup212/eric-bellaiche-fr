-- A secondary investor confirms household credit data sourced from investor 1.
-- Do not require a duplicate credits row owned by investor 2 during validation.
CREATE OR REPLACE FUNCTION private.require_credit_recueil_before_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_primary_investisseur_id uuid;
BEGIN
  IF new.recueil_status = 'validated'
     AND old.recueil_status IS DISTINCT FROM 'validated' THEN
    IF new.role_dossier = 'investisseur_2' THEN
      SELECT di.investisseur_id
        INTO v_primary_investisseur_id
      FROM public.dossier_investisseurs di
      WHERE di.dossier_id = new.dossier_id
        AND di.role_dossier = 'investisseur_1'
      LIMIT 1;

      IF v_primary_investisseur_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.recueil_sections rs
        JOIN public.household_section_confirmations hc
          ON hc.dossier_id = rs.dossier_id
         AND hc.source_investisseur_id = rs.investisseur_id
         AND hc.section_code = rs.section_code
        WHERE rs.dossier_id = new.dossier_id
          AND rs.investisseur_id = v_primary_investisseur_id
          AND rs.section_code = 'credits'
          AND rs.completed_at IS NOT NULL
          AND hc.confirmer_investisseur_id = new.investisseur_id
          AND hc.status = 'confirmed'
          AND hc.source_updated_at >= rs.updated_at
      ) THEN
        RAISE EXCEPTION 'Confirmez les crédits du foyer avant de valider le recueil.';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.recueil_sections rs
      WHERE rs.dossier_id = new.dossier_id
        AND rs.investisseur_id = new.investisseur_id
        AND rs.section_code = 'credits'
        AND rs.completed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Recueil incomplet : terminez la section Crédits.';
    END IF;
  END IF;

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION private.require_credit_recueil_before_validation() FROM public, anon, authenticated;
