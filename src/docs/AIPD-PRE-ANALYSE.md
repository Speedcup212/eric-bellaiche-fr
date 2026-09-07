# Pré-analyse AIPD / DPIA — Plateforme patrimoniale

> Document interne. Version initiale : 7 septembre 2026. À faire valider par le référent conformité / conseil juridique avant usage externe.

## 1. Traitement évalué

Collecte, conservation, consultation et exploitation de données nécessaires à l'accompagnement patrimonial : identité, situation familiale/professionnelle, revenus, fiscalité, crédits, patrimoine, objectifs, profil investisseur, préférences de durabilité et documents justificatifs.

## 2. Finalités

- préparation et exécution de la relation de conseil ;
- connaissance client et adéquation des recommandations ;
- constitution et conservation du dossier réglementaire ;
- communication avec le client ;
- sécurité, preuve et traçabilité des opérations.

## 3. Facteurs de risque

- agrégation de nombreuses informations financières et patrimoniales dans un même dossier ;
- présence potentielle de documents d'identité et justificatifs fiscaux ;
- possibilité de préjudice significatif en cas d'accès inter-client ;
- utilisation d'une plateforme en ligne accessible à distance ;
- intervention de plusieurs prestataires techniques.

## 4. Mesures existantes

- MFA obligatoire AAL2 ;
- mots de passe compromis refusés ;
- RLS sur les tables exposées ;
- stockage documentaire privé ;
- cloisonnement inter-client testé ;
- limitation des fonctions privilégiées ;
- HTTPS/TLS ;
- headers de sécurité ;
- journalisation des mutations ;
- scan de secrets sur déploiement ;
- minimisation des données stockées dans les logs.

## 5. Matrice de risques résiduels

| Risque | Gravité | Vraisemblance après mesures | Niveau résiduel | Action |
|---|---|---|---|---|
| Accès d'un client au dossier d'un autre | Élevée | Faible | Modéré | Maintenir crash-tests RLS après chaque évolution majeure |
| Compromission d'un compte cabinet | Élevée | Faible à modérée | Modéré | MFA obligatoire, revue des sessions et habilitations |
| Fuite d'un document via URL ou stockage | Élevée | Faible | Modéré | URL courte, bucket privé, audit des téléchargements à compléter |
| Secret applicatif exposé | Élevée | Faible | Modéré | Variables serveur, scan de secrets, rotation immédiate si incident |
| Suppression/corruption de données | Élevée | Faible à modérée | Modéré | Sauvegardes + test de restauration à formaliser |
| Mauvais destinataire d'un email | Moyenne à élevée | Faible | Faible à modéré | Lier le destinataire aux données enregistrées et ne pas accepter de destinataire arbitraire |
| Accès excessif d'un prestataire | Élevée | À documenter | Modéré | Inventaire des sous-traitants, DPA, habilitations minimales |
| Conservation excessive | Moyenne | Modérée | Modéré | Matrice de conservation et purge planifiée |

## 6. Nécessité d'une AIPD complète

Conclusion provisoire : le traitement mérite une analyse documentée approfondie en raison de la concentration de données financières/patrimoniales et des documents justificatifs. La décision définitive sur l'obligation d'une AIPD complète doit être prise après finalisation de :

1. la volumétrie et le nombre de personnes concernées ;
2. la liste complète des sous-traitants et transferts ;
3. les durées de conservation par catégorie ;
4. les bases légales et obligations réglementaires associées ;
5. la procédure de droits des personnes ;
6. le plan de sauvegarde/restauration et la traçabilité des consultations.

## 7. Validation

À faire valider par le responsable de traitement et, si nécessaire, par le conseil conformité/juridique. Ne pas présenter ce document comme une AIPD CNIL finalisée tant que cette validation n'a pas eu lieu.
