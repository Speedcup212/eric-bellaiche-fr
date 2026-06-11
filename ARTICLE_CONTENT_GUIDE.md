# Guide de création d'articles — eric-bellaiche.fr

## Architecture du système éditorial

```
src/content/articles/          ← Données centralisées des articles
├── articleTypes.ts            ← Types TypeScript (ArticleContent)
├── articlesIndex.ts           ← Index de tous les articles
├── validation.ts              ← Validation qualité
├── conseiller-scpi.ts         ← Article SCPI
├── audit-patrimonial-en-ligne.ts
├── scpi-fiscalite.ts
├── scpi-assurance-vie-ou-direct.ts
└── per-ou-assurance-vie.ts

src/components/articles/       ← Composants React réutilisables
├── ArticleLayout.tsx          ← Template complet de l'article
├── ArticlesHub.tsx            ← Page listing tous les articles
├── ArticleCard.tsx            ← Carte de présentation d'un article
├── ArticleCTA.tsx             ← Bloc CTA rendez-vous
├── ArticleSummary.tsx         ← Encart "Réponse courte"
├── ArticleTOC.tsx             ← Sommaire interactif
├── FAQBlock.tsx               ← Bloc FAQ
├── RiskBlock.tsx              ← Encart risques
├── TakeawayBlock.tsx          ← Encart "À retenir"
├── ComparisonTable.tsx        ← Tableau comparatif
├── MethodBlock.tsx            ← Étapes d'une méthode
└── JsonLdArticle.tsx          ← Injection JSON-LD

src/pages/
├── ArticlesHubPage.tsx        ← Page /articles/
├── ArticlePage.tsx            ← Page d'un article
└── ArticlePageWrapper.tsx     ← Wrapper avec slug
```

## Comment créer un nouvel article

### 1. Créer le fichier de contenu

Créez un fichier dans `src/content/articles/mon-nouvel-article.ts` :

```typescript
import { ArticleContent } from './articleTypes';

const article: ArticleContent = {
  slug: 'mon-nouvel-article',
  category: 'patrimoine', // 'scpi' | 'fiscalite' | 'retraite' | 'assurance-vie' | 'patrimoine' | 'audit'
  title: "Titre de l'article",
  metaTitle: "Titre SEO — même titre généralement",
  metaDescription: "Meta description de 120 à 160 caractères pour Google et les moteurs IA.",
  canonical: 'https://eric-bellaiche.fr/articles/mon-nouvel-article/',
  badge: 'Catégorie &bull; CGP-CIF',
  intro: 'Introduction de 2-3 phrases qui résume le sujet.',
  shortAnswer: 'Réponse en 2-3 phrases donnant la réponse immédiate à la question principale.',
  summaryItems: [
    { label: 'Première section', anchor: 'premiere-section' },
    { label: 'Deuxième section', anchor: 'deuxieme-section' },
  ],
  readingTime: 8,
  updatedAt: '2026-06-11',
  author: 'Eric Bellaiche, CGP-CIF',
  tags: ['mot-clé1', 'mot-clé2'],
  sections: [
    {
      id: 'premiere-section',
      title: 'Première section',
      level: 'h2',
      type: 'normal', // 'normal' | 'table' | 'list' | 'method-steps' | 'example' | 'risk' | 'takeaway'
      content: ['Paragraphe 1...', 'Paragraphe 2...'],
      // Optionnel selon type :
      // table: { headers, rows }
      // listItems: [...]
      // methodSteps: [{ title, description }]
    },
  ],
  faq: [
    { question: 'Question 1 ?', answer: 'Réponse 1.' },
    { question: 'Question 2 ?', answer: 'Réponse 2.' },
  ],
  ctaTitle: 'Vous souhaitez être accompagné ?',
  ctaText: 'Texte d\'appel.',
  ctaLink: 'https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone',
  // Optionnel :
  externalLinks: [
    { href: 'https://maximusscpi.com/', label: 'MaximusSCPI', onlyInScpi: true },
  ],
  hasRisks: true, // true si article SCPI (nécessite un bloc risques)
};

export default article;
```

### 2. Enregistrer l'article dans l'index

Ajoutez dans `src/content/articles/articlesIndex.ts` :

```typescript
import monNouvelArticle from './mon-nouvel-article';

// Ajouter dans le tableau :
export const articles: ArticleContent[] = [
  // ... articles existants
  monNouvelArticle,
];
```

