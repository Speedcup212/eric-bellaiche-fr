export interface ArticleTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ArticleSection {
  id: string;
  title: string;
  level: 'h2' | 'h3';
  content: string[];
  type?: 'normal' | 'table' | 'list' | 'method-steps' | 'example' | 'risk' | 'takeaway' | 'faq' | 'resource';
  table?: ArticleTable;
  listItems?: string[];
  methodSteps?: { title: string; description: string }[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface InternalLink {
  href: string;
  label: string;
  position?: 'hub' | 'footer' | 'inline';
}

export interface ExternalLink {
  href: string;
  label: string;
  onlyInScpi?: boolean;
}

export interface ArticleContent {
  slug: string;
  category: 'scpi' | 'fiscalite' | 'retraite' | 'assurance-vie' | 'patrimoine' | 'audit';
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonical: string;
  badge: string;
  intro: string;
  shortAnswer: string;
  summaryItems: { label: string; anchor: string }[];
  readingTime: number;
  updatedAt: string;
  author: string;
  tags: string[];
  sections: ArticleSection[];
  faq: FAQItem[];
  ctaTitle: string;
  ctaText: string;
  ctaLink: string;
  internalLinks?: InternalLink[];
  externalLinks?: ExternalLink[];
  complianceNotes?: string[];
  hasRisks?: boolean;
  noIndex?: boolean;
}
