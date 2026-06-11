/**
 * Pictogrammes sobres pour les articles patrimoniaux.
 * Utilise lucide-react (déjà installé).
 * Seules les sections avec un type ou titre clairement identifiable
 * reçoivent une icône, pour éviter la surcharge visuelle.
 */

import React from 'react';
import {
  Sparkles,
  ListOrdered,
  Table2,
  XCircle,
  ShieldAlert,
  Route,
  BookOpen,
  Bookmark,
  HelpCircle,
  CalendarClock,
  Building2,
  Calculator,
  Hourglass,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Users,
  Landmark,
  AlertCircle,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

const iconStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexShrink: 0,
};

export function Icon({ icon, size = 20, color }: { icon: LucideIcon; size?: number; color?: string }) {
  const IconComponent = icon;
  return (
    <span style={iconStyle}>
      <IconComponent size={size} color={color || 'currentColor'} strokeWidth={1.5} />
    </span>
  );
}

/* ── Hero category icon ── */
export function HeroCategoryIcon({ category }: { category: string }) {
  const map: Record<string, LucideIcon> = {
    scpi: Landmark,
    fiscalite: Calculator,
    retraite: Hourglass,
    'assurance-vie': FileText,
    patrimoine: ClipboardCheck,
    audit: ClipboardCheck,
  };
  const IconComp = map[category] || ClipboardCheck;
  return <Icon icon={IconComp} size={20} color="#C5A059" />;
}

/* ── Section type icons ──
 *  Seules les sections typées ou aux titres clairement
 *  identifiables reçoivent une icône. */
export function getSectionIcon(type: string, title: string): LucideIcon | null {
  const lower = title.toLowerCase();

  /* Types forts — toujours une icône */
  if (type === 'table') return Table2;
  if (type === 'risk') return ShieldAlert;
  if (type === 'method-steps') return Route;
  if (type === 'takeaway') return Bookmark;

  /* list / normal — seulement si le titre contient un mot-clé explicite */
  if (lower.includes('erreur') || lower.includes('fréquente') || lower.includes('frequente')) return XCircle;
  if (lower.includes('exemple')) return BookOpen;
  if (lower.includes('méthode') || lower.includes('methode')) return Route;
  if (lower.includes('vigilance') || lower.includes('risque')) return ShieldAlert;

  return null;
}

/* ── Block header icons ── */
export const ICONS = {
  summary: Sparkles,
  toc: ListOrdered,
  faq: HelpCircle,
  cta: CalendarClock,
};
