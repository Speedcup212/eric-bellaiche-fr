# 🚀 Guide de Déploiement Netlify

## ✅ Étape 1 : GitHub - TERMINÉ

Vos modifications ont été poussées avec succès vers GitHub :
- **Repository** : `https://github.com/Speedcup212/eric-bellaiche-fr.git`
- **Branche** : `main`
- **Dernier commit** : Modifications CityPage et dépendances

---

## 🌐 Étape 2 : Déployer sur Netlify

### Option A : Déploiement via l'interface Netlify (Recommandé)

1. **Aller sur [Netlify](https://www.netlify.com/)**
   - Créer un compte si vous n'en avez pas (gratuit)
   - Se connecter avec GitHub (recommandé pour l'intégration automatique)

2. **Ajouter un nouveau site**
   - Cliquer sur **"Add new site"** → **"Import an existing project"**
   - Sélectionner **"Deploy with GitHub"**
   - Autoriser Netlify à accéder à votre compte GitHub si demandé

3. **Sélectionner le repository**
   - Choisir : `Speedcup212/eric-bellaiche-fr`
   - Netlify détectera automatiquement la configuration depuis `netlify.toml`

4. **Vérifier la configuration** (devrait être automatique)
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
   - **Branch** : `main`
   - **Node version** : `18`

5. **Déployer**
   - Cliquer sur **"Deploy site"**
   - Attendre 2-3 minutes pour le build
   - ✅ Votre site sera en ligne !

6. **URL de votre site**
   - Netlify générera automatiquement une URL : `https://[nom-aléatoire].netlify.app`
   - Vous pouvez la personnaliser dans les paramètres du site

---

### Option B : Déploiement via Netlify CLI (Avancé)

Si vous préférez utiliser la ligne de commande :

```bash
# Installer Netlify CLI globalement
npm install -g netlify-cli

# Se connecter à Netlify
netlify login

# Initialiser le site (dans le répertoire du projet)
cd "C:\Users\ericb\Desktop\Project Eric Bellaiche principal"
netlify init

# Déployer
netlify deploy --prod
```

---

## ⚙️ Configuration Netlify

Votre fichier `netlify.toml` est déjà configuré avec :

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

✅ **Tout est prêt !** Netlify utilisera automatiquement cette configuration.

---

## 🔄 Déploiement automatique

Une fois connecté à GitHub, Netlify déploiera automatiquement :
- ✅ À chaque push sur la branche `main`
- ✅ À chaque merge de pull request
- ✅ Vous recevrez un email de notification à chaque déploiement

---

## 🔐 Variables d'environnement (si nécessaire)

Si votre application utilise des variables d'environnement (ex: clés API Supabase) :

1. Aller dans **Site settings** → **Environment variables**
2. Ajouter vos variables :
   - `VITE_SUPABASE_URL` = votre URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = votre clé anonyme
   - etc.

⚠️ **Important** : Ne jamais commiter les fichiers `.env` dans Git !

---

## 📊 Monitoring et Analytics

Netlify offre gratuitement :
- ✅ Analytics de trafic
- ✅ Logs de build
- ✅ Notifications de déploiement
- ✅ Formulaires (si besoin)

---

## 🎯 Prochaines étapes

1. **Déployer sur Netlify** (suivre Option A ci-dessus)
2. **Tester le site** une fois déployé
3. **Personnaliser le nom de domaine** (optionnel, dans Site settings)
4. **Configurer un domaine personnalisé** (optionnel, si vous avez un domaine)

---

## ❓ Problèmes courants

### Build échoue
- Vérifier que toutes les dépendances sont dans `package.json`
- Vérifier les logs de build dans Netlify
- S'assurer que Node.js 18 est bien utilisé

### Site ne se charge pas
- Vérifier que le dossier `dist` est bien généré
- Vérifier les redirections dans `netlify.toml`
- Vérifier les logs de déploiement

### Variables d'environnement non détectées
- Vérifier que les variables commencent par `VITE_` (pour Vite)
- Redéployer après avoir ajouté les variables

---

## ✅ Checklist de déploiement

- [x] Code poussé sur GitHub
- [ ] Site déployé sur Netlify
- [ ] Site testé et fonctionnel
- [ ] Variables d'environnement configurées (si nécessaire)
- [ ] Domaine personnalisé configuré (optionnel)

---

**🎉 Votre site sera en ligne en quelques minutes !**
