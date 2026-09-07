# Gouvernance sécurité & RGPD — Cabinet Eric Bellaiche

> Document interne de travail. Version initiale : 7 septembre 2026.
> Ce document formalise l'état actuel connu de la plateforme et les règles de fonctionnement à respecter. Il ne constitue pas une certification de conformité ni un audit externe indépendant.

## 1. Périmètre

Plateforme client et cabinet accessible via eric-bellaiche.fr, incluant notamment : recueil d'informations, profil investisseur, préférences de durabilité, objectifs, fiscalité, crédits, patrimoine, documents sources et documents réglementaires.

## 2. Données traitées

Catégories principales : identité, coordonnées, situation familiale, situation professionnelle, revenus et capacité d'épargne, patrimoine immobilier et financier, crédits, fiscalité, objectifs patrimoniaux, réponses au profil investisseur, préférences ESG, documents justificatifs et traces techniques de sécurité.

Les données patrimoniales/fiscales ne doivent pas être copiées dans les journaux techniques sauf nécessité exceptionnelle documentée.

## 3. Architecture et sous-traitants techniques identifiés

### Supabase
- PostgreSQL / Auth / Storage.
- Projet principal hébergé dans la région eu-west-3 (Paris) pour la base principale.
- RLS activée sur les tables exposées ; contrôle d'accès basé sur auth.uid(), appartenance au dossier et rôle.
- MFA obligatoire pour l'accès aux données client/cabinet via AAL2.
- Leaked Password Protection activée.

### Netlify
- Hébergement/déploiement du frontend et fonctions serveur.
- Les fonctions Netlify observées s'exécutent actuellement dans une région US (`us-east-2`). Ce point doit être intégré à la cartographie des transferts/sous-traitants et ne doit pas être présenté comme un traitement exclusivement en France.

### Google / Gmail
- Utilisé pour l'envoi de certains emails via fonctions serveur.
- Les identifiants sont stockés en variables d'environnement serveur, jamais dans le frontend.

### Calendly
- Utilisé pour la prise de rendez-vous et la synchronisation de prospects.
- Les opérations sensibles passent par une passerelle serveur avant appel des fonctions privilégiées de base.

Autres prestataires à recenser formellement selon leur implication réelle : Zoom, Youtrust/YouSign, outils de mesure/analytics, éventuels partenaires métier.

## 4. Mesures de sécurité actuellement en place

- MFA obligatoire avant accès aux données sensibles.
- Mot de passe minimum 10 caractères.
- Refus des mots de passe connus comme compromis.
- RLS sur les tables publiques exposées.
- Buckets de documents privés.
- Cloisonnement inter-clients testé dans les deux sens.
- Refus des écritures sur dossier étranger et des modifications non autorisées.
- Journalisation des mutations sur tables sensibles.
- Révocation des RPC Calendly privilégiées pour `anon` et `authenticated` lorsqu'elles sont réservées au serveur.
- HSTS, `nosniff`, protection anti-framing, politiques de referrer/permissions et `no-store` sur les zones cabinet/client.
- Scan de secrets Netlify sans détection sur le dernier déploiement validé.

## 5. Gestion des habilitations

Principe du moindre privilège :
- un client ne doit voir et modifier que son propre dossier dans les limites du parcours ;
- un compte cabinet actif (`cif` ou `admin`) nécessite AAL2 ;
- les fonctions réservées au serveur ne sont pas exposées aux rôles navigateur ;
- toute création/modification de rôle doit être réservée au cabinet/serveur et auditée.

À chaque départ de collaborateur/prestataire : désactiver le compte, révoquer les accès externes, faire tourner les secrets concernés et documenter l'opération.

## 6. Conservation — politique provisoire à valider juridiquement

Objectif : ne pas conserver les données plus longtemps que nécessaire à la finalité et aux obligations professionnelles/légales applicables.

Règles de travail :
- prospects sans relation : suppression ou anonymisation après une durée courte à définir (cible interne : 12 mois maximum, sauf consentement marketing ou obligation distincte) ;
- invitations expirées : purge régulière des jetons/anciennes invitations après expiration et délai technique raisonnable ;
- journaux de sécurité : conservation cible 12 à 24 mois selon criticité ;
- dossiers clients : conservation selon les obligations réglementaires et probatoires applicables au cabinet, à valider avec le conseil conformité/juridique ;
- documents téléchargés par erreur ou sans finalité : suppression dès détection.

