update public.data_provenance
set methode_collecte='declaration_client',
    justification_ecart='Données déclarées dans la synthèse Word du client et rapprochées manuellement ; date de valorisation absente, contrôle CIF requis.'
where dossier_id='8e7611b0-3a98-452c-9bf7-c8a44985c48b'
  and source_document_id='4bc403c2-6047-4477-80eb-dfdc8d8d1862'
  and methode_collecte='extraction_document'
  and field_name like 'financial.items[%';
