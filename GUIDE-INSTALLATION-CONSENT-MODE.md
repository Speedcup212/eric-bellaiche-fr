# 🎯 Guide "Droit au But" : Configuration RGPD & Consent Mode v2

## ✅ BONNE NOUVELLE : Votre CMP est déjà installé !

Votre site possède déjà un pop-up RGPD professionnel et gratuit qui est **100% compatible avec Google Consent Mode v2**.

## ⚠️ LE PROBLÈME ACTUEL

Le code Consent Mode s'exécute dans React (après le chargement), mais GTM se charge AVANT. GTM ne "voit" donc pas les signaux de consentement.

**Solution** : Il faut initialiser le Consent Mode AVANT GTM, directement dans le `<head>` du HTML.

---

## 📋 PLAN D'ACTION EN 3 ÉTAPES

### ÉTAPE 1 : Initialiser Consent Mode AVANT GTM ⚡

**OÙ** : Dans le fichier `index.html`, dans le `<head>`, **JUSTE AVANT** le script GTM.

**CODE À AJOUTER** :

```html
<!-- Consent Mode v2 - AVANT GTM -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'granted',
    'personalization_storage': 'denied',
    'security_storage': 'granted',
    'wait_for_update': 500
  });
</script>
```

**IMPORTANT** : Ce script doit être placé JUSTE AVANT le script GTM existant.

Votre `<head>` doit ressembler à ceci :

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Eric Bellaiche - Conseil en Investissement</title>

  <!-- 1️⃣ CONSENT MODE D'ABORD -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied',
      'analytics_storage': 'denied',
      'functionality_storage': 'granted',
      'personalization_storage': 'denied',
      'security_storage': 'granted',
      'wait_for_update': 500
    });
  </script>

  <!-- 2️⃣ ENSUITE GTM -->
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-N2JLWKH');</script>
  <!-- End Google Tag Manager -->
</head>
```

---

### ÉTAPE 2 : Configuration dans GTM (Vérifications) 🔍

Connectez-vous à [Google Tag Manager](https://tagmanager.google.com/) et sélectionnez votre conteneur **GTM-N2JLWKH**.

#### 2.1 - Activer la prise en charge du consentement (Conteneur)

1. Allez dans **Admin** (roue dentée en haut à droite)
2. Cliquez sur **Paramètres du conteneur**
3. Cochez **"Activer la prise en charge du consentement pour les balises supplémentaires"**
4. Enregistrez

#### 2.2 - Configurer la balise Google Ads (AW-16789699877)

1. Allez dans **Balises**
2. Ouvrez votre balise **Google Ads** (ou **"Configuration Google Ads"**)
3. Dans la section **"Configuration de la balise"**, cherchez **"Paramètres de consentement"**
4. Sélectionnez **"Nécessite un consentement supplémentaire pour les fonctionnalités"**
5. Dans **"Consentement requis"**, cochez :
   - ✅ `ad_storage`
   - ✅ `ad_user_data`
   - ✅ `ad_personalization`
6. Enregistrez la balise

#### 2.3 - Configurer la balise Google Analytics 4 (si vous en avez une)

1. Ouvrez votre balise **Google Analytics 4**
2. Dans **"Paramètres de consentement"**, sélectionnez **"Nécessite un consentement"**
3. Cochez :
   - ✅ `analytics_storage`
4. Enregistrez

#### 2.4 - Configurer la balise "Conversion Calendly"

**Option A : Automatique (Recommandé)**

1. Ouvrez votre balise **"Conversion Calendly"**
2. Dans **"Paramètres de consentement"**, sélectionnez **"Nécessite un consentement"**
3. Cochez :
   - ✅ `ad_storage`
4. Enregistrez

GTM attendra automatiquement que `ad_storage` soit `granted` avant de déclencher la balise.

**Option B : Avec un déclencheur personnalisé (Plus précis)**

Si vous voulez un contrôle total :

1. Créez un nouveau **Déclencheur**
   - Nom : `Consentement Marketing Accordé`
   - Type : **Événement personnalisé**
   - Nom de l'événement : `consent_update`
   - Condition : `ad_storage` égal à `granted`

2. Modifiez votre balise **"Conversion Calendly"**
   - Ajoutez ce déclencheur en PLUS du déclencheur de clic existant
   - La balise nécessitera les DEUX conditions

#### 2.5 - Publier les modifications

1. Cliquez sur **Soumettre** (en haut à droite)
2. Donnez un nom : "Activation Consent Mode v2"
3. Cliquez sur **Publier**

---

### ÉTAPE 3 : Test de Vérification (Le Plus Important) 🧪

#### 3.1 - Avec le Mode Prévisualisation de GTM

1. Dans GTM, cliquez sur **Aperçu** (en haut à droite)
2. Entrez l'URL de votre site : `https://eric-bellaiche.fr`
3. Cliquez sur **Connect**
4. Une nouvelle fenêtre s'ouvre avec votre site + le panneau de débogage GTM

#### 3.2 - Vérification #1 : État initial (AVANT acceptation)

**Ce que vous devez voir dans le panneau GTM** :

1. Onglet **Summary** :
   - ✅ Événement `gtm.js` (GTM a démarré)
   - ✅ Événement `consent` avec état initial

2. Cliquez sur l'événement `consent` :
   - ✅ `ad_storage: denied`
   - ✅ `ad_user_data: denied`
   - ✅ `ad_personalization: denied`
   - ✅ `analytics_storage: denied`

3. **Le pop-up RGPD doit s'afficher** après 1 seconde

4. Onglet **Tags** :
   - ❌ Les balises Google Ads et GA4 **NE doivent PAS être déclenchées**
   - Raison : "Consent not granted"

