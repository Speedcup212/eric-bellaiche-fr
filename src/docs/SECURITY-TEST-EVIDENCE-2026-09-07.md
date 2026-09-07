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

### Sauvegarde base de données
- Le projet est sur un plan Supabase payant.
- Les sauvegardes quotidiennes Supabase sont actives et visibles dans le Dashboard.
- La restauration du backup du 7 septembre 2026 vers un nouveau projet isolé `Cabinet-CGP-PRA-TEST` a été exécutée avec succès.
- Le projet restauré a atteint l'état `ACTIVE_HEALTHY`.
- Contrôle post-restauration : 56 tables publiques, 56/56 avec RLS, 5 utilisateurs Auth, 122 policies publiques, 2 buckets et 18 entrées d'objets Storage restaurées dans les métadonnées PostgreSQL.
- La restauration correspond correctement au point de sauvegarde : elle ne contient pas les migrations de durcissement réalisées plus tard dans la journée du 7 septembre, ce qui confirme le retour à l'état temporel du backup et non à l'état courant de production.

### Sauvegarde Storage
- Les sauvegardes de base de données Supabase ne restaurent pas les octets des objets Storage ; une sauvegarde indépendante est donc maintenue.
- Sauvegarde automatique quotidienne des buckets privés vers Google Drive via l'API S3 compatible Supabase.
- Tâche Windows `CabinetCGP-Sauvegarde-Supabase` validée avec un résultat d'exécution 0.
- Snapshot vérifié : 6 objets `client-source-docs` + 12 objets `regulatory-docs`, soit 18 fichiers.
- Contrôle distant/local et manifeste SHA-256 générés à chaque snapshot.
- Test de restauration local isolé exécuté : 6/6 + 12/12 fichiers restaurés, 18/18 empreintes SHA-256 validées, résultat `PASS`.
- Aucune écriture de test n'a été effectuée vers le projet de production.

### Portée du test PRA
Le plan de reprise a été testé sur ses deux composants de sauvegarde :
1. restauration de la base/Auth vers un nouveau projet Supabase isolé ;
2. restauration des objets Storage depuis la sauvegarde externe avec vérification cryptographique.

La réinjection physique des 18 objets dans un projet Supabase de test n'a pas été exécutée dans ce test. Les métadonnées Storage ont bien été restaurées avec la base, et les octets des 18 objets ont été restaurés et vérifiés séparément. Cette limite doit être conservée dans toute communication de preuve.

### RPO / RTO cibles internes
- RPO base de données : 24 heures au maximum en mode sauvegarde quotidienne.
- RTO cible interne : 8 heures.
- Le test démontre la restaurabilité des sauvegardes, mais ne constitue pas encore une mesure formelle d'un RTO complet de remise en service applicative, car les réglages Auth, API keys, Edge Functions, paramètres Storage et le redéploiement applicatif doivent être reconfigurés hors restauration de base.

## Limites explicites
- Aucun pentest externe indépendant réalisé à cette date.
- La journalisation applicative prouve les demandes d'accès via l'application ; elle ne constitue pas une journalisation universelle de chaque octet effectivement téléchargé par un navigateur après émission d'une URL signée.
- La réinjection physique des objets Storage dans un projet Supabase restauré n'a pas encore été testée de bout en bout.
- Les paramètres hors base — notamment Edge Functions, réglages Auth, API keys et certaines configurations de projet — nécessitent une reconfiguration lors d'un sinistre complet.

## Conclusion
Les contrôles techniques reproductibles couvrent désormais le cloisonnement, le MFA, les accès documentaires, les mutations sensibles, le durcissement de l'authentification, la sauvegarde automatique du Storage et la restauration isolée de la base et des fichiers. Le principal chantier externe restant pour augmenter le niveau de preuve est un pentest indépendant. La restauration applicative complète, incluant la réinjection physique des objets Storage et la reconfiguration des services hors base, reste un exercice PRA de niveau supérieur à programmer périodiquement.
