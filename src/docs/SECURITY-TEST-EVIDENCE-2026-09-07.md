# Preuves de vérification sécurité — 7 septembre 2026

## Objet

Ce document consigne les contrôles techniques exécutés sur la plateforme Cabinet CGP. Il ne constitue pas un audit indépendant ni une certification.

## Contrôles confirmés

### Cloisonnement des dossiers
- Les tables publiques exposées sont protégées par RLS.
- Des tests croisés entre comptes clients distincts ont confirmé l'absence de visibilité du dossier et des documents d'un autre client.
- Les appels RPC tentant de cibler un dossier étranger sont refusés.

### MFA / AAL2
- Les helpers d'accès aux données exigent un niveau AAL2.
- Test direct : avec une session simulée en AAL1, l'accès cabinet ne donne aucun dossier.
- Test direct : la fonction de journalisation des accès documentaires refuse AAL1 avec le message « MFA requis ».

### Documents privés
- Les buckets client-source-docs et regulatory-docs sont privés.
- Les URL de consultation sont des URL signées à durée courte.
- Les tentatives de chemin malformé / traversal testées sont rejetées.

### Journalisation des accès documentaires
- La génération d'une URL signée sur les buckets privés appelle `log_document_access_event`.
- La fonction exige une session AAL2 et vérifie l'accès au dossier.
- Test positif AAL2 : insertion d'un événement `document_open` confirmée.
- Test négatif AAL1 : refus avec « MFA requis ».
- Le journal conserve le bucket et un SHA-256 du chemin objet, pas le chemin brut ni le nom du fichier.

### Journalisation des mutations
- 22 tables sensibles sont couvertes par le trigger central de journalisation des INSERT/UPDATE/DELETE.
- Les triggers sont versionnés dans l'historique de migrations Supabase.

### Authentification
- MFA obligatoire dans les parcours client et cabinet.
- Protection contre les mots de passe compromis activée.
- Longueur minimale : 10 caractères.
- Secure password change activé.

### Calendly / fonctions privilégiées
- Les RPC Calendly privilégiées ne sont exécutables ni par `anon`, ni par un client authentifié.
- Le flux public passe par une passerelle serveur.

### Déploiement
- Les headers de sécurité sont actifs sur Netlify.
- Les zones cabinet et espace client sont servies avec `Cache-Control: no-store`.
- Le scan Netlify du déploiement de référence n'a détecté aucun secret.

## Sauvegarde et restauration

### État vérifié
- Le projet est sur un plan Supabase payant.
- Supabase indique que les projets Pro disposent de sauvegardes quotidiennes avec 7 jours de rétention.
- Les sauvegardes de base de données ne couvrent pas les objets Storage ; seule leur métadonnée se trouve dans PostgreSQL.

### RPO / RTO cibles internes
- RPO base de données : 24 heures au maximum en mode sauvegarde quotidienne.
- RTO cible interne : 8 heures.

### Test de restauration
Non encore exécuté. Le test attendu est une restauration vers un nouveau projet isolé, jamais une restauration destructive sur la production. Le temps de restauration et les contrôles post-restauration devront être consignés pour constituer la preuve RTO/RPO.

## Limites explicites
- Aucun pentest externe indépendant réalisé à cette date.
- La journalisation applicative prouve les demandes d'accès via l'application ; elle ne constitue pas une journalisation universelle de chaque octet effectivement téléchargé par un navigateur après émission d'une URL signée.
- Les fichiers Storage nécessitent une stratégie de sauvegarde séparée si une protection contre leur suppression doit être démontrée.

## Conclusion
L'état actuel fournit des preuves techniques reproductibles sur le cloisonnement, le MFA, les accès documentaires, les mutations sensibles et le durcissement de l'authentification. Les deux chantiers restant pour augmenter le niveau de preuve sont le test de restauration isolé et le pentest externe indépendant.