### 3. Ajouter la route dans App.tsx

```typescript
<Route path="/articles/mon-nouvel-article" element={<ArticlePageWrapper slug="mon-nouvel-article" />} />
<Route path="/articles/mon-nouvel-article/*" element={<ArticlePageWrapper slug="mon-nouvel-article" />} />
```

### 4. (Optionnel) Générer le fichier HTML statique

Si l'article est stratégique pour le SEO, créez également un fichier `public/articles/mon-nouvel-article/index.html` pour garantir la lisibilité en `view-source`. Utilisez les fichiers existants comme modèle.

### 5. Mettre à jour le sitemap.xml

Ajoutez l'URL dans `public/sitemap.xml`.

## Champs obligatoires

| Champ | Obligatoire | Note |
|-------|------------|------|
| `slug` | Oui | Identifiant unique |
| `category` | Oui | Doit être une des valeurs autorisées |
| `title` | Oui | H1 visible |
| `metaTitle` | Oui | Balise title SEO |
| `metaDescription` | Oui | 120-160 caractères |
| `canonical` | Oui | URL complète |
| `badge` | Oui | Court descriptif en haut de l'article |
| `intro` | Oui | Introduction |
| `shortAnswer` | Oui | Réponse courte immédiate |
| `readingTime` | Oui | Estimation en minutes |
| `updatedAt` | Oui | Date au format ISO |
| `author` | Oui | "Eric Bellaiche, CGP-CIF" |
| `sections` | Oui | Au moins 2 sections |
| `faq` | Oui | Au moins 8-12 questions pour les articles stratégiques |
| `ctaTitle` | Oui | Titre du CTA |
| `ctaLink` | Oui | Lien Calendly |

## Standard SEO à respecter

1. **H1 unique** : identique au `title`
2. **Meta description** : 120-160 caractères, incluant les mots-clés principaux
3. **Canonical** : URL complète sans slash final oublié
4. **FAQ structurée** : 8-12 questions pour les articles stratégiques
5. **JSON-LD** : généré automatiquement par `JsonLdArticle.tsx`
6. **Balises OpenGraph** : injectées automatiquement
7. **Risques SCPI** : obligatoire si `hasRisks: true`

## Comment ajouter une FAQ

Ajoutez simplement des entrées dans le tableau `faq` :

```typescript
faq: [
  { question: 'Question ?', answer: 'Réponse longue.' },
]
```

Le composant `JsonLdArticle.tsx` génère automatiquement le JSON-LD `FAQPage`.

## Comment ajouter un tableau

```typescript
sections: [{
  id: 'tableau-exemple',
  title: 'Titre du tableau',
  level: 'h2',
  type: 'table',
  content: ['Texte d\'introduction...'],
  table: {
    headers: ['Colonne 1', 'Colonne 2', 'Colonne 3'],
    rows: [
      ['Cellule 1', 'Cellule 2', 'Cellule 3'],
      ['Cellule 1', 'Cellule 2', 'Cellule 3'],
    ],
  },
}]
```

## Comment ajouter un CTA

Remplissez les champs `ctaTitle`, `ctaText` (optionnel) et `ctaLink`. Le lien par défaut est le Calendly de rendez-vous.

## Éviter le contenu dupliqué

1. Ne pas copier le contenu de MaximusSCPI.
2. Ne pas copier d'autres articles du site.
3. Chaque article doit avoir une angle unique.
4. Les articles SCPI peuvent inclure un lien vers MaximusSCPI comme ressource pédagogique, pas comme redirection commerciale.

## Articles SCPI et lien vers MaximusSCPI

```typescript
externalLinks: [
  { href: 'https://maximusscpi.com/', label: 'MaximusSCPI', onlyInScpi: true },
]
```

Le lien apparaît automatiquement dans le bloc "Ressource pédagogique" à la fin de l'article.

## Validation qualité

Exécutez la validation avec :

```typescript
import { validateAllArticles } from './content/articles/validation';
import { articles } from './content/articles/articlesIndex';

const warnings = validateAllArticles(articles);
console.table(warnings);
```

La validation signale les problèmes suivants sans bloquer le build :

- Article sans meta description
- Article sans FAQ (moins de 2 questions)
- Article sans shortAnswer
- Article sans CTA complet
- Article SCPI sans bloc risques
- Article sans canonical
- Article trop court (si le nombre de sections < 2)