Aucune durée ci-dessus ne doit être publiée comme obligation légale définitive sans validation conformité/juridique.

## 7. Droits des personnes

Canal de traitement à formaliser : demande d'accès, rectification, effacement, limitation, opposition et portabilité lorsque applicable.

Procédure interne :
1. vérifier l'identité du demandeur de façon proportionnée ;
2. enregistrer la demande et la date de réception ;
3. identifier les systèmes concernés ;
4. exécuter l'action autorisée ;
5. conserver la preuve de traitement sans conserver inutilement le contenu de la demande ;
6. répondre dans les délais applicables.

## 8. Gestion des incidents et violations de données

### Déclencheurs
Accès inter-client, compte compromis, fuite de document, secret exposé, téléchargement massif inhabituel, suppression/destruction non autorisée, erreur d'envoi contenant des données personnelles.

### Procédure
1. contenir immédiatement l'incident ;
2. préserver les preuves utiles ;
3. identifier données, personnes, durée et cause ;
4. révoquer sessions/secrets si nécessaire ;
5. corriger et retester ;
6. évaluer le risque pour les personnes ;
7. décider de la notification CNIL et/ou des personnes concernées selon les critères légaux ;
8. documenter l'incident, y compris si aucune notification n'est faite.

## 9. Continuité — objectifs internes initiaux

Objectifs de travail, à confirmer après test de restauration :
- RPO cible : 24 heures maximum ;
- RTO cible : 8 heures maximum pour un incident majeur de base de données ;
- priorité 1 : récupération des données clients et des documents ;
- priorité 2 : rétablissement du portail en lecture/écriture ;
- priorité 3 : réactivation des automatismes annexes (Calendly, emails, etc.).

Ces objectifs ne doivent pas être annoncés comme SLA tant qu'un test de restauration n'a pas démontré qu'ils sont tenables.

## 10. Procédure de test de restauration

Fréquence cible : trimestrielle et après modification majeure de l'architecture de sauvegarde.

Test exclusivement sur environnement isolé :
1. consigner date, responsable, source de sauvegarde et point de restauration ;
2. restaurer vers un environnement non-production ;
3. vérifier schéma, comptes, dossiers, RLS, fonctions critiques et documents ;
4. effectuer des contrôles d'intégrité par échantillonnage ;
5. mesurer la perte de données potentielle (RPO observé) ;
6. mesurer la durée totale (RTO observé) ;
7. détruire proprement l'environnement temporaire ;
8. enregistrer résultat, écarts et actions correctives.

Statut au 07/09/2026 : procédure définie ; preuve de restauration complète non encore produite.

## 11. Pré-analyse AIPD

Facteurs justifiant une analyse documentée : volume de données patrimoniales/fiscales, agrégation d'informations familiales/financières, documents justificatifs, profil investisseur et usage d'une plateforme numérique centralisée.

Mesures réductrices déjà présentes : cloisonnement RLS, MFA, stockage privé, journalisation, contrôle des RPC, chiffrement des flux HTTPS/TLS, minimisation des logs.

Conclusion provisoire : une pré-analyse AIPD doit être conservée au dossier. La nécessité d'une AIPD complète doit être tranchée après cartographie finale des traitements, durées, destinataires, transferts et volumétrie.

## 12. Audits et tests

- Crash-tests internes de cloisonnement et d'autorisation : réalisés.
- Security Advisor Supabase : utilisé et suivi.
- Scan de secrets Netlify : utilisé sur les déploiements.
- Pentest externe indépendant : non réalisé à ce jour.

Ne jamais présenter les contrôles internes comme un audit/pentest indépendant.

## 13. Points ouverts prioritaires

1. Produire une preuve de test de restauration isolé et mesurer RPO/RTO réels.
2. Ajouter une journalisation applicative des consultations/téléchargements de documents et ouvertures de dossier sensibles.
3. Finaliser l'inventaire de sous-traitants, DPA, transferts et durées de conservation.
4. Réaliser la pré-analyse AIPD complète.
5. Commander un pentest externe indépendant lorsque le périmètre est stabilisé.
