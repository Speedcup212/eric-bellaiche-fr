# GUIDE TECHNIQUE D'IMPLÉMENTATION
## Site Eric Bellaiche - Checklist Production

---

## 🔧 1. CONFIGURATION TECHNIQUE DE BASE

### A. Hébergement & Performance

**Choix hébergement recommandé** :
- ✅ **Vercel** (recommandé) - gratuit, ultra-rapide, déploiement 1-click
- ✅ **Netlify** - alternative gratuite
- ⚠️ **WordPress** - NON recommandé (lent, vulnérable)

**Configuration Vercel** :
```bash
# Installation
npm install -g vercel

# Déploiement
vercel

# Configuration domaine
vercel domains add eric-bellaiche.fr
```

**Core Web Vitals à atteindre** :
- LCP (Largest Contentful Paint) : <2.5s
- FID (First Input Delay) : <100ms
- CLS (Cumulative Layout Shift) : <0.1

---

### B. Configuration DNS

**Chez votre registrar (OVH, Gandi, etc)** :

```
Type    Nom     Valeur                  TTL
A       @       76.76.21.21            3600
CNAME   www     cname.vercel-dns.com   3600
```

**SSL/HTTPS** : Automatique avec Vercel (Let's Encrypt)

---

## 📊 2. TRACKING & ANALYTICS

### A. Google Analytics 4

**Installation** :
1. Créer compte GA4 : https://analytics.google.com
2. Créer propriété "eric-bellaiche.fr"
3. Obtenir ID de mesure (G-XXXXXXXXXX)

**Code à intégrer** (dans `<head>`) :
```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Événements à tracker** :
```javascript
// Soumission formulaire
gtag('event', 'generate_lead', {
  'value': 500,
  'currency': 'EUR'
});

// Clic bouton téléphone
gtag('event', 'contact', {
  'method': 'phone'
});

// Scroll 50%
gtag('event', 'scroll', {
  'percent_scrolled': 50
});

// Temps sur page >2min
gtag('event', 'engagement', {
  'engagement_time_msec': 120000
});
```

---

### B. Google Tag Manager (Recommandé)

**Pourquoi GTM** :
- Gestion centralisée de tous les scripts
- Pas besoin de toucher au code pour ajouter pixels
- Facilite tests A/B

**Installation** :
```html
<!-- Google Tag Manager (dans <head>) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');</script>

<!-- Google Tag Manager (noscript) (après <body>) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

---

### C. Google Ads Conversion

**Configuration** :
1. Dans Google Ads : Outils > Conversions
2. Créer conversion "Lead formulaire"
3. Obtenir ID conversion (AW-XXXXXX/XXXXX)

**Code événement** :
```javascript
function handleFormSubmit() {
  // Envoyer conversion Google Ads
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXX/XXXXX',
    'value': 500.0,
    'currency': 'EUR'
  });
  
  // Votre logique formulaire...
}
```

---

### D. Facebook Pixel (Retargeting)

**Installation** :
```html
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'VOTRE_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

**Événements Lead** :
```javascript
// À la soumission formulaire
fbq('track', 'Lead', {
  value: 500,
  currency: 'EUR',
  content_name: 'Bilan Patrimonial'
});
```

---

### E. Hotjar (Heatmaps & Enregistrements)

**Installation** :
```html
<!-- Hotjar Tracking Code -->
<script>
  (function(h,o,t,j,a,r){
    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
    h._hjSettings={hjid:VOTRE_SITE_ID,hjsv:6};
    a=o.getElementsByTagName('head')[0];
    r=o.createElement('script');r.async=1;
    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
    a.appendChild(r);
  })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>
```

**Configuration Hotjar** :
- Activer heatmaps (clics, scroll)
- Activer enregistrements sessions
- Activer feedback widget

---

## 🚀 3. OPTIMISATION PERFORMANCE

### A. Images Optimisées

**Outils compression** :
- TinyPNG : https://tinypng.com
- Squoosh : https://squoosh.app

**Format recommandé** :
- WebP pour web moderne
- JPG fallback pour anciens navigateurs

**Code optimisé** :
```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description" loading="lazy">
</picture>
```

---

### B. Fonts Optimisées

**Google Fonts optimisé** :
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
```

**Ou self-host** (meilleure performance) :
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
}
```

---

### C. Minification & Compression

**Si utilisation Vite/Next.js** :
```javascript
// vite.config.js
export default {
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Supprimer console.log en prod
      }
    }
  }
}
```

**Compression Gzip/Brotli** : Automatique avec Vercel

---

### D. Lazy Loading

**Toutes images below-the-fold** :
```html
<img src="image.jpg" loading="lazy" alt="Description">
```

**Sections lourdes** :
```javascript
// Lazy load section témoignages
const Testimonials = lazy(() => import('./Testimonials'));
```

---

## 🔐 4. SÉCURITÉ & CONFIDENTIALITÉ

### A. RGPD - Bannière Cookies

**Solution recommandée : Tarteaucitron.js** (gratuit)
```html
<script src="https://tarteaucitron.io/load.js?domain=eric-bellaiche.fr&uuid=VOTRE_ID"></script>
<script>
tarteaucitron.init({
  "privacyUrl": "/mentions-legales",
  "hashtag": "#cookies",
  "highPrivacy": true
});

