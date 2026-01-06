# Configuration GTM et Google Consent Mode v2

## Vue d'ensemble

Le système de consentement est maintenant implémenté sur votre site avec :
- ✅ Un pop-up RGPD conforme et professionnel
- ✅ Google Consent Mode v2 intégré
- ✅ Gestion des préférences utilisateur
- ✅ Stockage local des choix

## Comment ça fonctionne

### 1. Initialisation par défaut (Mode "refusé")

Au chargement de la page, **AVANT** que GTM ne charge ses balises, le Consent Mode est initialisé avec tous les cookies NON essentiels refusés :

```javascript
gtag('consent', 'default', {
  'ad_storage': 'denied',              // Cookies publicitaires
  'ad_user_data': 'denied',            // Données utilisateur pour les pubs
  'ad_personalization': 'denied',      // Personnalisation des pubs
  'analytics_storage': 'denied',       // Cookies analytics
  'functionality_storage': 'granted',  // Cookies fonctionnels (autorisés)
  'personalization_storage': 'denied', // Personnalisation du site
  'security_storage': 'granted'        // Cookies de sécurité (autorisés)
});
```

### 2. Mise à jour après consentement

Quand l'utilisateur accepte (tout ou partie), le consentement est mis à jour :

```javascript
gtag('consent', 'update', {
  'analytics_storage': 'granted',      // Si analytics accepté
  'ad_storage': 'granted',             // Si marketing accepté
  'ad_user_data': 'granted',           // Si marketing accepté
  'ad_personalization': 'granted',     // Si marketing accepté
  'personalization_storage': 'granted' // Si analytics accepté
});
```

## Configuration dans Google Tag Manager

### ÉTAPE 1 : Vérifier que GTM utilise le Consent Mode v2

