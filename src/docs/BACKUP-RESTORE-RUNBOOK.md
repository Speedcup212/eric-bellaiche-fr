# Sauvegarde, restauration, RPO/RTO — Runbook interne

> Version initiale : 7 septembre 2026. Document interne.

## État vérifié

- Le projet Supabase est sur un plan Pro.
- Supabase fournit automatiquement des sauvegardes quotidiennes de base de données sur les projets Pro, avec 7 jours de rétention selon la documentation officielle en vigueur.
- Les sauvegardes de base de données Supabase ne couvrent pas les objets Storage. Les fichiers des buckets doivent donc être traités séparément dans le plan de continuité.
- Le projet utilise deux buckets privés identifiés : `client-source-docs` et `regulatory-docs`.

## Objectifs internes

- **RPO cible base de données : 24 h** avec sauvegardes quotidiennes.
- **RTO cible : 8 h** pour remettre une version fonctionnelle minimale du service.
- **RPO cible Storage : à démontrer** ; tant qu'aucun mécanisme de copie/restauration des objets n'est testé, ne pas annoncer de RPO Storage.

Ces valeurs sont des objectifs internes, pas un SLA contractuel.

## Amélioration optionnelle

Si le cabinet souhaite un RPO base inférieur à 24 h, activer le Point-in-Time Recovery (PITR) Supabase. Cette option est facturée en supplément et nécessite une configuration compatible. Elle n'est pas nécessaire pour atteindre l'objectif actuel de 24 h.

## Test de restauration trimestriel

Le test doit être effectué vers un environnement isolé, jamais en écrasant directement la production.

### Base de données

1. Ouvrir Database > Backups dans le projet Supabase.
2. Sélectionner une sauvegarde quotidienne récente.
3. Utiliser la restauration vers un **nouveau projet** lorsque l'option est disponible.
4. Noter l'heure de début.
5. Attendre la fin de la restauration.
6. Vérifier par échantillonnage :
   - tables principales présentes ;
   - comptes et associations dossier/investisseur cohérents ;
   - RLS toujours active ;
   - fonctions et migrations attendues ;
   - nombre de dossiers / investisseurs / documents_sources cohérent ;
   - aucun accès public non prévu.
7. Noter l'heure de fin.
8. Calculer le **RTO observé**.
9. Comparer l'heure du point restauré au dernier état attendu et calculer le **RPO observé**.
10. Détruire l'environnement temporaire après validation et conservation de la preuve de test.

### Storage

1. Inventorier le nombre d'objets et la taille des buckets privés.
2. Vérifier l'existence d'une copie/restauration indépendante des objets.
3. Restaurer un échantillon dans un bucket isolé.
4. Vérifier nom, taille, type MIME et lisibilité.
5. Tester qu'un client A ne peut pas lire l'objet restauré d'un client B.
6. Documenter le résultat.

## Fiche de preuve de test

- Date :
- Responsable :
- Sauvegarde utilisée :
- Point de restauration :
- Début :
- Fin :
- RPO observé :
- RTO observé :
- Base : PASS / FAIL
- Storage : PASS / FAIL
- RLS après restauration : PASS / FAIL
- Écarts :
- Actions correctives :
- Prochaine date de test :

## Statut actuel

- Sauvegarde quotidienne DB : **prévue automatiquement par le plan Pro**.
- Procédure de restauration : **documentée**.
- Test de restauration isolé : **non encore exécuté**.
- Preuve RPO/RTO réelle : **non encore disponible**.
- Restauration Storage : **à mettre en place et tester**.