tarteaucitron.user.gtagUa = 'G-XXXXXXXXXX';
tarteaucitron.user.gtagMore = function () { /* */ };
(tarteaucitron.job = tarteaucitron.job || []).push('gtag');
</script>
```

---

### B. Protection Anti-Spam Formulaire

**Google reCAPTCHA v3** (invisible) :
```html
<script src="https://www.google.com/recaptcha/api.js?render=VOTRE_SITE_KEY"></script>
```

```javascript
function handleSubmit(e) {
  e.preventDefault();
  
  grecaptcha.execute('VOTRE_SITE_KEY', {action: 'submit'})
    .then(token => {
      // Envoyer formulaire avec token
      fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({...formData, captcha: token})
      });
    });
}
```

---

### C. Headers Sécurité

**Configuration Vercel** (`vercel.json`) :
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

---

## 📧 5. INTÉGRATION CRM / EMAIL

### A. Traitement Formulaire

**Option 1 : Zapier (No-code)** ✅ RECOMMANDÉ
```
Formulaire site → Zapier → Brevo/Gmail/Notion/Google Sheets
```

**Workflow Zapier** :
1. Trigger : Webhook reçu
2. Action 1 : Créer contact Brevo
3. Action 2 : Envoyer email notification
4. Action 3 : Ajouter ligne Google Sheets
5. Action 4 : Créer tâche Notion

**Code formulaire** :
```javascript
async function handleSubmit(e) {
  e.preventDefault();
  
  const response = await fetch('https://hooks.zapier.com/hooks/catch/XXXXX/XXXXX/', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  
  if (response.ok) {
    alert('Merci ! Je vous recontacte sous 24h.');
  }
}
```

---

**Option 2 : API Directe Brevo/Sender**
```javascript
async function sendToBrevo(data) {
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': 'VOTRE_CLE_API',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: data.email,
      attributes: {
        FIRSTNAME: data.nom,
        PHONE: data.telephone,
        PATRIMOINE: data.patrimoine,
        OBJECTIF: data.objectif
      },
      listIds: [2] // ID de votre liste
    })
  });
}
```

---

### B. Email Automatisé Bienvenue

**Template email** (Brevo/Sender) :
```
Sujet : Votre bilan patrimonial - Eric Bellaiche

Bonjour [NOM],

Merci pour votre demande de bilan patrimonial.

Je vous recontacte personnellement sous 24h ouvrées pour :
✓ Comprendre votre situation actuelle
✓ Identifier vos objectifs prioritaires
✓ Vous proposer un plan d'action chiffré

En attendant, voici quelques ressources :
→ [Lien] Guide : 10 erreurs patrimoniales à éviter
→ [Lien] Simulateur : Calculez vos économies d'impôts