1. Connectez-vous à [Google Tag Manager](https://tagmanager.google.com/)
2. Sélectionnez votre conteneur (GTM-N2JLWKH)
3. Allez dans **Admin** > **Paramètres du conteneur**
4. Vérifiez que l'option **"Activer la prise en charge du consentement"** est cochée

### ÉTAPE 2 : Configurer la balise Google Ads

1. Allez dans **Balises** > Sélectionnez votre balise **"Google Ads"** (AW-16789699877)
2. Dans la configuration de la balise, section **"Paramètres de consentement"** :
   - Cochez **"Nécessite un consentement supplémentaire pour les fonctionnalités"**
   - Dans **"Consentement requis"**, sélectionnez :
     - ✅ `ad_storage`
     - ✅ `ad_user_data`
     - ✅ `ad_personalization`

### ÉTAPE 3 : Configurer la balise Google Analytics 4

1. Allez dans **Balises** > Sélectionnez votre balise **"Google Analytics 4"** (G-...)
2. Dans la configuration de la balise, section **"Paramètres de consentement"** :
   - Cochez **"Nécessite un consentement supplémentaire pour les fonctionnalités"**
   - Dans **"Consentement requis"**, sélectionnez :
     - ✅ `analytics_storage`

### ÉTAPE 4 : Modifier la balise de conversion Calendly

Votre balise **"Conversion Calendly"** doit se déclencher UNIQUEMENT si l'utilisateur a accepté les cookies marketing.

1. Allez dans **Balises** > **"Conversion Calendly"**
2. Dans la section **"Déclenchement"**, vous avez actuellement un déclencheur basé sur le clic du bouton Calendly
3. Créez un nouveau déclencheur combiné :

#### Créer un déclencheur de consentement

1. Allez dans **Déclencheurs** > **Nouveau**
2. Nom : `Consentement Marketing Accordé`
3. Type : **Événement personnalisé**
4. Nom de l'événement : `consent_update`
5. Condition : Cet événement se déclenche sur **Certains événements personnalisés**
   - `ad_storage` est égal à `granted`
6. Enregistrez

#### Modifier le déclencheur de la balise Conversion

1. Retournez dans votre balise **"Conversion Calendly"**
2. Modifiez le déclenchement pour qu'il nécessite **DEUX conditions** :
   - Déclencheur existant (clic sur bouton Calendly)
   - **ET** `Consentement Marketing Accordé`

**ALTERNATIVE PLUS SIMPLE** : GTM gère automatiquement le consentement si vous avez coché "Nécessite un consentement" dans la configuration de la balise. Dans ce cas, la balise attend automatiquement que `ad_storage` soit `granted` avant de se déclencher.

### ÉTAPE 5 : Publier les modifications

1. Cliquez sur **Soumettre** en haut à droite
2. Donnez un nom à la version (ex: "Ajout Consent Mode v2")
3. Publiez

## Test de la configuration

### Avec Google Tag Assistant

1. Installez l'extension [Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-companion/ehkepjiconegkhpodgoaeamnpckdbblp)
2. Allez sur votre site eric-bellaiche.fr
3. Ouvrez Tag Assistant et cliquez sur **"Connect"**
4. Rechargez la page

#### Vérification 1 : Pop-up de consentement
- ✅ Le pop-up RGPD doit s'afficher après 1 seconde
- ✅ Il doit proposer 3 options : "Tout accepter", "Tout refuser", "Personnaliser"

#### Vérification 2 : État initial (avant acceptation)
Dans Tag Assistant, vous devriez voir :
- ✅ `ad_storage: denied`
- ✅ `analytics_storage: denied`
- ✅ Les balises Google Ads et GA4 NE se déclenchent PAS encore

#### Vérification 3 : Après avoir cliqué sur "Tout accepter"
- ✅ Le pop-up disparaît
- ✅ Dans Tag Assistant, vous voyez :
  - `ad_storage: granted`
  - `analytics_storage: granted`
- ✅ Les balises Google Ads et GA4 se déclenchent

#### Vérification 4 : Test de la conversion Calendly
1. Cliquez sur "Tout accepter" dans le pop-up
2. Cliquez sur le bouton "Prendre rendez-vous" (Calendly)
3. Dans Tag Assistant, vous devriez voir la balise **"Conversion Calendly"** se déclencher

#### Vérification 5 : Test du refus
1. Supprimez les cookies du site (ou utilisez une fenêtre incognito)
2. Rechargez la page
3. Cliquez sur "Tout refuser"
4. Vérifiez que les balises Google Ads et GA4 ne se déclenchent PAS
5. Vérifiez que le clic sur Calendly ne déclenche PAS la conversion

### Avec la console du navigateur

Ouvrez la console (F12) et tapez :

```javascript
console.log(localStorage.getItem('cookie-consent'));
```

Vous devriez voir les préférences enregistrées :
```json
{"analytics":true,"marketing":true,"timestamp":1234567890}
```

## Comportement du système

### Première visite
1. L'utilisateur arrive sur le site
2. Le Consent Mode initialise tout en "denied"
3. Après 1 seconde, le pop-up s'affiche
4. L'utilisateur fait un choix
5. Le consentement est mis à jour
6. Les préférences sont enregistrées dans le localStorage

### Visites suivantes
1. L'utilisateur revient sur le site
2. Le système lit le localStorage
3. Le consentement est automatiquement appliqué
4. Le pop-up ne s'affiche PAS

### Expiration
Les préférences sont conservées indéfiniment (pas d'expiration automatique). Pour respecter les bonnes pratiques RGPD, vous pourriez ajouter une expiration de 13 mois.

## Conformité RGPD

Le système implémenté est conforme au RGPD car :

✅ **Consentement préalable** : Les cookies non essentiels ne sont chargés qu'après consentement
✅ **Granularité** : L'utilisateur peut choisir séparément analytics et marketing
✅ **Transparence** : Chaque catégorie de cookies est expliquée clairement
✅ **Révocabilité** : L'utilisateur peut supprimer ses cookies pour voir à nouveau le pop-up
✅ **Opt-in** : Par défaut, tout est refusé (pas de pré-cochage)

## Ajouter un lien "Gérer mes cookies" (optionnel)

Si vous souhaitez permettre aux utilisateurs de modifier leur consentement après l'avoir donné, vous pouvez ajouter un lien dans le footer qui supprime le localStorage :

```html
<button onclick="localStorage.removeItem('cookie-consent'); location.reload();">
  Gérer mes cookies
</button>
```

## Problèmes courants et solutions

### Le pop-up ne s'affiche pas
- Vérifiez que le localStorage ne contient pas déjà un consentement
- Solution : `localStorage.removeItem('cookie-consent')` puis rechargez

### Les balises se déclenchent avant le consentement
- Vérifiez que le script GTM est bien APRÈS le code de Consent Mode dans le `<head>`
- Le code GTM doit être dans le `<head>`, APRÈS le code que nous avons ajouté

### La conversion Calendly ne se déclenche pas
- Vérifiez que l'utilisateur a accepté les cookies marketing
- Vérifiez dans GTM que la balise nécessite `ad_storage: granted`

## Prochaines étapes

1. ✅ Testez le système avec Tag Assistant
2. ✅ Publiez les modifications dans GTM
3. ✅ Relancez votre campagne Google Ads
4. ✅ Surveillez les conversions dans Google Ads pendant 48h

Le système de conversion devrait maintenant fonctionner correctement et être conforme au RGPD !