#### 3.3 - Vérification #2 : Après avoir cliqué sur "Tout accepter"

1. Cliquez sur **"Tout accepter"** dans le pop-up
2. Le pop-up disparaît

**Ce que vous devez voir dans GTM** :

3. Nouvel événement `consent` dans le panneau Summary
4. Cliquez dessus :
   - ✅ `ad_storage: granted`
   - ✅ `ad_user_data: granted`
   - ✅ `ad_personalization: granted`
   - ✅ `analytics_storage: granted`

5. Onglet **Tags** :
   - ✅ Les balises Google Ads et GA4 **SE DÉCLENCHENT**

#### 3.4 - Vérification #3 : Test de la conversion Calendly

1. **APRÈS avoir accepté les cookies**, cliquez sur le bouton **"Prendre rendez-vous"** (Calendly)
2. Dans le panneau GTM, vous devriez voir :
   - ✅ Nouvel événement (ex: `gtm.click` ou événement personnalisé)
   - ✅ La balise **"Conversion Calendly"** se déclenche
   - ✅ État : "Tags Fired"

#### 3.5 - Vérification #4 : Test du refus

1. **Effacez les cookies** de votre navigateur (ou ouvrez une fenêtre incognito)
2. Rechargez la page avec le mode Aperçu GTM
3. Cliquez sur **"Tout refuser"** dans le pop-up

**Ce que vous devez voir** :
   - ✅ `ad_storage: denied`
   - ✅ `analytics_storage: denied`
   - ❌ Les balises Google Ads/GA4 **NE se déclenchent PAS**
   - ❌ Le clic sur Calendly **NE déclenche PAS** la conversion

#### 3.6 - Alternative : Test avec Google Tag Assistant

Si vous préférez ne pas utiliser le mode Aperçu GTM :

1. Installez l'extension Chrome : [Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-companion/ehkepjiconegkhpodgoaeamnpckdbblp)
2. Allez sur votre site
3. Ouvrez Tag Assistant et cliquez sur **"Connect"**
4. Rechargez la page
5. Suivez les mêmes étapes de vérification (état initial, acceptation, test Calendly)

---

## ✅ CHECKLIST FINALE

Avant de relancer vos campagnes Google Ads, vérifiez :

- [ ] Le code Consent Mode est dans le `<head>`, **AVANT** GTM
- [ ] Le pop-up RGPD s'affiche après 1 seconde
- [ ] Les consentements sont `denied` par défaut
- [ ] Après "Tout accepter", les consentements passent à `granted`
- [ ] Les balises Google Ads se déclenchent après acceptation
- [ ] La conversion Calendly se déclenche après acceptation + clic
- [ ] Les balises NE se déclenchent PAS si l'utilisateur refuse
- [ ] Les modifications GTM sont **publiées** (pas juste en aperçu)

---

## 🚀 APRÈS LE TEST

1. **Relancez vos campagnes Google Ads**
2. **Attendez 48h** pour voir les premières conversions
3. **Surveillez** le rapport "Conversions" dans Google Ads

---

## 🆘 PROBLÈMES COURANTS

### Le pop-up ne s'affiche pas

**Cause** : Vous avez déjà un consentement enregistré dans votre navigateur.

**Solution** :
1. Ouvrez la console du navigateur (F12)
2. Tapez : `localStorage.removeItem('cookie-consent')`
3. Rechargez la page

### Les balises se déclenchent AVANT d'accepter

**Cause** : Le code Consent Mode est APRÈS GTM dans le `<head>`.

**Solution** : Déplacez le script Consent Mode AVANT le script GTM.

### La conversion Calendly ne se déclenche pas

**Causes possibles** :
1. L'utilisateur n'a pas accepté les cookies marketing
2. La balise n'a pas l'option "Nécessite un consentement" pour `ad_storage`
3. Le déclencheur de la balise n'est pas configuré correctement

**Solution** : Revoir l'ÉTAPE 2.4

### GTM ne "voit" pas le Consent Mode

**Cause** : Le code Consent Mode s'exécute trop tard (dans React).

**Solution** : Suivre l'ÉTAPE 1 pour initialiser le Consent Mode dans le HTML.

---

## 💡 BONUS : Ajouter un lien "Gérer mes cookies"

Si vous voulez permettre aux utilisateurs de modifier leur consentement après l'avoir donné, ajoutez ce bouton dans votre footer :

```html
<button onclick="localStorage.removeItem('cookie-consent'); location.reload();"
        style="text-decoration: underline; color: #666; cursor: pointer; background: none; border: none;">
  Gérer mes cookies
</button>
```

---

## 📊 RÉSUMÉ DU SYSTÈME

### Comment ça fonctionne

1. **Avant le chargement** : Le Consent Mode initialise tout en "denied"
2. **GTM se charge** : Il "voit" que les consentements sont refusés
3. **Pop-up s'affiche** : L'utilisateur fait un choix
4. **Consentement mis à jour** : React envoie `gtag('consent', 'update', {...})`
5. **GTM réagit** : Les balises se déclenchent si le consentement est accordé

### Conformité RGPD

✅ **Opt-in par défaut** : Tout est refusé jusqu'à l'acceptation
✅ **Granularité** : L'utilisateur peut choisir analytics OU marketing
✅ **Transparence** : Chaque catégorie est expliquée
✅ **Persistance** : Les choix sont sauvegardés
✅ **Révocabilité** : Possible via le bouton "Gérer mes cookies"

---

**Votre système est prêt ! Suivez les 3 étapes et vos conversions Google Ads fonctionneront à nouveau. 🎉**