À très vite,
Eric Bellaiche
Conseiller en Gestion de Patrimoine
📞 06 XX XX XX XX
```

---

## 🔔 6. NOTIFICATIONS TEMPS RÉEL

### A. Notification Slack/Discord

**Zapier → Slack** :
- Nouveau lead → Message canal #leads
- Include : nom, email, tel, patrimoine, objectif

**Webhook Discord** :
```javascript
async function notifyDiscord(data) {
  await fetch('VOTRE_WEBHOOK_DISCORD', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🎉 Nouveau lead !\n**Nom:** ${data.nom}\n**Email:** ${data.email}\n**Tél:** ${data.telephone}\n**Patrimoine:** ${data.patrimoine}\n**Objectif:** ${data.objectif}`
    })
  });
}
```

---

### B. SMS Notification (Twilio)

**Pour leads haute valeur** :
```javascript
// Si patrimoine > 500k€
if (formData.patrimoine === '500k+') {
  // Envoyer SMS via Twilio
  await fetch('https://api.twilio.com/2010-04-01/Accounts/ACCOUNT_SID/Messages.json', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa('ACCOUNT_SID:AUTH_TOKEN')
    },
    body: new URLSearchParams({
      'To': '+33XXXXXXXXX',
      'From': '+33XXXXXXXXX',
      'Body': `Lead VIP : ${formData.nom} - ${formData.email}`
    })
  });
}
```

---

## 📱 7. INTÉGRATION CALENDLY

**Code embed** :
```html
<!-- Bouton Calendly -->
<div class="calendly-inline-widget" 
     data-url="https://calendly.com/eric-bellaiche/consultation-30min"
     style="min-width:320px;height:630px;">
</div>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
```

**Popup Calendly** :
```javascript
import { PopupWidget } from 'react-calendly';

<PopupWidget
  url="https://calendly.com/eric-bellaiche/consultation-30min"
  text="Réserver un créneau"
  rootElement={document.getElementById('root')}
/>
```

---

## 🤖 8. CHATBOT (OPTIONNEL)

### A. Tidio

**Installation** :
```html
<script src="//code.tidio.co/VOTRE_CODE.js" async></script>
```

**Messages automatiques** :
- Bienvenue : "Bonjour, je suis Eric. Comment puis-je vous aider ?"
- Si inactif 30s : "Une question sur votre patrimoine ?"
- Si scroll 70% : "Besoin d'un conseil personnalisé ?"

---

### B. Réponses Automatiques

**Template réponses FAQ** :
```
Q: Combien coûte le bilan ?
R: Le bilan patrimonial initial est totalement gratuit et sans engagement.

Q: Sous combien de temps recevrai-je une réponse ?
R: Je m'engage à vous recontacter sous 24h ouvrées maximum.

Q: Êtes-vous indépendant ?
R: Oui, je suis conseiller indépendant avec accès à +100 partenaires.
```

---

## 🎨 9. PERSONNALISATION FINALE

### A. Remplacements Obligatoires

**Dans le code JSX** :
- [ ] Remplacer `06 XX XX XX XX` par votre vrai numéro
- [ ] Remplacer `contact@eric-bellaiche.fr` par votre email
- [ ] Ajouter vraie photo de profil
- [ ] Ajouter logo si existant
- [ ] Changer témoignages par vrais clients (ou supprimer)

### B. Ajustements Textes

**Chiffres à personnaliser** :
- Nombre de clients : 350+ → votre chiffre réel
- Années d'expérience : 30 ans → votre expérience
- Économies moyennes : 15 000€ → vos données
- Note avis : 4.9/5 → Google Business réel

---

## 📋 10. CHECKLIST PRÉ-LANCEMENT

**Technique** :
- [ ] Site déployé sur Vercel/Netlify
- [ ] Domaine configuré + HTTPS
- [ ] Google Analytics installé
- [ ] Google Ads conversion configurée
- [ ] Facebook Pixel installé
- [ ] Hotjar activé
- [ ] Formulaire teste OK
- [ ] Notification email fonctionne
- [ ] Bannière cookies RGPD
- [ ] Test mobile (iPhone + Android)
- [ ] Test vitesse PageSpeed >90/100
- [ ] Test tous navigateurs (Chrome, Safari, Firefox)

**Contenu** :
- [ ] Numéro téléphone correct
- [ ] Email de contact correct
- [ ] Photos professionnelles
- [ ] Témoignages réels ou supprimés
- [ ] Chiffres actualisés
- [ ] Mentions légales à jour
- [ ] CGU/CGV rédigées

**Marketing** :
- [ ] Compte Google Ads créé
- [ ] Campagnes Google Ads préparées
- [ ] Budget défini
- [ ] Calendly configuré
- [ ] Brevo/Sender configuré
- [ ] Séquence emails automatiques créée

---

## 🚀 11. POST-LANCEMENT (7 PREMIERS JOURS)

### Jour 1-2
- Monitorer leads entrants
- Vérifier notifications fonctionnent
- Tester formulaire plusieurs fois

### Jour 3-4
- Analyser premières heatmaps Hotjar
- Identifier points de friction
- Ajuster si besoin

### Jour 5-7
- Analyser performances Google Ads
- Désactiver annonces Quality Score <6
- Ajuster budgets campagnes

---

## 📞 SUPPORT TECHNIQUE

**En cas de problème** :
1. Vérifier console navigateur (F12)
2. Tester mode navigation privée
3. Vider cache navigateur
4. Tester autre navigateur

**Ressources** :
- Documentation Vercel : https://vercel.com/docs
- Documentation React : https://react.dev
- Support Google Ads : https://support.google.com/google-ads

---

**Site prêt pour production ✅**
**Temps déploiement estimé : 2-4 heures**

*Questions techniques ? Je suis disponible.*