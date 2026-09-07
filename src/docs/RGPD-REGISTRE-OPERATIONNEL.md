# RGPD — Registre opérationnel plateforme patrimoniale

> Version initiale : 7 septembre 2026. Document interne à compléter/valider juridiquement avant publication externe.

## 1. Traitement principal

**Nom :** gestion numérique du dossier patrimonial client.

**Finalités :** collecte d'informations, connaissance client, profil investisseur, adéquation des recommandations, préparation des rendez-vous, constitution du dossier réglementaire, suivi de la relation et sécurité/traçabilité.

**Personnes concernées :** prospects, clients, co-investisseurs/conjoints lorsque le dossier est commun.

**Catégories de données :** identité, coordonnées, situation familiale/professionnelle, revenus, fiscalité, crédits, patrimoine, objectifs, profil investisseur, préférences de durabilité, pièces justificatives et logs de sécurité.

## 2. Bases légales — à valider par finalité

- mesures précontractuelles / exécution de la relation de conseil ;
- obligations légales et réglementaires applicables au cabinet ;
- intérêt légitime pour certaines mesures de sécurité, prévention de fraude et traçabilité ;
- consentement lorsque requis, notamment pour certaines communications marketing ou préférences facultatives.

Ne pas utiliser une base légale unique pour toutes les finalités sans validation juridique.

## 3. Sous-traitants / destinataires techniques identifiés

| Prestataire | Rôle observé | Données potentielles | Localisation/point d'attention | État documentaire |
|---|---|---|---|---|
| Supabase | DB, Auth, Storage, Edge Functions | données client, documents, comptes | base principale en région Paris ; vérifier DPA et sous-traitants | À archiver |
| Netlify | frontend + fonctions serveur | données transitant par fonctions, logs techniques | fonctions observées en région US ; documenter transfert/garanties | À archiver |
| Google / Gmail | envoi d'emails | identité, email, contenu des messages | vérifier DPA/paramétrage Workspace | À archiver |
| Calendly | réservation / synchronisation prospect | identité, email, téléphone éventuel, besoin/projet | vérifier DPA et paramètres de conservation | À archiver |
| Zoom | visioconférence | identité/coordonnées de réunion | préciser si enregistrement ou non | À confirmer |
| Youtrust / YouSign | signature / documents réglementaires selon usage | identité, documents, preuve de signature | vérifier DPA et conservation | À confirmer |

Tout nouveau prestataire ayant accès à des données personnelles doit être ajouté avant mise en production.

## 4. Matrice de conservation — cible interne provisoire

| Catégorie | Cible interne | Déclencheur | Action en fin de durée |
|---|---:|---|---|
| Prospect non devenu client | 12 mois max. | dernier contact / création | suppression ou anonymisation, sauf autre base légale |
| Invitation client expirée | 30 à 90 jours après expiration | expiration | purge jeton et métadonnées non nécessaires |
| Logs de sécurité | 12 à 24 mois | date du log | suppression automatique/archivage limité |
| Documents déposés par erreur | immédiat | détection | suppression |
| Dossier client actif | durée relation + obligations applicables | fin de relation | conservation probatoire/réglementaire à définir précisément |
| Données marketing | selon consentement et politique marketing | retrait/fin inactivité | suppression ou opposition enregistrée |

Les durées réglementaires du dossier client doivent être validées par conformité/juridique avant automatisation.

## 5. Droits des personnes — procédure

1. enregistrer la demande avec date ;
2. vérifier l'identité de façon proportionnée ;
3. qualifier le droit demandé ;
4. recenser les systèmes concernés ;
5. bloquer toute suppression incompatible avec une obligation légale ;
6. exécuter l'action ;
7. répondre dans le délai applicable ;
8. conserver uniquement la preuve minimale du traitement de la demande.

## 6. Violation de données — registre minimum

Pour chaque incident :
- date/heure découverte ;
- personne ayant détecté ;
- systèmes concernés ;
- catégories de données ;
- nombre estimé de personnes ;
- origine/cause ;
- mesures immédiates ;
- risque pour les personnes ;
- décision de notifier ou non ;
- date/heure éventuelle de notification ;
- mesures correctives et retest.

## 7. Revue périodique

Trimestriellement :
- comptes/habilitations ;
- sous-traitants ;
- politiques de conservation ;
- incidents ;
- tests RLS et MFA ;
- sauvegardes/restauration ;
- secrets et variables serveur ;
- alertes Security Advisor et dépendances critiques.
